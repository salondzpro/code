/**
 * Règles anti-abus côté client : trop d'annulations ou d'absences récentes → réservation en ligne suspendue
 * quelques jours (constantes dans packages/constants/src/booking.ts). Une seule source pour l'API (refus à la
 * création) et pour l'écran client (avertissement dans la feuille d'annulation, compteur dans /me).
 */
import {
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CANCEL_ABUSE_WINDOW_DAYS,
  NO_SHOW_ABUSE_BLOCK_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
} from '@salondz/constants';
import type { ClientStanding } from '@salondz/types';
import { db } from './supabase';

const DAY = 86_400_000;

export async function clientStanding(clientId: string, now = Date.now()): Promise<ClientStanding> {
  const [cancels, noShows] = await Promise.all([
    db
      .from('bookings')
      .select('cancelled_at')
      .eq('client_id', clientId)
      .eq('status', 'cancelled')
      .eq('cancelled_by', 'client')
      .gte('cancelled_at', new Date(now - CANCEL_ABUSE_WINDOW_DAYS * DAY).toISOString())
      .order('cancelled_at', { ascending: false }),
    db
      .from('bookings')
      .select('starts_at')
      .eq('client_id', clientId)
      .eq('status', 'no_show')
      .gte('starts_at', new Date(now - NO_SHOW_ABUSE_WINDOW_DAYS * DAY).toISOString())
      .order('starts_at', { ascending: false }),
  ]);
  if (cancels.error) throw cancels.error;
  if (noShows.error) throw noShows.error;
  const c = (cancels.data ?? []) as { cancelled_at: string }[];
  const n = (noShows.data ?? []) as { starts_at: string }[];
  let until: number | null = null;
  if (c.length >= CANCEL_ABUSE_MAX && c[0]) until = Math.max(until ?? 0, new Date(c[0].cancelled_at).getTime() + CANCEL_ABUSE_BLOCK_DAYS * DAY);
  if (n.length >= NO_SHOW_ABUSE_MAX && n[0]) until = Math.max(until ?? 0, new Date(n[0].starts_at).getTime() + NO_SHOW_ABUSE_BLOCK_DAYS * DAY);
  return { cancellations: c.length, noShows: n.length, suspendedUntil: until && until > now ? new Date(until).toISOString() : null };
}
