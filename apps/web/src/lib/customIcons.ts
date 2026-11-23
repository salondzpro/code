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

/**
 * CARTE FIDÉLITÉ (18 nov. 2026) : une carte avec deux lignes de texte et un tampon étoilé — le
 * programme fidélité d'un salon, partout (place de marché, page du salon, réglage du pro).
 */
export const CarteFidelite = createLucideIcon('carte-fidelite', [
  ['rect', { x: '2.5', y: '5', width: '19', height: '14', rx: '3', key: 'carte' }],
  ['path', { d: 'M6 9.5h4.5', key: 'ligne-1' }],
  ['path', { d: 'M6 13h2.5', key: 'ligne-2' }],
  ['circle', { cx: '16', cy: '12', r: '3.6', key: 'tampon' }],
  ['path', { d: 'm16 10.2.6 1.2 1.3.2-.95.9.22 1.3L16 13.2l-1.17.6.22-1.3-.95-.9 1.3-.2Z', key: 'etoile' }],
]);

/**
 * Icônes détaillées (plusieurs éléments dans le rond) : dans un rond d'action, elles s'affichent PLUS
 * GRANDES et au trait FIN, sinon elles deviennent une tache grasse (demande du propriétaire, 13 nov.).
 */
export const ICONES_DETAILLEES = new Set<unknown>([UsersEchange]);

/**
 * WHATSAPP AU TRAIT (23 nov. 2026) : bulle ronde à pointe en bas à gauche et combiné au centre —
 * « recevoir un code sur WhatsApp ». Le logo plein et coloré reste `WhatsAppLogo` (BrandIcons).
 */
export const BulleWhatsApp = createLucideIcon('bulle-whatsapp', [
  ['path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5Z', key: 'bulle' }],
  ['path', { d: 'M9.2 8.6c.3-.5.9-.5 1.1 0l.5 1.2c.1.3 0 .6-.2.8l-.4.4c.5 1 1.3 1.8 2.3 2.3l.4-.4c.2-.2.5-.3.8-.2l1.2.5c.5.2.5.8 0 1.1-.6.5-1.4.7-2.1.4a7 7 0 0 1-3.9-3.9c-.3-.8-.1-1.6.3-2.2Z', key: 'combine' }],
]);
