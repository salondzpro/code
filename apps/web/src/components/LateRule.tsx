/** Règle de retard affichée avant confirmation, après réservation et dans les détails (constants/lateness). */
import { lateRule } from '@salondz/constants';
import { InfoBox } from './ui';

export function LateRule({ startsAt }: { startsAt: string | Date }) {
  const r = lateRule(startsAt);
  return (
    <InfoBox>
      <b>Arrivez à {r.arriveAt}</b> (10 min avant). Retard toléré jusqu'à <b>{r.lateUntil}</b> : au-delà, le salon peut annuler le rendez-vous pour retard.
    </InfoBox>
  );
}
