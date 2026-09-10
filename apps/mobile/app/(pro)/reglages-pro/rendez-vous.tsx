/**
 * Profil → Rendez-vous : les règles qui encadrent les réservations — créneaux et règles de réservation,
 * validation manuelle, règles d'annulation et de report, règle de retard, anti-abus (valeurs de la plateforme).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { TriangleAlert, CalendarX, ShieldCheck, SlidersHorizontal, Timer, type LucideIcon } from 'lucide-react-native';
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
import { Alert, Card, H1, ListCard, Row, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { Ic, RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

function Info({ icon, title, lines }: { icon: LucideIcon; title: string; lines: string[] }) {
  return (
    <Card gap={8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Ic icon={icon} />
        <Tx size={13} weight={600} lh={17}>
          {title}
        </Tx>
      </View>
      {lines.map((l) => (
        <Tx key={l} size={12} color={C.muted} lh={16}>
          • {l}
        </Tx>
      ))}
    </Card>
  );
}

export default function ProRules() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const cancelText = `jusqu'à ${salon.cancelMinHours} h avant le rendez-vous`;

  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/profil-pro" right="Profil" />
      <H1>Rendez-vous</H1>

      <SectionLabel>Réservation</SectionLabel>
      <ListCard>
        <Row py={12} to="/reglages-pro/regles">
          <RowText icon={SlidersHorizontal} title="Créneaux et règles de réservation" sub="Délai minimum, horizon, annulation, report" />
        </Row>
        <Row py={12} chevron={false} right={<Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v }, { onError: (e) => setError(errorText(e)) })} label="Validation manuelle" />}>
          <RowText icon={ShieldCheck} title="Validation manuelle" sub="Vous confirmez chaque demande" />
        </Row>
      </ListCard>

      <SectionLabel>Annulation et report</SectionLabel>
      <Info
        icon={CalendarX}
        title="Ce que voient vos clients"
        lines={[
          `Annulation en ligne : ${cancelText}.`,
          `Report en ligne : ${salon.allowClientReschedule === false ? 'désactivé (le client vous contacte)' : `${MAX_CLIENT_RESCHEDULES} fois par rendez-vous, ${cancelText}`}.`,
          'Modifiable dans « Créneaux et règles de réservation ».',
        ]}
      />

      <SectionLabel>Retard</SectionLabel>
      <Info
        icon={Timer}
        title="Règle de retard"
        lines={[
          `Arrivée recommandée ${ARRIVAL_ADVANCE_MINUTES} min avant l'heure.`,
          `Retard toléré ${LATE_TOLERANCE_MINUTES} min ; au-delà, vous pouvez annuler pour retard depuis la fiche du rendez-vous.`,
        ]}
      />

      <SectionLabel>Protection anti-abus</SectionLabel>
      <Info
        icon={TriangleAlert}
        title="Appliquée automatiquement par Salon DZ"
        lines={[
          `${CANCEL_ABUSE_MAX} annulations en ${CANCEL_ABUSE_WINDOW_DAYS} jours → réservation suspendue ${CANCEL_ABUSE_BLOCK_DAYS} jours.`,
          `${NO_SHOW_ABUSE_MAX} absences en ${NO_SHOW_ABUSE_WINDOW_DAYS} jours → réservation suspendue ${NO_SHOW_ABUSE_BLOCK_DAYS} jours.`,
          'Vous pouvez aussi bloquer un client depuis sa fiche.',
        ]}
      />
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
