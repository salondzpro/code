/**
 * Signalement d'un avis par un utilisateur (migration 0047). Les avis sont du contenu écrit par des
 * utilisateurs et publié à la vue de tous : Apple (1.2) et Google Play attendent un moyen de les signaler.
 * Un signalement ne masque rien à lui seul : un opérateur décide, avec un motif.
 */
export const REPORT_REASONS = ['offensive', 'false', 'private', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Libellés proposés à la personne qui signale (une phrase, pas un jargon juridique). */
export const REPORT_REASON_LABELS_FR: Record<ReportReason, { label: string; hint: string }> = {
  offensive: { label: 'Injurieux ou haineux', hint: 'Insultes, menaces, propos discriminatoires' },
  false: { label: 'Faux avis', hint: 'La personne n’a pas été cliente de ce salon' },
  private: { label: 'Données personnelles', hint: 'Nom, numéro ou adresse d’une personne' },
  other: { label: 'Autre raison', hint: 'Un problème que les choix ci-dessus ne couvrent pas' },
};
