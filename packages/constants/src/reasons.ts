import { tr } from './i18n';
/**
 * Motifs proposés en liste, plutôt qu'un champ libre.
 *
 * Un champ libre reste vide neuf fois sur dix, et quand il est rempli il l'est dans une
 * formulation différente à chaque fois : illisible pour l'autre partie, inexploitable pour
 * les statistiques. Une liste courte de motifs généraux se choisit d'un geste et dit la
 * même chose à tout le monde.
 *
 * Ce sont les libellés eux-mêmes qui partent à l'API (`reason`, texte libre côté serveur) :
 * aucune migration, et un motif hors liste reste possible plus tard sans rien casser.
 */

/** Le salon refuse une demande de rendez-vous. */
export const REFUSAL_REASONS_FR = [
  'Complet à cette heure',
  'Salon fermé ce jour-là',
  'Prestation indisponible',
  'Membre de l’équipe absent',
  'Délai trop court',
  'Autre raison',
] as const;

/** Le salon annule un rendez-vous déjà confirmé. */
export const SALON_CANCEL_REASONS_FR = [
  'Imprévu au salon',
  'Fermeture exceptionnelle',
  'Membre de l’équipe absent',
  'Prestation indisponible',
  'Autre raison',
] as const;

/** La cliente annule son rendez-vous. */
export const CLIENT_CANCEL_REASONS_FR = [
  'Empêchement',
  'Je ne peux plus me déplacer',
  'Erreur de créneau',
  'J’ai trouvé un autre horaire',
  'Autre raison',
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS_FR)[number];
export type SalonCancelReason = (typeof SALON_CANCEL_REASONS_FR)[number];
export type ClientCancelReason = (typeof CLIENT_CANCEL_REASONS_FR)[number];

/** Options prêtes pour un sélecteur : la valeur envoyée est le libellé lui-même. */
export function reasonOptions(reasons: readonly string[]): { value: string; label: string }[] {
  return reasons.map((r) => ({ value: r, label: tr(r) }));
}
