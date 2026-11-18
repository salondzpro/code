/**
 * PROGRAMME FIDÉLITÉ (18 nov. 2026) — règles dans `packages/constants/src/loyalty.ts`.
 *
 * Tout vit dans `app_settings`, sans migration :
 *   - `loyalty:<salon>`                         le réglage du pro ;
 *   - `promo_booking:<rendez-vous>`             le code promo appliqué à un rendez-vous (et son cadeau) ;
 *   - `promo_use:<salon>:<code>:<client>`        un code ne sert qu'une fois par client.
 * La progression (passages, points) se RECALCULE à partir des rendez-vous terminés pris sur Salon DZ.
 * Tout ce qui notifie est best-effort : une erreur ici ne bloque jamais un rendez-vous.
 */
import type { FastifyBaseLogger } from 'fastify';
import {
  LOYALTY_ANNOUNCE_EVERY_DAYS,
  loyaltyCloseness,
  loyaltyCondition,
  loyaltyDiscount,
  loyaltyHeadline,
  loyaltyReward,
  loyaltyState,
  normalizeCode,
  normalizeLoyalty,
  pointsFor,
  promoValid,
  type LoyaltyCard,
  type LoyaltyClientRow,
  type LoyaltyProgram,
  type LoyaltyPublic,
  type LoyaltyVisit,
} from '@salondz/constants';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

const PREFIX = 'loyalty:';
const key = (salonId: string) => `${PREFIX}${salonId}`;

async function getSetting(k: string): Promise<unknown> {
  const res = await db.from('app_settings').select('value').eq('key', k).maybeSingle();
  if (res.error || !res.data?.value) return null;
  try {
    return JSON.parse(res.data.value as string);
  } catch {
    return null;
  }
}
async function setSetting(k: string, v: unknown): Promise<void> {
  const res = await db.from('app_settings').upsert({ key: k, value: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

export const readLoyalty = async (salonId: string): Promise<LoyaltyProgram> => normalizeLoyalty(await getSetting(key(salonId)));

export const toPublic = (salonId: string, p: LoyaltyProgram): LoyaltyPublic => ({
  salonId,
  mode: p.mode,
  threshold: p.threshold,
  rewardKind: p.rewardKind,
  rewardValue: p.rewardValue,
  minSpend: p.minSpend,
  giftMonths: p.giftMonths,
});

export type LoyaltyInput = Pick<LoyaltyProgram, 'enabled' | 'mode' | 'threshold' | 'rewardKind' | 'rewardValue' | 'minSpend' | 'giftMonths' | 'code'>;

/**
 * Enregistre le réglage du pro. Première activation : `startedAt` (les visites d'avant ne comptent
 * pas). Nouveau code : `codeSince` (sa validité part de là). Activation : annonce aux clients du salon,
 * une fois par mois au plus.
 */
export async function writeLoyalty(log: FastifyBaseLogger, salon: { id: string; name: string; slug: string }, input: LoyaltyInput) {
  const before = await readLoyalty(salon.id);
  const now = new Date().toISOString();
  const code = normalizeCode(input.code);
  const next = normalizeLoyalty({
    ...input,
    code,
    startedAt: before.startedAt ?? (input.enabled ? now : null),
    codeSince: code && code === before.code ? (before.codeSince ?? now) : code ? now : null,
    announcedAt: before.announcedAt,
  });
  let announced = 0;
  const changed = !before.enabled || before.mode !== next.mode || (next.mode === 'promo' && before.code !== next.code);
  const canAnnounce =
    next.enabled && changed && (!before.announcedAt || Date.now() - new Date(before.announcedAt).getTime() > LOYALTY_ANNOUNCE_EVERY_DAYS * 86_400_000);
  if (canAnnounce) {
    next.announcedAt = now;
    announced = await announce(log, salon, next).catch((err) => {
      log.warn({ err, salonId: salon.id }, 'loyalty announce');
      return 0;
    });
  }
  await setSetting(key(salon.id), next);
  return { ...next, announced };
}

/** Annonce aux clients qui ont déjà eu un rendez-vous dans ce salon (comptes clients seulement). */
async function announce(log: FastifyBaseLogger, salon: { id: string; name: string; slug: string }, p: LoyaltyProgram): Promise<number> {
  const res = await db.from('bookings').select('client_id').eq('salon_id', salon.id).not('client_id', 'is', null).in('status', ['confirmed', 'completed']).limit(2000);
  if (res.error) throw res.error;
  const ids = [...new Set((res.data ?? []).map((r) => r.client_id as string))];
  if (ids.length === 0) return 0;
  const clients = await db.from('profiles').select('id').in('id', ids).eq('role', 'client');
  if (clients.error) throw clients.error;
  const cond = loyaltyCondition(p);
  const title = p.mode === 'promo' ? `${salon.name} vous offre un code promo` : `${salon.name} lance sa carte fidélité`;
  const body =
    p.mode === 'promo'
      ? `Code ${p.code} : ${loyaltyReward(p)}${cond ? ` ${cond}` : ''}, en réservant sur Salon DZ.`
      : `${loyaltyHeadline(p)}${cond ? ` (${cond})` : ''} — vos visites réservées sur Salon DZ comptent.`;
  const rows = (clients.data ?? []).map((c) => ({
    user_id: c.id as string,
    type: 'booking_completed',
    title,
    body,
    data: { kind: 'loyalty', salonId: salon.id, url: `/s/${salon.slug}` },
  }));
  if (rows.length === 0) return 0;
  const ins = await db.from('notifications').insert(rows);
  if (ins.error) throw ins.error;
  void dispatchPendingPush(log).catch((err) => log.error({ err }, 'loyalty announce push'));
  return rows.length;
}

/** Visites qui comptent (terminées, prises sur Salon DZ) d'un client dans un salon. */
async function visitsOf(salonId: string, clientId: string): Promise<LoyaltyVisit[]> {
  const res = await db
    .from('bookings')
    .select('starts_at, price_da')
    .eq('salon_id', salonId)
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .eq('source', 'online')
    .order('starts_at', { ascending: true })
    .limit(500);
  if (res.error) throw res.error;
  return (res.data ?? []).map((r) => ({ at: r.starts_at as string, amount: Number(r.price_da) || 0 }));
}

/** Tous les programmes actifs (place de marché). Un code promo expiré ne s'affiche plus. */
export async function activePrograms(): Promise<LoyaltyPublic[]> {
  const res = await db.from('app_settings').select('key, value').like('key', `${PREFIX}%`).limit(5000);
  if (res.error) throw res.error;
  const out: LoyaltyPublic[] = [];
  for (const row of res.data ?? []) {
    try {
      const p = normalizeLoyalty(JSON.parse(row.value as string));
      if (p.enabled && (p.mode !== 'promo' || promoValid(p))) out.push(toPublic((row.key as string).slice(PREFIX.length), p));
    } catch {
      /* réglage illisible : ignoré */
    }
  }
  return out;
}

/** Ma carte chez un salon (page du salon, « Confirmer »). `null` sans programme à cartes. */
export async function clientProgress(salonId: string, clientId: string) {
  const p = await readLoyalty(salonId);
  if (!p.enabled || p.mode === 'promo') return null;
  return { program: toPublic(salonId, p), ...loyaltyState(p, await visitsOf(salonId, clientId)) };
}

/** Toutes mes cartes, la plus proche d'un cadeau d'abord. */
export async function clientCards(clientId: string): Promise<LoyaltyCard[]> {
  const res = await db.from('bookings').select('salon_id, starts_at, price_da').eq('client_id', clientId).eq('status', 'completed').eq('source', 'online').limit(1000);
  if (res.error) throw res.error;
  const bySalon = new Map<string, LoyaltyVisit[]>();
  for (const r of res.data ?? []) {
    const id = r.salon_id as string;
    bySalon.set(id, [...(bySalon.get(id) ?? []), { at: r.starts_at as string, amount: Number(r.price_da) || 0 }]);
  }
  if (bySalon.size === 0) return [];
  const salons = await db.from('salons').select('id, slug, name, logo_url, cover_url, city').in('id', [...bySalon.keys()]);
  if (salons.error) throw salons.error;
  const cards: LoyaltyCard[] = [];
  for (const s of salons.data ?? []) {
    const p = await readLoyalty(s.id as string);
    if (!p.enabled || p.mode === 'promo') continue;
    cards.push({
      ...loyaltyState(p, bySalon.get(s.id as string) ?? []),
      program: toPublic(s.id as string, p),
      salon: { id: s.id as string, slug: s.slug as string, name: s.name as string, logoUrl: (s.logo_url as string) ?? null, coverUrl: (s.cover_url as string) ?? null, city: (s.city as string) ?? null },
    });
  }
  return cards.sort((a, b) => loyaltyCloseness(b) - loyaltyCloseness(a));
}

/** Côté pro : les clients proches d'un cadeau (au moins 60 % du chemin, ou cadeau en attente). */
export async function proClientsClose(salonId: string): Promise<LoyaltyClientRow[]> {
  const p = await readLoyalty(salonId);
  if (!p.enabled || p.mode === 'promo') return [];
  const res = await db
    .from('bookings')
    .select('client_id, client_name, client_phone, starts_at, price_da')
    .eq('salon_id', salonId)
    .eq('status', 'completed')
    .eq('source', 'online')
    .not('client_id', 'is', null)
    .limit(5000);
  if (res.error) throw res.error;
  const byClient = new Map<string, { name: string; phone: string | null; visits: LoyaltyVisit[] }>();
  for (const r of res.data ?? []) {
    const id = r.client_id as string;
    const c = byClient.get(id) ?? { name: (r.client_name as string) ?? '', phone: (r.client_phone as string) ?? null, visits: [] };
    c.visits.push({ at: r.starts_at as string, amount: Number(r.price_da) || 0 });
    byClient.set(id, c);
  }
  const rows: LoyaltyClientRow[] = [];
  for (const [id, c] of byClient) {
    const st = loyaltyState(p, c.visits);
    if (loyaltyCloseness(st) >= 0.6) rows.push({ ...st, key: c.phone ?? id, name: c.name, phone: c.phone });
  }
  return rows.sort((a, b) => loyaltyCloseness(b) - loyaltyCloseness(a)).slice(0, 50);
}

/** Vérifie un code promo pour un client (avant de réserver). */
export async function checkPromo(salonId: string, code: string, clientId: string) {
  const p = await readLoyalty(salonId);
  const c = normalizeCode(code);
  if (!c || !promoValid(p) || p.code !== c) return { valid: false as const, reason: 'invalid' as const };
  if (await getSetting(`promo_use:${salonId}:${c}:${clientId}`)) return { valid: false as const, reason: 'used' as const };
  return { valid: true as const, program: toPublic(salonId, p) };
}

/** Après la création d'un rendez-vous avec un code : il est retenu (une fois par client). Best-effort. */
export async function applyPromo(log: FastifyBaseLogger, b: { id: string; salonId: string; clientId: string | null; priceDa: number }, code: string): Promise<void> {
  if (!b.clientId) return;
  try {
    const chk = await checkPromo(b.salonId, code, b.clientId);
    if (!chk.valid) return;
    const p = await readLoyalty(b.salonId);
    if (b.priceDa < p.minSpend) return;
    await setSetting(`promo_use:${b.salonId}:${p.code}:${b.clientId}`, { bookingId: b.id, at: new Date().toISOString() });
    await setSetting(`promo_booking:${b.id}`, { code: p.code, rewardKind: p.rewardKind, rewardValue: p.rewardValue });
  } catch (err) {
    log.warn({ err }, 'promo apply');
  }
}

/**
 * Le cadeau d'un rendez-vous à venir (fenêtre et fiche du pro, confirmation du client) : code promo
 * retenu, ou cadeau de la carte en attente et achat minimum atteint.
 */
export async function bookingReward(b: { id: string; salonId: string; clientId: string | null; source: string; startsAt: string; priceDa: number }) {
  const promo = (await getSetting(`promo_booking:${b.id}`)) as { code: string; rewardKind: 'percent' | 'amount'; rewardValue: number } | null;
  if (promo) {
    const r = { rewardKind: promo.rewardKind, rewardValue: promo.rewardValue };
    return { reward: `${loyaltyReward(r)} · code ${promo.code}`, discount: loyaltyDiscount(r, b.priceDa) };
  }
  if (!b.clientId || b.source !== 'online') return null;
  const p = await readLoyalty(b.salonId);
  if (!p.enabled || p.mode === 'promo') return null;
  const st = loyaltyState(p, await visitsOf(b.salonId, b.clientId), new Date(), b.startsAt);
  if (!st.giftAvailable || b.priceDa < p.minSpend) return null;
  return { reward: loyaltyReward(p), discount: loyaltyDiscount(p, b.priceDa) };
}

/** Après un « Terminé » : « +1 visite », « +12 points » ou « Cadeau débloqué ». Best-effort. */
export async function notifyStamp(log: FastifyBaseLogger, b: { salonId: string; clientId: string | null; source: string; priceDa: number }, salon: { name: string; slug: string }): Promise<void> {
  if (!b.clientId || b.source !== 'online') return;
  try {
    const p = await readLoyalty(b.salonId);
    if (!p.enabled || p.mode === 'promo') return;
    const visits = await visitsOf(b.salonId, b.clientId);
    const now = loyaltyState(p, visits);
    const last = visits[visits.length - 1];
    const before = last ? loyaltyState(p, visits, new Date(), last.at) : null;
    const unlocked = now.giftAvailable && !before?.giftAvailable;
    const left = p.threshold - now.progress;
    const gain = p.mode === 'points' ? `+${pointsFor(b.priceDa)} points` : '+1 visite';
    const title = unlocked ? `Cadeau débloqué chez ${salon.name}` : `${gain} chez ${salon.name}`;
    const cond = loyaltyCondition(p);
    const body = unlocked
      ? `${loyaltyReward(p)} sur votre prochaine visite${cond ? ` ${cond}` : ''}, valable ${p.giftMonths} mois.`
      : p.mode === 'points'
        ? `Encore ${left} points avant votre cadeau (${loyaltyReward(p)}).`
        : `Encore ${left} visite${left > 1 ? 's' : ''} avant votre cadeau (${loyaltyReward(p)}).`;
    const ins = await db.from('notifications').insert({ user_id: b.clientId, type: 'booking_completed', title, body, data: { kind: 'loyalty', salonId: b.salonId, url: '/fidelite' } });
    if (ins.error) throw ins.error;
    await dispatchPendingPush(log);
  } catch (err) {
    log.warn({ err }, 'loyalty stamp');
  }
}

