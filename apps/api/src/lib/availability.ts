/**
 * Grille « Matin / Après-midi » des cartes marketplace (style Planity) : premier créneau libre par moment
 * pour les 7 prochains jours (le client n'en montre que 3 ouverts), un seul appel SQL pour toute la page.
 */
import type { PeriodDay, SalonSummary } from '@salondz/types';
import { db } from './supabase';

export const PERIOD_DAYS = 7;

export async function attachPeriodAvailability(items: SalonSummary[], log?: { warn: (o: unknown, msg: string) => void }): Promise<void> {
  for (const s of items) s.periods = [];
  if (items.length === 0) return;
  const r = await db.rpc('period_availability', { p_salon_ids: items.map((s) => s.id), p_days: PERIOD_DAYS });
  if (r.error) {
    log?.warn({ err: r.error }, 'period_availability');
    return;
  }
  const byId = new Map((r.data as { salon_id: string; periods: PeriodDay[] }[]).map((row) => [row.salon_id, row.periods]));
  for (const s of items) s.periods = byId.get(s.id) ?? [];
}
