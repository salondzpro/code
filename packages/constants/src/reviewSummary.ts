/**
 * Synthèse des avis par IA (28 oct. 2026). Elle n'existe qu'à partir d'un vrai corpus : en dessous
 * de `REVIEW_SUMMARY_MIN_REVIEWS` avis COMMENTÉS, résumer trois phrases n'apprend rien au client et
 * coûterait un appel pour rien — le site ne la demande même pas (le seuil est lu des deux côtés).
 */
export const REVIEW_SUMMARY_MIN_REVIEWS = 5;
/** Longueur maximale d'une synthèse, en caractères : une ligne et demie sur un téléphone. */
export const REVIEW_SUMMARY_MAX_CHARS = 140;
/** Avis les plus récents donnés à lire au modèle (au-delà, la synthèse ne change plus guère). */
export const REVIEW_SUMMARY_SAMPLE = 60;
/**
 * Une synthèse n'est refaite qu'après `REVIEW_SUMMARY_REFRESH_EVERY` nouveaux avis commentés, ou
 * quand elle a plus de `REVIEW_SUMMARY_MAX_AGE_DAYS` jours et qu'au moins un avis est arrivé depuis.
 * Un avis de plus ne change pas l'image d'un salon : on ne paie pas un appel à chaque avis.
 */
export const REVIEW_SUMMARY_REFRESH_EVERY = 3;
export const REVIEW_SUMMARY_MAX_AGE_DAYS = 14;
