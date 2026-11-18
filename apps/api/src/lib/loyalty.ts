/**
 * PROGRAMME FIDÉLITÉ (18 nov. 2026) — voir `packages/constants/src/loyalty.ts` pour les règles.
 *
 * Réglage du salon gardé dans `app_settings` (`loyalty:<salon>`), comme le style des étiquettes :
 * aucune migration. La progression d'un client se RECALCULE à partir de ses rendez-vous terminés pris
 * sur Salon DZ — rien d'autre n'est stocké, donc rien ne peut diverger.
 *
 * Tout ce qui notifie est best-effort : une erreur ici ne bloque jamais un rendez-vous.
 */
import type { FastifyBaseLogger } from 'fastify';
import {
  LOYALTY_ANNOUNCE_EVERY_DAYS,
  loyaltyHeadline,
  loyaltyProgress,
  loyaltyReward,
  normalizeLoyalty,
  type LoyaltyCard,
  type LoyaltyProgram,
  type LoyaltyPublic,
} from '@salondz/constants';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

const PREFIX = 'loyalty:';
const key = (salonId: string) => `${PREFIX}${salonId}`;

export async function readLoyalty(salonId: string): Promise<LoyaltyProgram> {
  const res = await db.from('app_settings').select('value').eq('key', key(salonId)).maybeSingle();
  if (res.error || !res.data?.value) return normalizeLoyalty(null);
  try {
    return normalizeLoyalty(JSON.parse(res.data.value as string));
  } catch {
    return normalizeLoyalty(null);
  }
}

async function store(salonId: string, p: LoyaltyProgram): Promise<LoyaltyProgram> {
  const res = await db
    .from('app_settings')
    .upsert({ key: key(salonId), value: JSON.stringify(p), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
  return p;
}

export const toPublic = (salonId: string, p: LoyaltyProgram): LoyaltyPublic => ({
  salonId,
  visits: p.visits,
  rewardKind: p.rewardKind,
  rewardValue: p.rewardValue,
  welcome: p.welcome,
  validityMonths: p.validityMonths,
});

/**
 * Enregistre le réglage du pro. Première activation : `startedAt` est posé (les visites d'avant ne
 * comptent pas). Activation : une annonce part aux clients du salon, une fois par mois au plus.
 */
export async function writeLoyalty(
  log: FastifyBaseLogger,
  salon: { id: string; name: string; slug: string },
  input: Pick<LoyaltyProgram, 'enabled' | 'visits' | 'rewardKind' | 'rewardValue' | 'welcome' | 'validityMonths'>,
): Promise<LoyaltyProgram & { announced: number }> {
  const before = await readLoyalty(salon.id);
  const now = new Date();
  const next = normalizeLoyalty({
    ...input,
    startedAt: before.startedAt ?? (input.enabled ? now.toISOString() : null),
    announcedAt: before.announcedAt,
  });
  let announced = 0;
  const canAnnounce =
    next.enabled &&
    (!before.enabled || !before.announcedAt) &&
    (!before.announcedAt || now.getTime() - new Date(before.announcedAt).getTime() > LOYALTY_ANNOUNCE_EVERY_DAYS * 86_400_000);
  if (canAnnounce) {
    next.announcedAt = now.toISOString();
    announced = await announce(log, salon, next).catch((err) => {
      log.warn({ err, salonId: salon.id }, 'loyalty announce');
      return 0;
    });
  }
  await store(salon.id, next);
  return { ...next, announced };
}

/** Annonce aux clients qui ont déjà eu un rendez-vous dans ce salon (comptes clients seulement). */
async function announce(log: FastifyBaseLogger, salon: { id: string; name: string; slug: string }, p: LoyaltyProgram): Promise<number> {
  const res = await db
    .from('bookings')
    .select('client_id')
    .eq('salon_id', salon.id)
    .not('client_id', 'is', null)
    .in('status', ['confirmed', 'completed'])
    .limit(2000);
  if (res.error) throw res.error;
  const ids = [...new Set((res.data ?? []).map((r) => r.client_id as string))];
  if (ids.length === 0) return 0;
  const clients = await db.from('profiles').select('id').in('id', ids).eq('role', 'client');
  if (clients.error) throw clients.error;
  const rows = (clients.data ?? []).map((c) => ({
    user_id: c.id as string,
    type: 'booking_completed',
    title: `${salon.name} lance sa carte fidélité`,
    body: `${loyaltyHeadline(p)} — vos visites réservées sur Salon DZ comptent.`,
    data: { kind: 'loyalty', salonId: salon.id, url: `/s/${salon.slug}` },
  }));
  if (rows.length === 0) return 0;
  const ins = await db.from('notifications').insert(rows);
  if (ins.error) throw ins.error;
  void dispatchPendingPush(log).catch((err) => log.error({ err }, 'loyalty announce push'));
  return rows.length;
}

/** Dates des visites qui comptent (terminées, prises sur Salon DZ) d'un client dans un salon. */
async function visitDates(salonId: string, clientId: string): Promise<string[]> {
  const res = await db
    .from('bookings')
    .select('starts_at')
    .eq('salon_id', salonId)
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .eq('source', 'online')
    .order('starts_at', { ascending: true })
    .limit(500);
  if (res.error) throw res.error;
  return (res.data ?? []).map((r) => r.starts_at as string);
}

/** Tous les programmes actifs (place de marché : l'icône sur les cartes des salons). */
export async function activePrograms(): Promise<LoyaltyPublic[]> {
  const res = await db.from('app_settings').select('key, value').like('key', `${PREFIX}%`).limit(5000);
  if (res.error) throw res.error;
  const out: LoyaltyPublic[] = [];
  for (const row of res.data ?? []) {
    try {
      const p = normalizeLoyalty(JSON.parse(row.value as string));
      if (p.enabled) out.push(toPublic((row.key as string).slice(PREFIX.length), p));
    } catch {
      /* réglage illisible : ignoré */
    }
  }
  return out;
}

/** Progression d'un client chez un salon (page du salon, confirmation). */
export async function clientProgress(salonId: string, clientId: string) {
  const p = await readLoyalty(salonId);
  if (!p.enabled) return null;
  return { program: toPublic(salonId, p), ...loyaltyProgress(p, await visitDates(salonId, clientId)) };
}

/** Toutes les cartes d'un client : salons à programme actif où il a déjà une visite qui compte. */
export async function clientCards(clientId: string): Promise<LoyaltyCard[]> {
  const res = await db
    .from('bookings')
    .select('salon_id, starts_at')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .eq('source', 'online')
    .limit(1000);
  if (res.error) throw res.error;
  const bySalon = new Map<string, string[]>();
  for (const r of res.data ?? []) bySalon.set(r.salon_id as string, [...(bySalon.get(r.salon_id as string) ?? []), r.starts_at as string]);
  if (bySalon.size === 0) return [];
  const salons = await db.from('salons').select('id, slug, name, logo_url, cover_url, city').in('id', [...bySalon.keys()]);
  if (salons.error) throw salons.error;
  const cards: LoyaltyCard[] = [];
  for (const s of salons.data ?? []) {
    const p = await readLoyalty(s.id as string);
    if (!p.enabled) continue;
    const prog = loyaltyProgress(p, bySalon.get(s.id as string) ?? []);
    cards.push({
      ...prog,
      program: toPublic(s.id as string, p),
      salon: { id: s.id as string, slug: s.slug as string, name: s.name as string, logoUrl: (s.logo_url as string) ?? null, coverUrl: (s.cover_url as string) ?? null, city: (s.city as string) ?? null },
    });
  }
  // La plus proche de la récompense d'abord.
  return cards.sort((a, b) => b.stamps / b.program.visits - a.stamps / a.program.visits);
}

/**
 * Un rendez-vous à venir est-il la visite récompensée ? (fenêtre et fiche du pro, confirmation du
 * client). Seulement pour un rendez-vous pris sur Salon DZ, par un client avec compte.
 */
export async function bookingReward(b: { salonId: string; clientId: string | null; source: string; startsAt: string; status: string }) {
  if (!b.clientId || b.source !== 'online') return null;
  const p = await readLoyalty(b.salonId);
  if (!p.enabled) return null;
  const prog = loyaltyProgress(p, await visitDates(b.salonId, b.clientId), new Date(), b.startsAt);
  return { program: toPublic(b.salonId, p), stamps: prog.stamps, reward: prog.nextIsReward ? loyaltyReward(p) : null };
}

/** Après un « Terminé » : « +1 tampon chez … ». Best-effort. */
export async function notifyStamp(
  log: FastifyBaseLogger,
  b: { salonId: string; clientId: string | null; source: string },
  salon: { name: string; slug: string },
): Promise<void> {
  if (!b.clientId || b.source !== 'online') return;
  try {
    const p = await readLoyalty(b.salonId);
    if (!p.enabled) return;
    const prog = loyaltyProgress(p, await visitDates(b.salonId, b.clientId));
    const left = p.visits - 1 - prog.stamps;
    const title = prog.stamps === 0 && prog.rewards > 0 ? `Récompense utilisée chez ${salon.name}` : `+1 tampon chez ${salon.name}`;
    const body =
      prog.stamps === 0 && prog.rewards > 0
        ? 'Votre nouvelle carte commence : à bientôt.'
        : prog.nextIsReward
          ? `Votre prochaine visite est récompensée : ${loyaltyReward(p).toLowerCase()}.`
          : `Encore ${left} visite${left > 1 ? 's' : ''} avant votre récompense.`;
    const ins = await db.from('notifications').insert({
      user_id: b.clientId,
      type: 'booking_completed',
      title,
      body,
      data: { kind: 'loyalty', salonId: b.salonId, url: '/fidelite' },
    });
    if (ins.error) throw ins.error;
    await dispatchPendingPush(log);
  } catch (err) {
    log.warn({ err }, 'loyalty stamp');
  }
}
