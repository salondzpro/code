/**
 * PRO-F 12 / 13 — Étape 10 : « Vos créneaux » (granularité, battement, postes, réservation en ligne,
 * validation manuelle) puis « Règles de réservation » (délai minimum, fenêtre, annulation, report, acompte).
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { stepPath } from '@/lib/proDraft';
import { Alert, Grid, H1, InfoBox, ListCard, Row, SectionLabel, Slot, Toggle, Tx } from '@/ui';
import { PickerSheet, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

const GRANULARITY = [15, 30, 60];
const BUFFERS = [0, 5, 10, 15, 30];
const LEAD = [
  { v: 60, l: '1 h' },
  { v: 120, l: '2 h' },
  { v: 240, l: '4 h' },
  { v: 1440, l: '24 h' },
];
const HORIZON = [7, 30, 60];
const CANCEL = [2, 4, 12, 24];

function BigSlot({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Slot on={on} onPress={onPress} style={{ paddingVertical: 26 }}>
      <Tx size={20} weight={500} lh={24} color={on ? C.onInk : C.text} mono>
        {children}
      </Tx>
    </Slot>
  );
}

export function Step10Availability({ settings }: { settings?: boolean }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [phase, setPhase] = useState<'slots' | 'rules'>('slots');
  const [interval, setIntervalMin] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [online, setOnline] = useState(true);
  const [manual, setManual] = useState(false);
  const [lead, setLead] = useState(120);
  const [horizon, setHorizon] = useState(30);
  const [cancel, setCancel] = useState(2);
  const [report, setReport] = useState(true);
  const [deposit, setDeposit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'buffer' | 'cancel' | null>(null);

  useEffect(() => {
    if (!salon) return;
    setIntervalMin(salon.slotIntervalMinutes);
    setBuffer(salon.bufferMinutes ?? 0);
    setManual(!salon.autoConfirm);
    setLead(salon.bookingLeadTimeMinutes);
    setHorizon(salon.bookingHorizonDays);
    setCancel(salon.cancelMinHours ?? 2);
    setOnline(true);
  }, [salon]);

  if (!salon) return <Splash />;
  const staffCount = salon.staff.filter((s) => s.isActive).length;

  const save = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({ slotIntervalMinutes: interval as 10 | 15 | 20 | 30 | 60, bufferMinutes: buffer, autoConfirm: !manual, bookingLeadTimeMinutes: lead, bookingHorizonDays: horizon, cancelMinHours: cancel });
      if (settings) router.replace('/(pro)/(tabs)/profil-pro');
      else router.push('/onboarding/publier');
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (phase === 'slots') {
    return (
      <Screen gap={16} footer={<StepSheet onPress={() => setPhase('rules')} />}>
        <StepBar step={10} backTo={settings ? '/(pro)/(tabs)/profil-pro' : stepPath(9)} right="Disponibilités" />
        <H1>Vos créneaux</H1>
        <SectionLabel>Granularité</SectionLabel>
        <Grid cols={3}>
          {GRANULARITY.map((g) => (
            <BigSlot key={g} on={interval === g} onPress={() => setIntervalMin(g)}>
              {`${g} min`}
            </BigSlot>
          ))}
        </Grid>
        <SectionLabel>Règles</SectionLabel>
        <ListCard>
          <ValueRow label="Temps de battement" hint="Entre deux rendez-vous" value={`${buffer} min`} onPress={() => setSheet('buffer')} />
          <ValueRow label="Rendez-vous simultanés" hint="Nombre de postes" value={String(staffCount)} />
          <Row py={16} chevron={false} right={<Toggle on={online} onChange={setOnline} label="Réservation en ligne" />}>
            <Tx size={19} lh={24}>
              Réservation en ligne
            </Tx>
            <Tx size={16} color={C.muted} lh={22}>
              Visible dans la marketplace
            </Tx>
          </Row>
          <Row py={16} chevron={false} right={<Toggle on={manual} onChange={setManual} label="Validation manuelle" />}>
            <Tx size={19} lh={24}>
              Validation manuelle
            </Tx>
            <Tx size={16} color={C.muted} lh={22}>
              Vous confirmez chaque demande
            </Tx>
          </Row>
        </ListCard>
        <InfoBox>Sans validation manuelle, les créneaux sont réservés instantanément.</InfoBox>
        <PickerSheet open={sheet === 'buffer'} onClose={() => setSheet(null)} title="Temps de battement" options={BUFFERS.map((b) => ({ value: b, label: `${b} min` }))} value={buffer} onChange={setBuffer} />
      </Screen>
    );
  }

  return (
    <Screen gap={16} footer={<StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onPress={() => void save()} busy={updateSalon.isPending} />}>
      <StepBar step={10} right="Réservation" />
      <H1>Règles de réservation</H1>
      <SectionLabel>Délai minimum avant un rendez-vous</SectionLabel>
      <Grid cols={4}>
        {LEAD.map((l) => (
          <BigSlot key={l.v} on={lead === l.v} onPress={() => setLead(l.v)}>
            {l.l}
          </BigSlot>
        ))}
      </Grid>
      <SectionLabel>Fenêtre de réservation</SectionLabel>
      <Grid cols={3}>
        {HORIZON.map((h) => (
          <BigSlot key={h} on={horizon === h} onPress={() => setHorizon(h)}>
            {`${h} j`}
          </BigSlot>
        ))}
      </Grid>
      <ListCard>
        <ValueRow label="Annulation client" hint="Gratuite jusqu'à" value={`${cancel} h avant`} onPress={() => setSheet('cancel')} />
        <Row py={16} chevron={false} right={<Toggle on={report} onChange={setReport} label="Report client" />}>
          <Tx size={19} lh={24}>
            Report client
          </Tx>
          <Tx size={16} color={C.muted} lh={22}>
            Sur demande, avec validation
          </Tx>
        </Row>
        <Row py={16} chevron={false} right={<Toggle on={deposit} onChange={setDeposit} label="Acompte" />}>
          <Tx size={19} lh={24}>
            Acompte
          </Tx>
          <Tx size={16} color={C.muted} lh={22}>
            Paiement sur place uniquement
          </Tx>
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
      <PickerSheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title="Annulation gratuite jusqu'à" options={CANCEL.map((c) => ({ value: c, label: `${c} h avant` }))} value={cancel} onChange={setCancel} />
    </Screen>
  );
}
