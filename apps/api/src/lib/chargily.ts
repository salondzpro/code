/**
 * PAIEMENT DES ABONNEMENTS PAR CHARGILY PAY V2 (26 nov. 2026, demande du propriétaire).
 * Sert UNIQUEMENT à payer l'abonnement d'un professionnel (Pro, Max) par carte CIB ou Edahabia.
 *
 * Règles de sécurité tenues ici :
 *   - le MONTANT et la DURÉE sont calculés par le serveur (`planPrice`), jamais lus du navigateur ;
 *   - la clé secrète ne quitte jamais l'API (`CHARGILY_SECRET_KEY`, variable Render) ; son préfixe dit
 *     le mode : `test_sk_` → environnement de test, sinon production ;
 *   - un webhook n'est cru que SIGNÉ (en-tête `signature` = HMAC-SHA256 hexadécimal du corps BRUT avec
 *     la clé secrète, comparaison à temps constant) ET confirmé par une relecture du paiement chez
 *     Chargily (statut `paid`, même montant, dinars, même mode) ;
 *   - l'abonnement n'est prolongé qu'au passage `pending → paid`, fait une seule fois en base : un
 *     webhook rejoué, ou la vérification de l'écran de retour arrivée en même temps, ne prolonge pas
 *     deux fois.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { PLANS, PLAN_PROMO_END, type PlanId } from '@salondz/constants';
import { config } from '../config';
import { db } from './supabase';
import { AppError } from './errors';
import { readPlan, writePlan } from './plans';

const KEY = () => config.CHARGILY_SECRET_KEY ?? '';
export const chargilyReady = () => KEY().length > 10;
const isTest = () => KEY().startsWith('test_');

/**
 * MODE TEST = ADMINISTRATEURS SEULEMENT (rétabli le 26 nov. 2026 au soir, décision du propriétaire
 * avant le lancement public). Avec la clé de test, la page de Chargily « paie » sans argent réel :
 * ouverte à tous, elle donnerait Pro ou Max gratuitement à n'importe quel professionnel. Tant que la
 * clé de PRODUCTION n'est pas posée, seul un administrateur actif peut lancer un paiement (pour
 * essayer le parcours) ; les pros gardent le bouton WhatsApp. Clé de production posée → tout le monde.
 * (Du 26 nov. après-midi au soir, le paiement de test était ouvert à tous à la demande du propriétaire.)
 */
export async function paymentOpenTo(userId: string): Promise<boolean> {
  if (!chargilyReady()) return false;
  if (!isTest()) return true;
  const admin = await db.from('platform_admins').select('user_id').eq('user_id', userId).is('disabled_at', null).maybeSingle();
  return !!admin.data;
}
const BASE = () => (isTest() ? 'https://pay.chargily.net/test/api/v2' : 'https://pay.chargily.net/api/v2');

export interface ChargilyCheckout {
  id: string;
  livemode: boolean | string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'expired' | string;
  metadata: Record<string, unknown> | null;
  checkout_url?: string;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`${BASE()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const j = (await r.json().catch(() => null)) as T | { message?: string } | null;
    if (!r.ok) throw new Error(`Chargily ${r.status} ${(j as { message?: string } | null)?.message ?? ''}`.trim());
    return j as T;
  } finally {
    clearTimeout(t);
  }
}

/** Vrai si l'en-tête `signature` est bien le HMAC du corps brut avec notre clé secrète. */
export function signatureValide(raw: Buffer, signature: string | undefined): boolean {
  if (!signature || !chargilyReady()) return false;
  const attendu = createHmac('sha256', KEY()).update(raw).digest('hex');
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ------------------------------------------------------------------ Prix
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());

/**
 * Prix d'un abonnement, en dinars. Tarif de lancement si l'on paie avant la fin de l'offre, ou « à vie »
 * pour un salon qui a déjà payé une fois au tarif de lancement ; 12 mois = 10 mois payés.
 */
export async function planPrice(salonId: string, plan: Exclude<PlanId, 'free'>, months: 1 | 12): Promise<number> {
  const def = PLANS.find((p) => p.id === plan)!;
  let lancement = today() <= PLAN_PROMO_END;
  if (!lancement) {
    const deja = await db
      .from('plan_payments')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .eq('status', 'paid')
      .lte('paid_at', `${PLAN_PROMO_END}T23:59:59+01:00`);
    lancement = (deja.count ?? 0) > 0;
  }
  if (months === 12) return lancement ? def.yearly : def.price * 10;
  return lancement ? def.promo : def.price;
}

// ------------------------------------------------------------------ Paiement
export async function createPlanCheckout(
  log: FastifyBaseLogger,
  p: { salonId: string; userId: string; plan: Exclude<PlanId, 'free'>; months: 1 | 12; locale: 'fr' | 'ar' | 'en' },
): Promise<{ paymentId: string; checkoutUrl: string; amount: number }> {
  if (!(await paymentOpenTo(p.userId))) throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Le paiement en ligne n’est pas encore disponible. Contactez-nous sur WhatsApp.');
  const amount = await planPrice(p.salonId, p.plan, p.months);
  const ins = await db
    .from('plan_payments')
    .insert({ salon_id: p.salonId, created_by: p.userId, plan: p.plan, months: p.months, amount_da: amount, livemode: !isTest() })
    .select('id')
    .single();
  if (ins.error) throw ins.error;
  const id = (ins.data as { id: string }).id;
  const nom = PLANS.find((x) => x.id === p.plan)!.name;
  const retour = `${config.webUrl}/pro/abonnement?paiement=${id}`;
  try {
    const c = await call<ChargilyCheckout>('POST', '/checkouts', {
      amount,
      currency: 'dzd',
      success_url: retour,
      failure_url: `${retour}&echec=1`,
      webhook_endpoint: `${config.API_PUBLIC_URL ?? 'https://api.salondz.com'}/v1/webhooks/chargily`,
      description: `Salon DZ ${nom} · ${p.months === 12 ? '12 mois' : '1 mois'}`,
      locale: p.locale,
      chargily_pay_fees_allocation: 'merchant',
      metadata: { payment_id: id, salon_id: p.salonId },
    });
    if (!c.checkout_url) throw new Error('checkout_url absent');
    const up = await db.from('plan_payments').update({ chargily_checkout_id: c.id, updated_at: new Date().toISOString() }).eq('id', id);
    if (up.error) throw up.error;
    return { paymentId: id, checkoutUrl: c.checkout_url, amount };
  } catch (err) {
    log.error({ err }, 'chargily : création du paiement');
    await db.from('plan_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id);
    throw new AppError(502, 'PAYMENT_UNAVAILABLE', 'Le service de paiement ne répond pas. Réessayez dans un instant.');
  }
}

const addMonths = (dateKey: string, n: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const x = new Date(Date.UTC(y, m - 1 + n, d));
  // 31 janvier + 1 mois : le dernier jour de février, pas le 3 mars.
  if (x.getUTCDate() !== d) x.setUTCDate(0);
  return x.toISOString().slice(0, 10);
};

/**
 * Relit un paiement chez Chargily et en tire les conséquences. Seule voie qui prolonge un abonnement :
 * appelée par le webhook signé ET par l'écran de retour (filet si le webhook se perd).
 */
export async function reconcilePayment(log: FastifyBaseLogger, checkoutId: string, eventId: string | null = null): Promise<void> {
  const row = await db.from('plan_payments').select('*').eq('chargily_checkout_id', checkoutId).maybeSingle();
  if (row.error) throw row.error;
  const pay = row.data as {
    id: string; salon_id: string; plan: 'pro' | 'salon'; months: number; amount_da: number; livemode: boolean; status: string;
  } | null;
  if (!pay) {
    log.warn({ checkoutId }, 'chargily : paiement inconnu');
    return;
  }
  if (pay.status !== 'pending') return;
  const c = await call<ChargilyCheckout>('GET', `/checkouts/${encodeURIComponent(checkoutId)}`);
  const live = c.livemode === true || c.livemode === 'true';
  const now = new Date().toISOString();
  if (c.status === 'paid') {
    if (Number(c.amount) !== pay.amount_da || String(c.currency).toLowerCase() !== 'dzd' || live !== pay.livemode) {
      log.error({ checkoutId, attendu: pay.amount_da, recu: c.amount, live }, 'chargily : paiement NON CONFORME, abonnement non prolongé');
      return;
    }
    // Passage pending → paid UNE seule fois (concurrence webhook / écran de retour).
    const won = await db
      .from('plan_payments')
      .update({ status: 'paid', paid_at: now, updated_at: now, last_event_id: eventId })
      .eq('id', pay.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (won.error) throw won.error;
    if (!won.data) return;
    const cur = await readPlan(pay.salon_id);
    const jour = today();
    const depart = cur.plan === pay.plan && cur.until && cur.until >= jour ? cur.until : jour;
    const until = addMonths(depart, pay.months);
    await writePlan(pay.salon_id, { plan: pay.plan, until, note: `Payé en ligne (Chargily${pay.livemode ? '' : ', TEST sans argent réel'}) · ${pay.amount_da} DA · ${pay.months} mois` });
    await db.from('plan_payments').update({ plan_until: until }).eq('id', pay.id);
    log.info({ salonId: pay.salon_id, plan: pay.plan, until }, 'chargily : abonnement prolongé');
    return;
  }
  if (c.status === 'failed' || c.status === 'canceled' || c.status === 'expired') {
    await db.from('plan_payments').update({ status: c.status, updated_at: now, last_event_id: eventId }).eq('id', pay.id).eq('status', 'pending');
  }
}

/** État d'un paiement pour l'écran de retour (relit Chargily s'il est encore en attente). */
export async function paymentStatus(log: FastifyBaseLogger, salonId: string, paymentId: string) {
  const r = await db.from('plan_payments').select('id, salon_id, plan, months, amount_da, status, plan_until, chargily_checkout_id').eq('id', paymentId).maybeSingle();
  if (r.error) throw r.error;
  const p = r.data as { id: string; salon_id: string; plan: string; months: number; amount_da: number; status: string; plan_until: string | null; chargily_checkout_id: string | null } | null;
  if (!p || p.salon_id !== salonId) return null;
  if (p.status === 'pending' && p.chargily_checkout_id) {
    await reconcilePayment(log, p.chargily_checkout_id).catch((err) => log.error({ err }, 'chargily : relecture'));
    const again = await db.from('plan_payments').select('status, plan_until').eq('id', paymentId).single();
    if (!again.error) Object.assign(p, again.data);
  }
  return { id: p.id, plan: p.plan, months: p.months, amount: p.amount_da, status: p.status, until: p.plan_until };
}
