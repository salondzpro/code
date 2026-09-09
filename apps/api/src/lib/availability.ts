/**
 * « Prochaines disponibilités » des cartes marketplace : les 5 premiers créneaux réellement libres du premier
 * jour disponible (aujourd'hui, sinon demain, sinon le prochain jour ouvert et non complet), calculés en un seul
 * appel SQL pour toute la page (`next_slots_many`, migration 0022). Revalidés à la réservation (SQL).
 */
import { toLocalDateKey } from '@salondz/constants';
import type { SalonSummary } from '@salondz/types';
import { db } from './supabase';

export const NEXT_SLOTS_DAYS = 7;
export const NEXT_SLOTS_LIMIT = 5;

export async function attachNextSlots(items: SalonSummary[], log?: { warn: (o: unknown, msg: string) => void }): Promise<void> {
  if (items.length === 0) return;
  const r = await db.rpc('next_slots_many', { p_salon_ids: items.map((s) => s.id), p_days: NEXT_SLOTS_DAYS, p_limit: NEXT_SLOTS_LIMIT });
  if (r.error) {
    log?.warn({ err: r.error }, 'next_slots_many');
    return;
  }
  const today = toLocalDateKey();
  const byId = new Map((r.data as { salon_id: string; day: string; slots: string[] }[]).map((row) => [row.salon_id, row]));
  for (const s of items) {
    const row = byId.get(s.id);
    s.nextAvailable = row ? { date: row.day, slots: row.slots } : null;
    s.nextSlots = row && row.day === today ? row.slots : [];
  }
}
