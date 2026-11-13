/**
 * ICÔNES DESSINÉES POUR SALON DZ, quand aucune icône lucide ne dit exactement l'action (charte
 * `docs/CHARTE.md` § 5). Même gabarit que lucide : 24 × 24, trait, bouts et angles ronds — elles se
 * posent partout où une icône lucide est attendue (`ICONE`, `<I icon>`, `Button icon`).
 */
import { createLucideIcon } from 'lucide-react';

/**
 * CONFIER (13 nov. 2026, demande du propriétaire) : deux personnes au centre, entourées de deux
 * flèches circulaires — le rendez-vous PASSE d'une personne à l'autre.
 */
export const UsersEchange = createLucideIcon('users-echange', [
  // Flèche du haut (vers la droite) et sa pointe
  ['path', { d: 'M3.5 11a8.5 8.5 0 0 1 14.9-5.6L20.5 7.5', key: 'arc-haut' }],
  ['path', { d: 'M20.5 3v4.5H16', key: 'pointe-haut' }],
  // Flèche du bas (vers la gauche) et sa pointe
  ['path', { d: 'M20.5 13a8.5 8.5 0 0 1-14.9 5.6L3.5 16.5', key: 'arc-bas' }],
  ['path', { d: 'M3.5 21v-4.5H8', key: 'pointe-bas' }],
  // Deux personnes, côte à côte
  ['circle', { cx: '8.8', cy: '10', r: '1.3', key: 'tete-1' }],
  ['path', { d: 'M6.8 14.6a2 2 0 0 1 4 0', key: 'corps-1' }],
  ['circle', { cx: '15.2', cy: '10', r: '1.3', key: 'tete-2' }],
  ['path', { d: 'M13.2 14.6a2 2 0 0 1 4 0', key: 'corps-2' }],
]);
