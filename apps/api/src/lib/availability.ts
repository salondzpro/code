/**
 * « Prochaines disponibilités » des cartes marketplace : MATIN / APRÈS-MIDI (3 créneaux réellement libres par
 * période) du premier jour disponible (aujourd'hui, sinon demain, sinon le prochain jour ouvert et non complet), calculés en un seul
 * appel SQL pour toute la page (`next_slots_many`, migration 0022). Revalidés à la réservation (SQL).
 */
import { toLocalDateKey } from '@salondz/constants';
import type { SalonSummary } from '@salondz/types';
import { db } from './supabase';

export const NEXT_SLOTS_DAYS = 7;
/** Créneaux par période (MATIN / APRÈS-MIDI) sur la carte. */
export const NEXT_SLOTS_LIMIT = 3;
/** Photos par carte (carrousel). */
export const CARD_PHOTOS = 5;

export async function attachNextSlots(
  items: SalonSummary[],
  log?: { warn: (o: unknown, msg: string) => void },
): Promise<void> {
  if (items.length === 0) return;
  // Photos de couverture (carrousel de la carte, à la Planity) : une requête pour toute la page.
  const ph = await db
    .from('salon_photos')
    .select('salon_id, url, sort_order')
    .eq('kind', 'cover')
    .in(
      'salon_id',
      items.map((s) => s.id),
    )
    .order('sort_order');
  if (ph.error) log?.warn({ err: ph.error }, 'salon_photos');
  const photosById = new Map<string, string[]>();
  for (const row of (ph.data ?? []) as { salon_id: string; url: string }[]) {
    const list = photosById.get(row.salon_id) ?? [];
    if (list.length < CARD_PHOTOS) list.push(row.url);
    photosById.set(row.salon_id, list);
  }
  for (const s of items) {
    const list = photosById.get(s.id) ?? [];
    s.photoUrls = list.length ? list : s.coverUrl ? [s.coverUrl] : [];
  }
  const r = await db.rpc('next_slots_many', {
    p_salon_ids: items.map((s) => s.id),
    p_days: NEXT_SLOTS_DAYS,
    p_limit: NEXT_SLOTS_LIMIT,
  });
  if (r.error) {
    log?.warn({ err: r.error }, 'next_slots_many');
    return;
  }
  const today = toLocalDateKey();
  const byId = new Map(
    (
      r.data as {
        salon_id: string;
        day: string;
        slots: string[];
        morning: string[];
        afternoon: string[];
      }[]
    ).map((row) => [row.salon_id, row]),
  );
  for (const s of items) {
    const row = byId.get(s.id);
    s.nextAvailable = row
      ? {
          date: row.day,
          slots: row.slots,
          morning: row.morning ?? [],
          afternoon: row.afternoon ?? [],
        }
      : null;
    s.nextSlots = row && row.day === today ? row.slots : [];
  }
}
