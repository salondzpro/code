/** Règle de retard affichée avant confirmation, après réservation et dans les détails (constants/lateness). */
import React from 'react';
import { lateRule } from '@salondz/constants';
import { InfoBox } from './index';

export function LateRule({ startsAt }: { startsAt: string | Date }) {
  const r = lateRule(startsAt);
  return <InfoBox>{`Arrivez à ${r.arriveAt} (10 min avant). Retard toléré jusqu'à ${r.lateUntil} : au-delà, le salon peut annuler le rendez-vous pour retard.`}</InfoBox>;
}
