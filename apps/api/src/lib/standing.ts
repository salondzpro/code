/**
 * Règles anti-abus côté client : trop d'annulations (au-delà du seuil toléré) ou d'absences récentes → réservation en ligne suspendue
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

/**
 * Qui est concerné : un compte, un numéro, ou les deux. Un rendez-vous pris POUR
 * QUELQU'UN D'AUTRE qui n'a pas encore de compte n'a pas de `client_id` : son historique
 * ne se lit alors que par le numéro, sinon ses annulations ne compteraient pour personne.
 */
export type ClientRef = { id?: string | null; phone?: string | null };

/** Filtre « ce compte OU ce numéro » pour PostgREST (à passer à `.or()`). */
export function clientFilter(ref: ClientRef): string {
  return [ref.id ? `client_id.eq.${ref.id}` : null, ref.phone ? `client_phone.eq.${ref.phone}` : null]
    .filter(Boolean)
    .join(',');
}

/**
 * La même identité, mais comme TERME imbriquable dans un `and(...)`. Deux appels `.or()`
 * sur une même requête ne se combinent pas de façon fiable : quand il faut croiser
 * l'identité avec une autre alternative (absence OU annulation tardive), il faut une
 * seule expression, d'où l'imbrication.
 */
function identTerm(ref: ClientRef): string {
  const f = clientFilter(ref);
  return f.includes(',') ? `or(${f})` : f;
}

export async function clientStanding(ref: ClientRef | string, now = Date.now()): Promise<ClientStanding> {
  const who: ClientRef = typeof ref === 'string' ? { id: ref } : ref;
  const mine = clientFilter(who);
  // Ni compte ni numéro : rien à reprocher à personne.
  if (!mine) return { cancellations: 0, noShows: 0, suspendedUntil: null };
  const [cancels, noShows] = await Promise.all([
    db
      .from('bookings')
      .select('cancelled_at')
      .or(mine)
      .eq('status', 'cancelled')
      .eq('cancelled_by', 'client')
      .gte('cancelled_at', new Date(now - CANCEL_ABUSE_WINDOW_DAYS * DAY).toISOString())
      .order('cancelled_at', { ascending: false }),
    db
      .from('bookings')
      .select('starts_at')
      .or(
        `and(${identTerm(who)},status.eq.no_show),and(${identTerm(who)},status.eq.cancelled,cancellation_kind.eq.late)`,
      )
      .gte('starts_at', new Date(now - NO_SHOW_ABUSE_WINDOW_DAYS * DAY).toISOString())
      .order('starts_at', { ascending: false }),
  ]);
  if (cancels.error) throw cancels.error;
  if (noShows.error) throw noShows.error;
  const c = (cancels.data ?? []) as { cancelled_at: string }[];
  const n = (noShows.data ?? []) as { starts_at: string }[];
  let until: number | null = null;
  // Les CANCEL_ABUSE_MAX premières annulations sont tolérées : la suspension ne démarre qu'au-delà (`>`).
  if (c.length > CANCEL_ABUSE_MAX && c[0]) until = Math.max(until ?? 0, new Date(c[0].cancelled_at).getTime() + CANCEL_ABUSE_BLOCK_DAYS * DAY);
  if (n.length >= NO_SHOW_ABUSE_MAX && n[0]) until = Math.max(until ?? 0, new Date(n[0].starts_at).getTime() + NO_SHOW_ABUSE_BLOCK_DAYS * DAY);
  return { cancellations: c.length, noShows: n.length, suspendedUntil: until && until > now ? new Date(until).toISOString() : null };
}
