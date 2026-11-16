/**
 * COULEURS DES CARTES (15 nov. 2026, demande du propriétaire) — deuxième exception écrite de la charte
 * (`docs/CHARTE.md` § 2) : le cercle de rayon de recherche et la position de la personne sont en BLEU
 * APPLE `#007aff`, trait plein et fond bleuté marqués, pour que la zone se repère d'un coup d'œil sur
 * le fond de carte. Une seule source pour toutes les cartes (Leaflet attend des valeurs, pas des jetons CSS).
 */
export const RAYON = {
  color: '#007aff',
  weight: 2.5,
  opacity: 0.9,
  fillColor: '#007aff',
  fillOpacity: 0.14,
} as const;

/** Point « ma position » et son halo de précision. */
export const POSITION = '#007aff';
