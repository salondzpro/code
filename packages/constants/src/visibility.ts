/**
 * Ce que la cliente voit, ou ne voit pas, de la fiche d'un salon.
 */

/**
 * Coordonnées directes du salon montrées à la cliente : numéro affiché, bouton d'appel,
 * bouton WhatsApp.
 *
 * Coupé volontairement. Tant que la réservation doit rester dans Salon DZ, donner le numéro
 * revient à envoyer la cliente conclure ailleurs : le rendez-vous n'existe alors ni dans
 * l'agenda du professionnel, ni dans son chiffre d'affaires, ni dans ses statistiques, et
 * la plateforme ne sert plus à rien pour cette visite.
 *
 * Le professionnel continue de voir le numéro de sa cliente : c'est lui qui a besoin de
 * joindre en cas d'imprévu, jamais l'inverse.
 *
 * Conséquence assumée : une cliente dont la réservation en ligne est suspendue n'a plus de
 * recours direct depuis l'application. Repasser cette constante à `true` réaffiche tout,
 * d'un seul endroit.
 */
export const SHOW_SALON_CONTACT_TO_CLIENTS = false;
