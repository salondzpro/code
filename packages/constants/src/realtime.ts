/**
 * Réglages du temps réel (Supabase Realtime), partagés par le web et le mobile.
 *
 * Principe : on ÉCOUTE, on ne sonde jamais. Aucun intervalle périodique, aucune requête
 * tant que la base ne change pas. Un abonnement ouvert coûte une connexion, pas du trafic.
 *
 * Le seul moment où l'on redemande des données sans événement, c'est pour RÉCONCILIER après
 * un trou de réseau : reconnexion du canal, ou retour au premier plan. C'est borné par
 * REALTIME_RESYNC_MIN_MS pour qu'un pro qui bascule d'onglet en boucle ne déclenche pas
 * une requête à chaque fois.
 */

/** Plusieurs événements rapprochés (réservation multi-prestations, mise à jour en cascade) → une seule invalidation. */
export const REALTIME_DEBOUNCE_MS = 300;

/** Reconnexion : délai initial, puis doublement avec gigue jusqu'au plafond. */
export const REALTIME_RETRY_BASE_MS = 1_000;
export const REALTIME_RETRY_MAX_MS = 30_000;

/** Deux réconciliations ne peuvent pas se suivre à moins de cet intervalle. */
export const REALTIME_RESYNC_MIN_MS = 10_000;

/**
 * Débit d'événements accepté par client. Le filtre serveur (`salon_id=eq.…`) limite déjà chaque
 * pro à son salon ; ce plafond protège l'appareil d'une rafale (import massif, correction en lot).
 */
export const REALTIME_EVENTS_PER_SECOND = 5;

/** Délai de reconnexion avec gigue, pour ne pas faire revenir tous les clients à la même seconde. */
export function realtimeRetryDelay(attempt: number): number {
  const base = Math.min(REALTIME_RETRY_BASE_MS * 2 ** Math.max(0, attempt), REALTIME_RETRY_MAX_MS);
  return Math.round(base * (0.7 + Math.random() * 0.6));
}
