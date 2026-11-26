/**
 * BOUCLIER DE RÉSERVATION (26 nov. 2026, demande du propriétaire : « un client ne doit pas pouvoir
 * remplir le planning d'un professionnel ; détection des fraudes façon Uber »).
 *
 * Deux étages :
 *   1. Les LIMITES DU SALON, réglables par le pro (Règles de réservation) : nombre de prestations
 *      par rendez-vous (1 par défaut) et nombre de rendez-vous à venir par client chez lui (1 par
 *      défaut). Gardées dans `app_settings` (`booking_guard:<salon>`), appliquées par le serveur.
 *   2. Le MOTEUR DE FRAUDE de la plateforme (`apps/api/src/lib/fraud.ts`) : un score de risque à
 *      chaque tentative (vitesse, rafales depuis une même adresse, demandes en attente empilées,
 *      réserver-annuler en boucle, compte neuf, refus répétés). Au-delà d'un seuil la tentative est
 *      refusée ; au-delà d'un second, le compte est SUSPENDU de toute réservation en ligne et ses
 *      réservations de rafale sont annulées au nom de la plateforme.
 */

export interface BookingGuard {
  /** Prestations au plus dans UN rendez-vous pris en ligne. */
  maxServices: number;
  /** Rendez-vous à venir (en attente ou confirmés) au plus par client chez ce salon. */
  maxUpcoming: number;
}

export const BOOKING_GUARD_DEFAULT: BookingGuard = { maxServices: 1, maxUpcoming: 1 };
export const BOOKING_GUARD_SERVICES_CHOICES = [1, 2, 3, 4, 5] as const;
export const BOOKING_GUARD_UPCOMING_CHOICES = [1, 2, 3, 5] as const;

export function cleanBookingGuard(x: Partial<BookingGuard> | null | undefined): BookingGuard {
  const pick = (v: unknown, choices: readonly number[], d: number) => {
    const n = Math.round(Number(v));
    return choices.includes(n) ? n : d;
  };
  return {
    maxServices: pick(x?.maxServices, BOOKING_GUARD_SERVICES_CHOICES, BOOKING_GUARD_DEFAULT.maxServices),
    maxUpcoming: pick(x?.maxUpcoming, BOOKING_GUARD_UPCOMING_CHOICES, BOOKING_GUARD_DEFAULT.maxUpcoming),
  };
}

/**
 * Seuils du moteur de fraude. Score = somme des signaux ; REFUS à partir de `refuse`, SUSPENSION
 * du compte à partir de `block`. Réglés pour qu'un client normal (une réservation, un report, une
 * annulation) reste à 0, et qu'un robot ou une personne qui remplit une journée dépasse `block`
 * en quelques tentatives.
 */
export const FRAUD = {
  refuse: 60,
  block: 100,
  /** Tentatives d'un même compte. */
  burst10min: 5,
  perHour: 6,
  perDay: 12,
  /** Comptes différents depuis une même adresse IP en une heure. */
  ipAccountsHour: 3,
  /** Demandes en attente de validation, tous salons confondus. */
  pendingMax: 3,
  /** Réservations annulées par le client moins d'une heure après les avoir prises, sur 24 h. */
  churnDay: 2,
  /** Tentatives refusées sur 24 h. */
  refusedDay: 4,
  /** Un compte de moins de 24 h est surveillé de plus près. */
  newAccountHours: 24,
} as const;

/** Motif montré à la personne dont le compte est suspendu automatiquement. */
export const FRAUD_SUSPENSION_REASON =
  'Activité de réservation inhabituelle détectée automatiquement. Contactez le support Salon DZ pour rétablir votre compte.';
