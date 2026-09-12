/**
 * Profil → Rendez-vous : les règles qui encadrent les réservations. Page de faits, pas d'explications —
 * les deux réglages modifiables en haut, puis ce que voient les clients et les blocages appliqués par
 * Salon DZ, en lignes courtes « règle · valeur ».
 */
import React, { useState } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
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
import { errorText } from '@/lib/errors';
import { Alert, H1, ListCard, Row, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

/** Une règle par ligne : son libellé, sa valeur. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Row
      py={10}
      chevron={false}
      right={
        <Tx size={12} weight={600} lh={16}>
          {value}
        </Tx>
      }
    >
      <Tx size={12} color={C.muted} lh={16}>
        {label}
      </Tx>
    </Row>
  );
}

export default function ProRules() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const before = `${salon.cancelMinHours} h avant`;

  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/profil-pro" right="Profil" />
      <H1>Rendez-vous</H1>

      <ListCard>
        <Row py={12} to="/reglages-pro/regles">
          <RowText
            icon={SlidersHorizontal}
            title="Créneaux et règles"
            sub="Délai, horizon, annulation, report"
          />
        </Row>
        <Row
          py={12}
          chevron={false}
          right={
            <Toggle
              on={!salon.autoConfirm}
              onChange={(v) =>
                updateSalon.mutate({ autoConfirm: !v }, { onError: (e) => setError(errorText(e)) })
              }
              label="Validation manuelle"
            />
          }
        >
          <RowText
            icon={ShieldCheck}
            title="Validation manuelle"
            sub="Vous confirmez chaque demande"
          />
        </Row>
      </ListCard>

      <SectionLabel>Ce que voient vos clients</SectionLabel>
      <ListCard>
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
      </ListCard>

      <SectionLabel>Blocage automatique</SectionLabel>
      <ListCard>
        <Fact
          label={`Plus de ${CANCEL_ABUSE_MAX} annulations / ${CANCEL_ABUSE_WINDOW_DAYS} j`}
          value={`${CANCEL_ABUSE_BLOCK_DAYS} j suspendu`}
        />
        <Fact
          label={`Dès ${NO_SHOW_ABUSE_MAX} absences / ${NO_SHOW_ABUSE_WINDOW_DAYS} j`}
          value={`${NO_SHOW_ABUSE_BLOCK_DAYS} j suspendu`}
        />
      </ListCard>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
