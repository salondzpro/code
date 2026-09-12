/**
 * Profil → Rendez-vous : les règles qui encadrent les réservations. Page de faits, pas d'explications —
 * les deux réglages modifiables en haut, puis ce que voient les clients et les blocages appliqués par
 * Salon DZ, en lignes courtes « règle · valeur ».
 */
import { useState } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
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
import { errorText } from '@/components/ErrorMessage';
import { ListRow, SectionLabel, Toggle, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { RowText } from './MonSalon';

/** Une règle par ligne : son libellé, sa valeur. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="li !py-3">
      <span className="text-[0.9375rem] text-muted">{label}</span>
      <span className="text-[0.9375rem] font-semibold">{value}</span>
    </div>
  );
}

export function ProRules() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const before = `${salon.cancelMinHours} h avant`;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/profil" right="Profil" />
      <h1 className="h1">Rendez-vous</h1>

      <div className="crd !gap-0 !py-1">
        <ListRow to="/pro/profil/regles">
          <RowText
            icon={SlidersHorizontal}
            title="Créneaux et règles"
            sub="Délai, horizon, annulation, report"
          />
        </ListRow>
        <div className="li !py-4">
          <RowText
            icon={ShieldCheck}
            title="Validation manuelle"
            sub="Vous confirmez chaque demande"
          />
          <Toggle
            on={!salon.autoConfirm}
            onChange={(v) =>
              updateSalon.mutate({ autoConfirm: !v }, { onError: (e) => setError(errorText(e)) })
            }
            label="Validation manuelle"
          />
        </div>
      </div>

      <SectionLabel>Ce que voient vos clients</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <Fact label="Annulation" value={`Jusqu'à ${before}`} />
        <Fact
          label="Report"
          value={
            salon.allowClientReschedule === false
              ? 'Désactivé'
              : `${MAX_CLIENT_RESCHEDULES} fois, jusqu'à ${before}`
          }
        />
        <Fact label="Arrivée conseillée" value={`${ARRIVAL_ADVANCE_MINUTES} min avant`} />
        <Fact label="Retard toléré" value={`${LATE_TOLERANCE_MINUTES} min`} />
      </div>

      <SectionLabel>Blocage automatique</SectionLabel>
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
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
    </Screen>
  );
}
