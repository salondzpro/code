/**
 * Étiquettes à imprimer (29 oct. 2026) : affiche de vitrine et autocollant de comptoir, avec le QR
 * code qui ouvre la page de réservation du salon. Le RENDU vit côté site (`apps/web/src/lib/labels.ts`,
 * canvas, rien n'est envoyé au serveur) ; ici, seulement la liste des modèles, partagée avec l'API qui
 * valide le choix de l'administrateur.
 *
 * L'administrateur décide quels modèles sont proposés aux professionnels et lequel est présenté
 * d'abord (`app_settings.label_templates`) ; le professionnel choisit parmi eux et télécharge.
 */
export const LABEL_TEMPLATE_IDS = ['vitrine', 'elegance', 'nude', 'noir', 'ardoise', 'categorie', 'minimal', 'marque'] as const;
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
  { id: 'vitrine', nameFr: 'Vitrine noire', hintFr: 'Plaque noire de vitrine, avec vos réseaux', audience: 'all' },
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
  defaultId: 'vitrine',
};

/**
 * Réseaux sociaux imprimés sur l'étiquette « Vitrine noire ». Le professionnel les saisit dans
 * l'atelier et choisit lesquels figurent sur l'affiche ; ils sont gardés par salon
 * (`app_settings.label_socials:<salon>`), pas sur la fiche publique du salon.
 */
export const LABEL_SOCIAL_IDS = ['instagram', 'facebook', 'snapchat', 'tiktok'] as const;
export type LabelSocialId = (typeof LABEL_SOCIAL_IDS)[number];
export const LABEL_SOCIAL_NAMES: Record<LabelSocialId, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
};
export const LABEL_SOCIAL_MAX = 40;

export interface LabelSocial {
  id: LabelSocialId;
  handle: string;
  shown: boolean;
}

/** Réseaux d'un salon, toujours dans l'ordre de `LABEL_SOCIAL_IDS`, un par réseau. */
export function normalizeLabelSocials(raw: unknown): LabelSocial[] {
  const list = Array.isArray(raw) ? (raw as Partial<LabelSocial>[]) : [];
  return LABEL_SOCIAL_IDS.map((id) => {
    const r = list.find((x) => x && x.id === id);
    const handle = typeof r?.handle === 'string' ? r.handle.trim().slice(0, LABEL_SOCIAL_MAX) : '';
    return { id, handle, shown: !!handle && r?.shown !== false };
  });
}

/**
 * Personnalisation de la « Vitrine noire » par le professionnel : langue des textes imprimés,
 * couleur du fond (le texte suit, blanc ou encre selon la clarté), style typographique et la
 * phrase sous « Réservation RDV ». Gardée par salon (`app_settings.label_style:<salon>`).
 */
export const LABEL_LOCALES = ['fr', 'ar', 'en'] as const;
export type LabelLocale = (typeof LABEL_LOCALES)[number];
export const LABEL_FONTS = ['moderne', 'elegant', 'capitales'] as const;
export type LabelFont = (typeof LABEL_FONTS)[number];
export const LABEL_TAGLINE_MAX = 60;

/** Couleurs proposées d'un geste ; toute autre couleur reste possible (`#RRGGBB`). */
export const LABEL_COLORS: readonly { hex: string; nameFr: string }[] = [
  { hex: '#050506', nameFr: 'Noir' },
  { hex: '#FFFFFF', nameFr: 'Blanc' },
  { hex: '#0F1B33', nameFr: 'Bleu nuit' },
  { hex: '#12352B', nameFr: 'Vert sapin' },
  { hex: '#5A1426', nameFr: 'Bordeaux' },
  { hex: '#F4D9E1', nameFr: 'Rose poudré' },
  { hex: '#EADFD2', nameFr: 'Champagne' },
];

export interface LabelStyle {
  locale: LabelLocale;
  color: string;
  font: LabelFont;
  /** Phrase sous le titre ; vide = phrase par défaut de la langue. */
  tagline: string;
}

export const DEFAULT_LABEL_STYLE: LabelStyle = { locale: 'fr', color: '#050506', font: 'moderne', tagline: '' };

/** Textes imprimés par langue (l'affiche peut être dans une autre langue que l'écran). */
export const LABEL_TEXTS: Record<LabelLocale, { title: string; tagline: string; follow: string }> = {
  fr: { title: 'Réservation RDV', tagline: 'Scannez le QR Code ou l’application', follow: 'Suivez-nous sur les réseaux' },
  ar: { title: 'احجز موعدك', tagline: 'امسح رمز QR أو استعمل التطبيق', follow: 'تابعونا على مواقع التواصل' },
  en: { title: 'Book now', tagline: 'Scan the QR code or use the app', follow: 'Follow us on social media' },
};

export function normalizeLabelStyle(raw: unknown): LabelStyle {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<LabelStyle>;
  return {
    locale: LABEL_LOCALES.includes(v.locale as LabelLocale) ? (v.locale as LabelLocale) : DEFAULT_LABEL_STYLE.locale,
    color: typeof v.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.color) ? v.color.toUpperCase() : DEFAULT_LABEL_STYLE.color,
    font: LABEL_FONTS.includes(v.font as LabelFont) ? (v.font as LabelFont) : DEFAULT_LABEL_STYLE.font,
    tagline: typeof v.tagline === 'string' ? v.tagline.trim().slice(0, LABEL_TAGLINE_MAX) : '',
  };
}
