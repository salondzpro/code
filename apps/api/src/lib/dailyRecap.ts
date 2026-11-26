/**
 * BILAN DU SOIR (26 nov. 2026, demande du propriétaire : « comme Uber Eats avec ses livreurs »).
 *
 * Chaque jour d'ouverture, DEUX HEURES APRÈS LA FERMETURE du salon (fin de sa dernière plage
 * horaire du jour, heure d'Alger), le professionnel reçoit une notification :
 *   - une journée avec des rendez-vous : « Félicitations pour votre journée 🎉 » — combien de
 *     rendez-vous, combien pris EN LIGNE via Salon DZ, et le chiffre du jour ;
 *   - une journée sans rendez-vous : un encouragement à partager son lien pour remplir demain.
 * Une seule fois par jour et par salon (`app_settings` `daily_recap:<salon>` = dernier jour envoyé).
 * Appelé par le cron (`/internal/cron/tick`, toutes les 10 min) ; fenêtre de 90 min après l'heure
 * prévue pour ne rien rater si un passage du cron saute. Une fermeture tardive (23 h → envoi à 1 h)
 * part le lendemain pour la journée de la veille. Jamais bloquant pour le reste du cron.
 */
import type { FastifyBaseLogger } from 'fastify';
import { formatDA } from '@salondz/constants';
import { db } from './supabase';

const ZONE = 'Africa/Algiers';
const DELAI_MIN = 120;
const FENETRE_MIN = 90;

/** Date (AAAA-MM-JJ), minute du jour et jour de la semaine à Alger. */
function alger(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(p.weekday));
  return { day: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), dow };
}
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};
/** Bornes UTC d'un jour d'Alger (UTC+1 toute l'année). */
const bornes = (day: string) => ({ from: new Date(`${day}T00:00:00+01:00`).toISOString(), to: new Date(`${day}T23:59:59.999+01:00`).toISOString() });

export async function runDailyRecaps(log: FastifyBaseLogger, now = new Date()): Promise<number> {
  const ici = alger(now);
  const hier = alger(new Date(now.getTime() - 86_400_000));
  const [salons, heures, envoyes] = await Promise.all([
    db.from('salons').select('id, owner_id, name').eq('is_published', true).is('suspended_at', null),
    db.from('opening_hours').select('salon_id, day_of_week, closes_at').eq('is_closed', false).in('day_of_week', [ici.dow, hier.dow]),
    db.from('app_settings').select('key, value').like('key', 'daily_recap:%'),
  ]);
  if (salons.error) throw salons.error;
  if (heures.error) throw heures.error;
  if (envoyes.error) throw envoyes.error;
  const dernier = new Map((envoyes.data ?? []).map((r) => [String(r.key).slice('daily_recap:'.length), String(r.value)]));
  // Fermeture du jour = fin de la DERNIÈRE plage (une journée peut avoir une coupure à midi).
  const fermeture = new Map<string, number>();
  for (const h of heures.data ?? []) {
    const k = `${h.salon_id}:${h.day_of_week}`;
    fermeture.set(k, Math.max(fermeture.get(k) ?? 0, minutes(String(h.closes_at))));
  }

  let envoyees = 0;
  for (const s of (salons.data ?? []) as { id: string; owner_id: string | null; name: string }[]) {
    if (!s.owner_id) continue;
    // La journée concernée : aujourd'hui, ou hier si sa fermeture + 2 h tombe après minuit.
    let jour: string | null = null;
    const fAuj = fermeture.get(`${s.id}:${ici.dow}`);
    const fHier = fermeture.get(`${s.id}:${hier.dow}`);
    if (fAuj != null && ici.min >= fAuj + DELAI_MIN && ici.min < fAuj + DELAI_MIN + FENETRE_MIN) jour = ici.day;
    else if (fHier != null && fHier + DELAI_MIN >= 1440) {
      const cible = fHier + DELAI_MIN - 1440;
      if (ici.min >= cible && ici.min < cible + FENETRE_MIN) jour = hier.day;
    }
    if (!jour || dernier.get(s.id) === jour) continue;

    try {
      const { from, to } = bornes(jour);
      const rdv = await db
        .from('bookings')
        .select('status, source, price_da')
        .eq('salon_id', s.id)
        .gte('starts_at', from)
        .lte('starts_at', to)
        .in('status', ['confirmed', 'completed', 'pending']);
      if (rdv.error) throw rdv.error;
      const lignes = (rdv.data ?? []) as { status: string; source: string; price_da: number | null }[];
      const total = lignes.length;
      const enLigne = lignes.filter((b) => b.source === 'online').length;
      const chiffre = lignes.filter((b) => b.status !== 'pending').reduce((a, b) => a + (b.price_da ?? 0), 0);

      const titre = total > 0 ? 'Félicitations pour votre journée 🎉' : 'Demain, on remplit l’agenda 💪';
      const corps =
        total > 0
          ? `${total} rendez-vous aujourd’hui${enLigne > 0 ? `, dont ${enLigne} réservé${enLigne > 1 ? 's' : ''} en ligne via Salon DZ` : ''}${chiffre > 0 ? ` · ${formatDA(chiffre)}` : ''}. Continuez comme ça !`
          : 'Partagez votre lien Salon DZ en story : vos clientes réservent même quand vous êtes occupé.';
      const ins = await db.from('notifications').insert({
        user_id: s.owner_id,
        type: 'booking_completed',
        title: titre,
        body: corps,
        data: { kind: 'daily_recap', audience: 'pro', url: '/pro', day: jour, total, online: enLigne, revenue: chiffre },
        booking_id: null,
      });
      if (ins.error) throw ins.error;
      const mark = await db
        .from('app_settings')
        .upsert({ key: `daily_recap:${s.id}`, value: jour, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (mark.error) throw mark.error;
      envoyees++;
    } catch (err) {
      log.error({ err, salonId: s.id }, 'bilan du soir');
    }
  }
  return envoyees;
}
