/**
 * Règle de retard (V1 Algérie), simple et affichée partout : arrivée recommandée 10 min avant, retard toléré
 * 10 min ; au-delà, le professionnel peut annuler « pour retard » (statut distinct d'une annulation normale),
 * ou exceptionnellement accepter le client. Exemple : RDV 14:00 → arrivée 13:50, toléré jusqu'à 14:10.
 */
import { formatTimeDZ } from './dates';

export const ARRIVAL_ADVANCE_MINUTES = 10;
export const LATE_TOLERANCE_MINUTES = 10;

export type CancellationKind = 'late';

export function lateRule(startsAt: string | Date): { arriveAt: string; lateUntil: string; text: string } {
  const t = new Date(startsAt).getTime();
  const arriveAt = formatTimeDZ(new Date(t - ARRIVAL_ADVANCE_MINUTES * 60_000));
  const lateUntil = formatTimeDZ(new Date(t + LATE_TOLERANCE_MINUTES * 60_000));
  return {
    arriveAt,
    lateUntil,
    text: `Arrivée recommandée à ${arriveAt} (${ARRIVAL_ADVANCE_MINUTES} min avant). Retard toléré jusqu'à ${lateUntil} : au-delà, le salon peut annuler le rendez-vous pour retard.`,
  };
}

/** Le retard toléré est dépassé (le pro peut annuler pour retard). */
export function isLate(startsAt: string | Date, now = Date.now()): boolean {
  return now >= new Date(startsAt).getTime() + LATE_TOLERANCE_MINUTES * 60_000;
}
