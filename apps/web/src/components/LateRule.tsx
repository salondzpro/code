/** Règle de retard affichée avant confirmation, après réservation et dans les détails (constants/lateness). */
import { lateRule } from '@salondz/constants';
import { InfoBox } from './ui';
import { t } from '@/i18n';

export function LateRule({ startsAt }: { startsAt: string | Date }) {
  const r = lateRule(startsAt);
  return (
    <InfoBox>
      <b>{t("Arrivez à")}{' '}{r.arriveAt}</b> {t("(10 min avant). Retard toléré jusqu'à")}{' '}<b>{r.lateUntil}</b> {t(": au-delà, le salon peut annuler le rendez-vous pour retard.")}
    </InfoBox>
  );
}
