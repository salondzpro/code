/**
 * Abonnement d'un salon (20 nov. 2026) — sans migration : `app_settings` `plan:<salon>` =
 * `{ plan, until, note, updatedAt }`. Sans ligne, le salon est en Découverte (`free`).
 * Seul le super admin l'écrit (`PUT /v1/admin/salons/:id/plan`) ; le pro le lit (`GET /v1/pro/plan`).
 */
import { PLAN_TEAM_MAX, type PlanId } from '@salondz/constants';
import { db } from './supabase';
import { AppError } from './errors';

export interface SalonPlan {
  plan: PlanId;
  /** Fin de l'abonnement payé (AAAA-MM-JJ), ou null = sans échéance. */
  until: string | null;
  note: string | null;
  updatedAt: string | null;
}

const FREE: SalonPlan = { plan: 'free', until: null, note: null, updatedAt: null };
const key = (salonId: string) => `plan:${salonId}`;

function parse(v: unknown): SalonPlan {
  try {
    const o = JSON.parse(String(v)) as Partial<SalonPlan>;
    const plan = o.plan === 'pro' || o.plan === 'salon' ? o.plan : 'free';
    const until = typeof o.until === 'string' ? o.until : null;
    // Échu : retour en Découverte (le super admin renouvelle).
    if (plan !== 'free' && until && until < new Date().toISOString().slice(0, 10)) return { ...FREE, note: o.note ?? null, updatedAt: o.updatedAt ?? null };
    return { plan, until, note: o.note ?? null, updatedAt: o.updatedAt ?? null };
  } catch {
    return FREE;
  }
}

export async function readPlan(salonId: string): Promise<SalonPlan> {
  const r = await db.from('app_settings').select('value').eq('key', key(salonId)).maybeSingle();
  if (r.error || !r.data) return FREE;
  return parse(r.data.value);
}

/** Tous les abonnements posés, par salon. */
export async function readAllPlans(): Promise<Map<string, SalonPlan>> {
  const out = new Map<string, SalonPlan>();
  const r = await db.from('app_settings').select('key, value').like('key', 'plan:%');
  if (r.error) throw r.error;
  for (const row of r.data ?? []) out.set(String(row.key).slice(5), parse(row.value));
  return out;
}

export async function writePlan(salonId: string, input: { plan: PlanId; until: string | null; note: string | null }): Promise<SalonPlan> {
  const v: SalonPlan = { plan: input.plan, until: input.plan === 'free' ? null : input.until, note: input.note, updatedAt: new Date().toISOString() };
  const r = await db.from('app_settings').upsert({ key: key(salonId), value: JSON.stringify(v), updated_at: v.updatedAt }, { onConflict: 'key' });
  if (r.error) throw r.error;
  return v;
}

// ------------------------------------------------------------------------------------------------
// CE QUE LES OFFRES PROMETTENT, APPLIQUÉ PAR LE SERVEUR (20 nov. 2026, demande du propriétaire :
// « que ce que les offres promettent soit bien réel dans les algorithmes, les API et la plateforme »).
//   Gratuit : tout l'essentiel, réservations ILLIMITÉES, une personne.
//   Pro     : + versement à la réservation, fidélité, promotions, crédit client ; mis en avant dans la ville.
//   Max     : + équipe (jusqu'à `PLAN_TEAM_MAX` personnes actives) ; en tête de la ville.
// ------------------------------------------------------------------------------------------------

const RANG: Record<PlanId, number> = { free: 0, pro: 1, salon: 2 };

/** Refuse un geste réservé à une offre payante (403 `PLAN_REQUIRED`, message pour l'écran). */
export async function requirePlan(salonId: string, min: 'pro' | 'salon', what: string): Promise<void> {
  const p = await readPlan(salonId);
  if (RANG[p.plan] >= RANG[min]) return;
  throw new AppError(403, 'PLAN_REQUIRED', `${what} : disponible avec l'offre ${min === 'pro' ? 'Pro' : 'Max'}.`, { plan: p.plan, required: min });
}

/** Rang d'un salon dans la place de marché : Max, puis Pro, puis Gratuit. */
export function planRank(plans: Map<string, SalonPlan>, salonId: string): number {
  return RANG[plans.get(salonId)?.plan ?? 'free'];
}

/** Nombre maximal de personnes ACTIVES dans l'équipe selon l'offre. */
export function teamMax(plan: PlanId): number {
  return plan === 'salon' ? PLAN_TEAM_MAX : 1;
}

/**
 * Retour à Gratuit : on COUPE ce que Gratuit ne comprend pas (versement, fidélité, promotions).
 * L'équipe n'est pas touchée (des rendez-vous à venir y sont rattachés) : on ne peut simplement
 * plus ajouter ni réactiver de personne. Les crédits déjà notés restent lisibles.
 */
export async function enforceFreeLimits(salonId: string): Promise<void> {
  const s = await db.from('salons').update({ deposit_mode: 'off', deposit_value: 0 }).eq('id', salonId);
  if (s.error) throw s.error;
  const l = await db.from('app_settings').select('value').eq('key', `loyalty:${salonId}`).maybeSingle();
  if (!l.error && l.data?.value) {
    try {
      const v = JSON.parse(String(l.data.value)) as Record<string, unknown>;
      if (v.enabled) {
        const w = await db.from('app_settings').update({ value: JSON.stringify({ ...v, enabled: false }), updated_at: new Date().toISOString() }).eq('key', `loyalty:${salonId}`);
        if (w.error) throw w.error;
      }
    } catch {
      /* réglage illisible : laissé tel quel, il n'est de toute façon pas servi (filtre public) */
    }
  }
  const p = await db.from('app_settings').update({ value: '[]', updated_at: new Date().toISOString() }).eq('key', `service_promos:${salonId}`);
  if (p.error) throw p.error;
}

/** Cron : les abonnements échus repassent en Gratuit, et Gratuit est appliqué. Rend le nombre traité. */
export async function expirePlans(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const r = await db.from('app_settings').select('key, value').like('key', 'plan:%');
  if (r.error) throw r.error;
  let n = 0;
  for (const row of r.data ?? []) {
    try {
      const o = JSON.parse(String(row.value)) as Partial<SalonPlan>;
      if ((o.plan === 'pro' || o.plan === 'salon') && typeof o.until === 'string' && o.until < today) {
        const salonId = String(row.key).slice(5);
        await writePlan(salonId, { plan: 'free', until: null, note: `Échu le ${o.until}` });
        await enforceFreeLimits(salonId);
        n++;
      }
    } catch {
      /* ligne illisible : ignorée */
    }
  }
  return n;
}
