/**
 * Abonnement d'un salon (20 nov. 2026) — sans migration : `app_settings` `plan:<salon>` =
 * `{ plan, until, note, updatedAt }`. Sans ligne, le salon est en Découverte (`free`).
 * Seul le super admin l'écrit (`PUT /v1/admin/salons/:id/plan`) ; le pro le lit (`GET /v1/pro/plan`).
 */
import type { PlanId } from '@salondz/constants';
import { db } from './supabase';

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
