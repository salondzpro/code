/**
 * Étiquettes à imprimer (29 oct. 2026) : affiche de vitrine et autocollant de comptoir, avec le QR
 * code qui ouvre la page de réservation du salon. Le RENDU vit côté site (`apps/web/src/lib/labels.ts`,
 * canvas, rien n'est envoyé au serveur) ; ici, seulement la liste des modèles, partagée avec l'API qui
 * valide le choix de l'administrateur.
 *
 * L'administrateur décide quels modèles sont proposés aux professionnels et lequel est présenté
 * d'abord (`app_settings.label_templates`) ; le professionnel choisit parmi eux et télécharge.
 */
export const LABEL_TEMPLATE_IDS = ['elegance', 'nude', 'noir', 'ardoise', 'categorie', 'minimal', 'marque'] as const;
export type LabelTemplateId = (typeof LABEL_TEMPLATE_IDS)[number];

/** À qui le modèle s'adresse d'abord : il est proposé en tête au salon du même public. */
export type LabelAudience = 'women' | 'men' | 'all';

export interface LabelTemplateDef {
  id: LabelTemplateId;
  nameFr: string;
  hintFr: string;
  audience: LabelAudience;
}

export const LABEL_TEMPLATES: readonly LabelTemplateDef[] = [
  { id: 'elegance', nameFr: 'Élégance', hintFr: 'Rose poudré, typographie fine', audience: 'women' },
  { id: 'nude', nameFr: 'Nude', hintFr: 'Champagne et doré, esprit institut', audience: 'women' },
  { id: 'noir', nameFr: 'Barber noir', hintFr: 'Noir et laiton, esprit barbier', audience: 'men' },
  { id: 'ardoise', nameFr: 'Ardoise', hintFr: 'Gris ardoise, sobre et moderne', audience: 'men' },
  { id: 'categorie', nameFr: 'Selon le métier', hintFr: 'Couleurs de votre activité principale', audience: 'all' },
  { id: 'minimal', nameFr: 'Minimal', hintFr: 'Blanc et encre, se marie avec tout', audience: 'all' },
  { id: 'marque', nameFr: 'Salon DZ', hintFr: 'Aux couleurs de la plateforme', audience: 'all' },
];

/** Deux formats d'impression, à 300 points par pouce. */
export const LABEL_FORMATS = ['affiche', 'carre'] as const;
export type LabelFormat = (typeof LABEL_FORMATS)[number];

export interface LabelSettings {
  /** Modèles proposés aux professionnels (au moins un). */
  enabled: LabelTemplateId[];
  /** Modèle présenté en premier quand le salon n'a pas de préférence. */
  defaultId: LabelTemplateId;
}

/** Réglage d'origine, tant que l'administrateur n'a rien choisi : tout est proposé. */
export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  enabled: [...LABEL_TEMPLATE_IDS],
  defaultId: 'categorie',
};
