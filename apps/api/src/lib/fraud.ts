/**
 * BOUCLIER DE RÉSERVATION — limites du salon et moteur de fraude (26 nov. 2026).
 * Constantes et règles partagées : `packages/constants/src/bookingGuard.ts`.
 *
 * À chaque tentative de réservation en ligne :
 *   1. on mesure des SIGNAUX (vitesse du compte, rafales depuis une adresse, demandes en attente
 *      empilées, réserver-annuler en boucle, compte neuf, refus répétés) et on calcule un SCORE ;
 *   2. la tentative est INSCRITE au journal `booking_attempts` (migration 0067) avec son score et
 *      ses raisons — elle compte donc dans la vitesse suivante, même refusée ;
 *   3. verdict : passer, REFUSER (« réessayez plus tard »), ou SUSPENDRE le compte de toute
 *      réservation en ligne (`profiles.suspended_at`, lu aussi par `create_booking_multi`) et annuler
 *      au nom de la plateforme les réservations de rafale (prises dans les dernières 24 h et pas
 *      encore commencées) pour rendre ces créneaux au salon.
 * Les limites FERMES (chevauchement avec un autre rendez-vous, plafonds du salon) ne passent pas par
 * le score : elles disent non tout de suite, avec la raison exacte.
 */
import type { FastifyBaseLogger } from 'fastify';
import { BOOKING_GUARD_DEFAULT, FRAUD, FRAUD_SUSPENSION_REASON, cleanBookingGuard, type BookingGuard } from '@salondz/constants';
import { db } from './supabase';
import { cancelAsPlatform } from './moderation';

// ------------------------------------------------------------------ Limites du salon
const guardKey = (salonId: string) => `booking_guard:${salonId}`;

export async function readBookingGuard(salonId: string): Promise<BookingGuard> {
  const res = await db.from('app_settings').select('value').eq('key', guardKey(salonId)).maybeSingle();
  if (res.error || !res.data?.value) return { ...BOOKING_GUARD_DEFAULT };
  try {
    return cleanBookingGuard(JSON.parse(res.data.value as string) as Partial<BookingGuard>);
  } catch {
    return { ...BOOKING_GUARD_DEFAULT };
  }
}

export async function saveBookingGuard(salonId: string, g: Partial<BookingGuard>): Promise<BookingGuard> {
  const v = cleanBookingGuard(g);
  const res = await db
    .from('app_settings')
    .upsert({ key: guardKey(salonId), value: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
  return v;
}

// ------------------------------------------------------------------ Moteur de fraude
export type FraudVerdict = 'ok' | 'refuse' | 'block';
export interface FraudResult {
  score: number;
  reasons: string[];
  verdict: FraudVerdict;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

async function count(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const r = await q;
  if (r.error) throw r.error;
  return r.count ?? 0;
}

/**
 * Score de risque d'une tentative. `userId` = le compte qui réserve (celui qu'on suspendrait),
 * même quand il réserve pour quelqu'un d'autre.
 */
export async function scoreAttempt(p: { userId: string; ip: string | null; accountCreatedAt: string | null }): Promise<FraudResult> {
  const att = () => db.from('booking_attempts').select('id', { count: 'exact', head: true }).eq('user_id', p.userId);
  const [n10, n60, nDay, refusedDay, ipAccounts, pending, churn] = await Promise.all([
    count(att().gte('created_at', since(10 * MIN))),
    count(att().gte('created_at', since(HOUR))),
    count(att().gte('created_at', since(DAY))),
    count(att().neq('outcome', 'ok').gte('created_at', since(DAY))),
    // Comptes DIFFÉRENTS qui ont tenté de réserver depuis la même adresse dans l'heure.
    p.ip
      ? db
          .from('booking_attempts')
          .select('user_id')
          .eq('ip', p.ip)
          .neq('user_id', p.userId)
          .gte('created_at', since(HOUR))
          .limit(200)
          .then((r) => {
            if (r.error) throw r.error;
            return new Set((r.data ?? []).map((x) => (x as { user_id: string }).user_id)).size;
          })
      : Promise.resolve(0),
    count(
      db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .or(`client_id.eq.${p.userId},booked_by.eq.${p.userId}`)
        .eq('status', 'pending')
        .eq('source', 'online')
        .gte('starts_at', new Date().toISOString()),
    ),
    // Réserver puis annuler soi-même dans l'heure, plusieurs fois en un jour : on bloque des créneaux
    // pour rien (ou on « teste » le système).
    db
      .from('bookings')
      .select('created_at, cancelled_at')
      .or(`client_id.eq.${p.userId},booked_by.eq.${p.userId}`)
      .eq('status', 'cancelled')
      .eq('cancelled_by', 'client')
      .eq('source', 'online')
      .gte('created_at', since(DAY))
      .limit(100)
      .then((r) => {
        if (r.error) throw r.error;
        return (r.data ?? []).filter((b) => {
          const x = b as { created_at: string; cancelled_at: string | null };
          return x.cancelled_at && new Date(x.cancelled_at).getTime() - new Date(x.created_at).getTime() < HOUR;
        }).length;
      }),
  ]);

  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, why: string) => {
    score += pts;
    reasons.push(`${why} (+${pts})`);
  };
  // Les compteurs ci-dessus ne comptent pas encore la tentative en cours : +1.
  if (n10 + 1 > FRAUD.burst10min) add(40 * (n10 + 1 - FRAUD.burst10min), `${n10 + 1} tentatives en 10 min`);
  if (n60 + 1 > FRAUD.perHour) add(30, `${n60 + 1} tentatives en 1 h`);
  if (nDay + 1 > FRAUD.perDay) add(30, `${nDay + 1} tentatives en 24 h`);
  if (refusedDay >= FRAUD.refusedDay) add(refusedDay >= FRAUD.refusedDay * 2 ? 50 : 25, `${refusedDay} tentatives refusées en 24 h`);
  if (ipAccounts >= FRAUD.ipAccountsHour) add(ipAccounts >= FRAUD.ipAccountsHour + 2 ? 60 : 30, `${ipAccounts + 1} comptes depuis la même adresse en 1 h`);
  if (pending >= FRAUD.pendingMax) add(30, `${pending} demandes en attente`);
  if (churn >= FRAUD.churnDay) add(churn >= FRAUD.churnDay * 2 ? 60 : 30, `${churn} réservations annulées dans l'heure, sur 24 h`);
  const neuf = p.accountCreatedAt && Date.now() - new Date(p.accountCreatedAt).getTime() < FRAUD.newAccountHours * HOUR;
  if (neuf && score > 0) add(15, 'compte créé il y a moins de 24 h');

  const verdict: FraudVerdict = score >= FRAUD.block ? 'block' : score >= FRAUD.refuse ? 'refuse' : 'ok';
  return { score, reasons, verdict };
}

/** Inscrit la tentative au journal. Jamais bloquant pour la personne : une erreur se journalise. */
export async function recordAttempt(
  log: FastifyBaseLogger,
  a: { userId: string; salonId: string; ip: string | null; outcome: 'ok' | 'refused' | 'blocked'; score: number; reasons: string[] },
): Promise<void> {
  const res = await db.from('booking_attempts').insert({
    user_id: a.userId,
    salon_id: a.salonId,
    ip: a.ip,
    outcome: a.outcome,
    score: a.score,
    reasons: a.reasons,
  });
  if (res.error) log.error({ err: res.error }, 'booking_attempts');
}

/**
 * SUSPENSION AUTOMATIQUE : plus aucune réservation en ligne nulle part (même mécanisme que la
 * suspension par un administrateur, qui peut la lever depuis la fiche du compte), et les réservations
 * de la rafale — prises dans les dernières 24 h, pas encore commencées — sont annulées au nom de la
 * plateforme : le salon retrouve ses créneaux, les inscrits de la liste d'attente sont prévenus.
 */
export async function suspendForFraud(log: FastifyBaseLogger, userId: string, r: FraudResult): Promise<void> {
  const admin = await db.from('platform_admins').select('user_id').eq('user_id', userId).is('disabled_at', null).maybeSingle();
  if (admin.data) {
    log.warn({ userId, score: r.score }, 'fraude : compte administrateur non suspendu');
    return;
  }
  const up = await db
    .from('profiles')
    .update({ suspended_at: new Date().toISOString(), suspended_reason: FRAUD_SUSPENSION_REASON, suspended_by: null })
    .eq('id', userId)
    .is('suspended_at', null);
  if (up.error) throw up.error;
  log.warn({ userId, score: r.score, reasons: r.reasons }, 'fraude : compte suspendu automatiquement');
  const rafale = await db
    .from('bookings')
    .select('id')
    .or(`client_id.eq.${userId},booked_by.eq.${userId}`)
    .in('status', ['pending', 'confirmed'])
    .eq('source', 'online')
    .gte('created_at', since(DAY))
    .gt('starts_at', new Date().toISOString())
    .limit(50);
  if (rafale.error) throw rafale.error;
  for (const b of rafale.data ?? []) {
    await cancelAsPlatform(log, (b as { id: string }).id, 'Réservation annulée par Salon DZ : activité inhabituelle détectée sur le compte.').catch((err) =>
      log.error({ err }, 'fraude : annulation'),
    );
  }
}
