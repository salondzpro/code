/**
 * PROMOTIONS SUR LES PRESTATIONS et CRÉDIT CLIENT (18 nov. 2026) — règles et types dans
 * `packages/constants/src/promos.ts`. Tout vit dans `app_settings`, sans migration :
 *   - `service_promos:<salon>`          la liste des promotions du salon ;
 *   - `credit:<salon>:<clé client>`     le dossier de crédit d'un client chez ce salon.
 * La clé client est celle de la fiche (`client_key` : le numéro s'il existe). Le dossier garde aussi
 * l'identifiant du compte, pour geler ce compte tant qu'un solde reste dû.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import {
  PROMO_MAX_PER_SALON,
  creditBalance,
  formatDA,
  promoActive,
  promoDiscount,
  promoLabel,
  type ClientCredit,
  type CreditFile,
  type CreditKind,
  type SalonCreditRow,
  type SalonPromos,
  type ServicePromo,
} from '@salondz/constants';
import { db } from './supabase';
import { dispatchPendingPush } from './push';

async function getJson(key: string): Promise<unknown> {
  const res = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (res.error || !res.data?.value) return null;
  try {
    return JSON.parse(res.data.value as string);
  } catch {
    return null;
  }
}
async function setJson(key: string, v: unknown): Promise<void> {
  const res = await db.from('app_settings').upsert({ key, value: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

// ------------------------------------------------------------------ Promotions
const promoKey = (salonId: string) => `service_promos:${salonId}`;

const clean = (x: unknown): ServicePromo[] =>
  (Array.isArray(x) ? x : [])
    .map((p) => p as Partial<ServicePromo>)
    .filter((p) => Array.isArray(p.serviceIds) && p.serviceIds.length > 0 && typeof p.endsAt === 'string' && typeof p.startsAt === 'string')
    .map((p) => ({
      id: String(p.id ?? randomUUID()),
      serviceIds: p.serviceIds!.map(String).slice(0, 50),
      kind: p.kind === 'amount' ? ('amount' as const) : ('percent' as const),
      value: p.kind === 'amount' ? Math.min(100_000, Math.max(50, Math.round(Number(p.value) || 0))) : Math.min(90, Math.max(5, Math.round(Number(p.value) || 0))),
      startsAt: p.startsAt!,
      endsAt: p.endsAt!,
    }));

export const readPromos = async (salonId: string): Promise<ServicePromo[]> => clean(await getJson(promoKey(salonId)));

/** Enregistre la liste du pro ; les promotions finies depuis plus de 30 jours sont retirées. */
export async function writePromos(salonId: string, list: Omit<ServicePromo, 'id'>[] & { id?: string }[]): Promise<ServicePromo[]> {
  const old = Date.now() - 30 * 86_400_000;
  const next = clean(list).filter((p) => new Date(p.endsAt).getTime() > old).slice(0, PROMO_MAX_PER_SALON);
  await setJson(promoKey(salonId), next);
  return next;
}

/** Promotions en cours de tous les salons (place de marché, page du salon). */
export async function activePromos(): Promise<SalonPromos[]> {
  const res = await db.from('app_settings').select('key, value').like('key', 'service_promos:%').limit(5000);
  if (res.error) throw res.error;
  const now = new Date();
  const out: SalonPromos[] = [];
  for (const row of res.data ?? []) {
    try {
      const promos = clean(JSON.parse(row.value as string)).filter((p) => promoActive(p, now));
      if (promos.length) out.push({ salonId: (row.key as string).slice('service_promos:'.length), promos });
    } catch {
      /* ignoré */
    }
  }
  return out;
}

/** Réduction promotionnelle d'un rendez-vous : promotions actives au moment de la RÉSERVATION. */
export async function bookingPromo(b: { salonId: string; createdAt: string; items?: { serviceId: string | null; priceDa: number }[] | null; serviceId: string | null; priceDa: number }) {
  const promos = await readPromos(b.salonId);
  if (promos.length === 0) return null;
  const lines = b.items?.length ? b.items : [{ serviceId: b.serviceId, priceDa: b.priceDa }];
  const at = new Date(b.createdAt);
  const discount = promoDiscount(lines, promos, at);
  if (discount <= 0) return null;
  const used = promos.find((p) => promoActive(p, at) && lines.some((l) => l.serviceId && p.serviceIds.includes(l.serviceId)));
  return { label: used ? promoLabel(used) : null, discount };
}

// ------------------------------------------------------------------ Crédit
const creditKey = (salonId: string, clientKey: string) => `credit:${salonId}:${clientKey}`;

export async function readCredit(salonId: string, client: { clientKey: string; clientId: string | null; name: string; phone: string | null }): Promise<CreditFile> {
  const v = (await getJson(creditKey(salonId, client.clientKey))) as Partial<CreditFile> | null;
  return {
    clientKey: client.clientKey,
    clientId: client.clientId ?? v?.clientId ?? null,
    name: client.name,
    phone: client.phone ?? v?.phone ?? null,
    entries: Array.isArray(v?.entries) ? v!.entries : [],
  };
}

/** Ajoute une somme due ou un encaissement ; le client avec compte est prévenu (transparence). */
export async function addCredit(
  log: FastifyBaseLogger,
  salon: { id: string; name: string },
  client: { clientKey: string; clientId: string | null; name: string; phone: string | null },
  entry: { kind: CreditKind; amount: number; note?: string | null },
): Promise<CreditFile> {
  const file = await readCredit(salon.id, client);
  file.entries = [...file.entries, { id: randomUUID(), kind: entry.kind, amount: Math.round(entry.amount), note: entry.note?.trim() || null, at: new Date().toISOString() }];
  await setJson(creditKey(salon.id, client.clientKey), file);
  if (client.clientId) {
    const balance = creditBalance(file.entries);
    const title = entry.kind === 'debt' ? `Crédit enregistré chez ${salon.name}` : `Paiement reçu par ${salon.name}`;
    const body =
      entry.kind === 'debt'
        ? `${formatDA(entry.amount)} à régler. Reste dû : ${formatDA(balance)}.`
        : balance > 0
          ? `${formatDA(entry.amount)} reçus. Reste dû : ${formatDA(balance)}.`
          : `${formatDA(entry.amount)} reçus. Votre crédit est soldé, merci.`;
    const ins = await db.from('notifications').insert({ user_id: client.clientId, type: 'booking_completed', title, body, data: { kind: 'credit', salonId: salon.id, url: '/profil' } });
    if (ins.error) log.warn({ err: ins.error }, 'credit notify');
    else void dispatchPendingPush(log).catch(() => undefined);
  }
  return file;
}

/** Retire une ligne saisie par erreur. */
export async function removeCreditEntry(salonId: string, client: { clientKey: string; clientId: string | null; name: string; phone: string | null }, entryId: string): Promise<CreditFile> {
  const file = await readCredit(salonId, client);
  file.entries = file.entries.filter((e) => e.id !== entryId);
  await setJson(creditKey(salonId, client.clientKey), file);
  return file;
}

/** Côté pro : les crédits ouverts du salon, le plus gros d'abord. */
export async function salonCredits(salonId: string): Promise<SalonCreditRow[]> {
  const res = await db.from('app_settings').select('value').like('key', `credit:${salonId}:%`).limit(2000);
  if (res.error) throw res.error;
  const rows: SalonCreditRow[] = [];
  for (const r of res.data ?? []) {
    try {
      const f = JSON.parse(r.value as string) as CreditFile;
      const balance = creditBalance(f.entries ?? []);
      if (balance > 0) rows.push({ clientKey: f.clientKey, name: f.name, phone: f.phone, balance, lastAt: f.entries.at(-1)?.at ?? null });
    } catch {
      /* ignoré */
    }
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

/** Côté client : ses crédits ouverts, tous salons confondus (par compte ET par numéro). */
export async function clientCredits(userId: string, phone: string | null): Promise<ClientCredit[]> {
  const byId = await db.from('app_settings').select('key, value').like('key', 'credit:%').like('value', `%"clientId":"${userId}"%`).limit(200);
  if (byId.error) throw byId.error;
  const rows = [...(byId.data ?? [])];
  if (phone) {
    const byPhone = await db.from('app_settings').select('key, value').like('key', `credit:%:${phone}`).limit(200);
    if (byPhone.error) throw byPhone.error;
    for (const r of byPhone.data ?? []) if (!rows.some((x) => x.key === r.key)) rows.push(r);
  }
  const open: { salonId: string; balance: number }[] = [];
  for (const r of rows) {
    try {
      const f = JSON.parse(r.value as string) as CreditFile;
      const balance = creditBalance(f.entries ?? []);
      if (balance > 0) open.push({ salonId: (r.key as string).split(':')[1]!, balance });
    } catch {
      /* ignoré */
    }
  }
  if (open.length === 0) return [];
  const salons = await db.from('salons').select('id, name').in('id', open.map((o) => o.salonId));
  if (salons.error) throw salons.error;
  return open.map((o) => ({ ...o, salonName: (salons.data ?? []).find((s) => s.id === o.salonId)?.name ?? 'Salon' }));
}

