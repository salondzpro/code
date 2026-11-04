/**
 * Ce que voient les clients et les blocages appliqués par Salon DZ, en lignes « règle · valeur ». Faits
 * affichés en bas de « Créneaux et règles », la seule page de réglage des rendez-vous.
 */
import {
  ARRIVAL_ADVANCE_MINUTES,
  CANCEL_ABUSE_BLOCK_DAYS,
  CANCEL_ABUSE_MAX,
  CANCEL_ABUSE_WINDOW_DAYS,
  LATE_TOLERANCE_MINUTES,
  MAX_CLIENT_RESCHEDULES,
  NO_SHOW_ABUSE_BLOCK_DAYS,
  NO_SHOW_ABUSE_MAX,
  NO_SHOW_ABUSE_WINDOW_DAYS,
} from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { SectionLabel } from '@/components/ui';
import { t } from '@/i18n';

/** Une règle par ligne : son libellé, sa valeur. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="li !py-3">
      <span className="text-[1rem] text-muted">{label}</span>
      <span className="text-[1rem] font-semibold">{value}</span>
    </div>
  );
}

export function RulesFacts({ salon }: { salon: SalonOwnerView }) {
  const before = `${salon.cancelMinHours} h avant`;
  return (
    <>
<SectionLabel>{t("Ce que voient vos clients")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <Fact label={t("Annulation")} value={`Jusqu'à ${before}`} />
        <Fact
          label={t("Report")}
          value={
            salon.allowClientReschedule === false
              ? 'Désactivé'
              : `${MAX_CLIENT_RESCHEDULES} fois, jusqu'à ${before}`
          }
        />
        <Fact label={t("Arrivée conseillée")} value={`${ARRIVAL_ADVANCE_MINUTES} min avant`} />
        <Fact label={t("Retard toléré")} value={`${LATE_TOLERANCE_MINUTES} min`} />
      </div>

      <SectionLabel>{t("Blocage automatique")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <Fact
          label={`Plus de ${CANCEL_ABUSE_MAX} annulations / ${CANCEL_ABUSE_WINDOW_DAYS} j`}
          value={`${CANCEL_ABUSE_BLOCK_DAYS} j suspendu`}
        />
        <Fact
          label={`Dès ${NO_SHOW_ABUSE_MAX} absences / ${NO_SHOW_ABUSE_WINDOW_DAYS} j`}
          value={`${NO_SHOW_ABUSE_BLOCK_DAYS} j suspendu`}
        />
      </div>
    </>
  );
}
