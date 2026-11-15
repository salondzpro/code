/**
 * COULEURS DE STATUT D'UN RENDEZ-VOUS — source unique (charte `docs/CHARTE.md` § 2, couleurs système
 * d'iOS). La couleur ne dit QUE le statut, jamais la catégorie de prestation ni le membre de l'équipe.
 *   à valider orange · confirmé bleu · en cours vert · absent rouge · terminé / passé / annulé gris
 */
type StatutBooking = { status: string; startsAt: string; endsAt: string };

export const STATUT_COULEUR = {
  pd: '#ff9500',
  cf: '#007aff',
  cur: '#34c759',
  ns: '#ff3b30',
  done: '#aeaeb2',
} as const;
export type StatutCle = keyof typeof STATUT_COULEUR;

export function statutCle(b: StatutBooking, now = Date.now()): StatutCle {
  if (b.status === 'no_show') return 'ns';
  if (b.status === 'cancelled' || b.status === 'completed' || new Date(b.endsAt).getTime() <= now) return 'done';
  if (b.status === 'pending') return 'pd';
  if (new Date(b.startsAt).getTime() <= now) return 'cur';
  return 'cf';
}

export const statutCouleur = (b: StatutBooking, now?: number) => STATUT_COULEUR[statutCle(b, now)];
