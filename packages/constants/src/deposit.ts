/**
 * RÉSERVATION AVEC VERSEMENT (14 nov. 2026, migration 0057).
 *
 * Le professionnel peut exiger un versement pour réserver en ligne : un montant FIXE en DA ou un
 * POURCENTAGE du total, pour toutes les clientes ou les nouvelles seulement. La cliente vire la somme
 * sur le compte indiqué (CCP, banque, BaridiMob), joint la capture ou le PDF du reçu, et le salon
 * valide : c'est cette validation qui confirme le rendez-vous.
 *
 * Le calcul fait foi en SQL (`create_booking_multi`) ; `depositFor` en est la copie EXACTE, pour
 * l'annoncer avant de réserver. Toute modification se fait aux deux endroits.
 */
export const DEPOSIT_MODES = ['off', 'fixed', 'percent'] as const;
export type DepositMode = (typeof DEPOSIT_MODES)[number];

export const DEPOSIT_SCOPES = ['all', 'new'] as const;
export type DepositScope = (typeof DEPOSIT_SCOPES)[number];

export const DEPOSIT_METHODS = ['ccp', 'bank', 'baridimob'] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_STATUSES = ['awaiting', 'submitted', 'accepted', 'rejected'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/** Pourcentages proposés d'un toucher (tout autre de 1 à 100 reste possible). */
export const DEPOSIT_PERCENT_PRESETS = [10, 20, 30, 50] as const;
/** Montants fixes proposés d'un toucher, en DA. */
export const DEPOSIT_FIXED_PRESETS = [500, 1000, 2000, 3000] as const;

/** Justificatif : images et PDF, 8 Mo au plus (mêmes limites que le seau `deposits`). */
export const DEPOSIT_PROOF_MAX_BYTES = 8 * 1024 * 1024;
export const DEPOSIT_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'] as const;

/** Montant du versement pour un total donné — même règle que la base (arrondi à la dizaine supérieure, jamais plus que le total). */
export function depositFor(totalDa: number, mode: DepositMode, value: number): number | null {
  if (mode === 'off' || !(value > 0) || !(totalDa > 0)) return null;
  const raw = mode === 'fixed' ? value : Math.ceil((totalDa * value) / 1000) * 10;
  return Math.min(totalDa, raw);
}
