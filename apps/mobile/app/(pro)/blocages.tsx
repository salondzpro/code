/**
 * PRO-F 14 — Fermetures et exceptions : blocages à venir (90 jours) et ajout d'une exception
 * (jours fermés ou horaires réduits, pour tout le salon ou un membre).
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useProBlockMutations, useProBlocks, useProSalon } from '@salondz/api-client';
import { DAY_LABELS_FR, addDaysToKey, dayOfWeekFromKey, formatTimeDZ, localDateTimeToISO, toLocalDateKey, weekKeys } from '@salondz/constants';
import { createTimeBlockSchema } from '@salondz/validation';
import type { TimeBlock } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { MONTHS_FR } from '@/lib/format';
import { Alert, Badge, BottomSheet, Button, Card, H1, Input, ListCard, ModalSheet, P, Pill, Row, SectionLabel, Skeleton, TopBar, Tx } from '@/ui';
import { DayCell, MonthNav } from '@/ui/DaySelector';
import { PickerSheet, TimeField, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

const HORIZON_DAYS = 90;
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
const localKey = (iso: string) => keyFmt.format(new Date(iso));
const dayNum = (k: string) => Number(k.slice(8, 10));
const monthOf = (k: string) => MONTHS_FR[Number(k.slice(5, 7)) - 1]!;

function isAllDay(b: TimeBlock): boolean {
  return formatTimeDZ(b.startsAt) === '00:00' && formatTimeDZ(b.endsAt) === '00:00';
}
export function rangeLabel(from: string, to: string): string {
  if (from === to) return `${DAY_LABELS_FR[dayOfWeekFromKey(from)]} ${dayNum(from)} ${monthOf(from)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayNum(from)} – ${dayNum(to)} ${monthOf(from)}`;
  return `${dayNum(from)} ${monthOf(from)} – ${dayNum(to)} ${monthOf(to)}`;
}
function blockDays(b: TimeBlock): { from: string; to: string } {
  const from = localKey(b.startsAt);
  const to = isAllDay(b) ? localKey(new Date(new Date(b.endsAt).getTime() - 60_000).toISOString()) : localKey(b.endsAt);
  return { from, to };
}
function describeBlock(b: TimeBlock): string {
  const { from, to } = blockDays(b);
  return isAllDay(b) ? rangeLabel(from, to) : `${rangeLabel(from, from)} · ${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)}`;
}

type Range = { from: string; to: string } | null;

export default function Closures() {
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, HORIZON_DAYS));
  const { create, remove } = useProBlockMutations();

  const [weekOf, setWeekOf] = useState(today);
  const [range, setRange] = useState<Range>(null);
  const [mode, setMode] = useState<'closed' | 'reduced'>('closed');
  const [from, setFrom] = useState('12:00');
  const [to, setTo] = useState('14:00');
  const [staffId, setStaffId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState<TimeBlock | null>(null);
  const [staffSheet, setStaffSheet] = useState(false);

  const staffName = useMemo(() => new Map((salon?.staff ?? []).map((m) => [m.id, m.displayName])), [salon]);
  if (!salon) return <Splash />;
  const active = salon.staff.filter((m) => m.isActive);
  const items = blocks.data?.items ?? [];

  const pick = (d: string) => {
    if (!range || range.from !== range.to) return setRange({ from: d, to: d });
    if (d === range.from) return setRange(null);
    if (d > range.from) return setRange({ from: range.from, to: d });
    setRange({ from: d, to: d });
  };
  const nDays = range ? Math.round((new Date(`${range.to}T12:00:00Z`).getTime() - new Date(`${range.from}T12:00:00Z`).getTime()) / 86_400_000) + 1 : 0;
  const daysText = nDays <= 1 ? 'ce jour-là' : nDays === 2 ? 'sur ces deux jours' : `sur ces ${nDays} jours`;

  const submit = async () => {
    setError(null);
    if (!range) return setError('Choisissez un ou plusieurs jours.');
    if (mode === 'reduced' && from >= to) return setError("L'heure de début doit précéder la fin.");
    const base = { staffId: staffId || null, reason: reason.trim() || undefined };
    const inputs =
      mode === 'closed'
        ? [{ ...base, startsAt: localDateTimeToISO(range.from, '00:00'), endsAt: localDateTimeToISO(addDaysToKey(range.to, 1), '00:00') }]
        : Array.from({ length: nDays }, (_, i) => addDaysToKey(range.from, i)).map((d) => ({ ...base, startsAt: localDateTimeToISO(d, from), endsAt: localDateTimeToISO(d, to) }));
    try {
      for (const input of inputs) {
        const parsed = createTimeBlockSchema.safeParse(input);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Plage invalide.');
        await create.mutateAsync(parsed.data);
      }
      setRange(null);
      setReason('');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={12}
      footer={
        <BottomSheet>
          <Button onPress={() => void submit()} disabled={create.isPending} loading={create.isPending}>
            Ajouter l'exception
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo="/(pro)/(tabs)/profil" right="Exceptions" />
      <H1>Fermetures</H1>

      <ListCard>
        {blocks.isPending && <Skeleton h={64} style={{ marginVertical: 12 }} />}
        {blocks.data && items.length === 0 && (
          <View style={{ paddingVertical: 16 }}>
            <Tx size={17} color={C.muted} lh={23}>
              Aucune fermeture prévue sur les {HORIZON_DAYS} prochains jours.
            </Tx>
          </View>
        )}
        {items.map((b) => {
          const allDay = isAllDay(b);
          const who = b.staffId ? (staffName.get(b.staffId) ?? 'Membre') : null;
          const title = who ? `${who} · ${b.reason ?? 'Indisponible'}` : (b.reason ?? 'Fermeture');
          return (
            <Row key={b.id} py={16} chevron={false} onPress={() => setDel(b)} accessibilityLabel={title} right={<Badge tone={allDay ? 'cn' : 'pd'} md dot={false}>{allDay ? 'Fermé' : 'Modifié'}</Badge>}>
              <Tx size={19} lh={24} numberOfLines={1}>
                {title}
              </Tx>
              <Tx size={15} color={C.muted} lh={20} mono>
                {describeBlock(b)}
              </Tx>
            </Row>
          );
        })}
      </ListCard>

      <SectionLabel>Ajouter une exception</SectionLabel>
      <Card gap={12}>
        <MonthNav weekOf={weekOf} onWeekChange={setWeekOf} minDate={today} maxDate={addDaysToKey(today, HORIZON_DAYS)} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }} accessibilityLabel="Choisir les jours">
          {weekKeys(weekOf).map((d) => (
            <DayCell key={d} dateKey={d} out={d < today} on={!!range && d >= range.from && d <= range.to} onPress={() => pick(d)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill on={mode === 'closed'} onPress={() => setMode('closed')} style={{ flex: 1, alignSelf: 'stretch' }}>
            Fermé
          </Pill>
          <Pill on={mode === 'reduced'} onPress={() => setMode('reduced')} style={{ flex: 1, alignSelf: 'stretch' }}>
            Horaires réduits
          </Pill>
        </View>
        <View>
          {mode === 'reduced' && (
            <Row py={12} chevron={false} right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TimeField value={from} onChange={setFrom} label="De" step={5} />
                <Tx size={19} color={C.muted} lh={24}>
                  à
                </Tx>
                <TimeField value={to} onChange={setTo} label="À" step={5} />
              </View>
            }>
              <Tx size={19} lh={24}>
                Fermé de
              </Tx>
            </Row>
          )}
          {active.length > 1 && <ValueRow py={12} label="Concerne" value={staffId ? (staffName.get(staffId) ?? 'Membre') : 'Tout le salon'} onPress={() => setStaffSheet(true)} />}
          <Row py={12} chevron={false} right={<Input value={reason} onChangeText={setReason} placeholder="Congés" maxLength={120} accessibilityLabel="Motif (facultatif)" style={{ width: '55%', backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 19 }} />}>
            <Tx size={19} lh={24}>
              Motif
            </Tx>
          </Row>
        </View>
        <Tx size={15} color={C.muted} lh={22}>
          {mode === 'closed' ? `Les clients ne verront aucun créneau ${daysText}.` : `Les clients ne pourront pas réserver entre ${from} et ${to} ${daysText}.`} Les rendez-vous déjà confirmés ne sont pas annulés automatiquement.
        </Tx>
      </Card>
      {error && <Alert>{error}</Alert>}

      <PickerSheet open={staffSheet} onClose={() => setStaffSheet(false)} title="Concerne" options={[{ value: '', label: 'Tout le salon' }, ...active.map((m) => ({ value: m.id, label: m.displayName }))]} value={staffId} onChange={setStaffId} />

      <ModalSheet open={!!del} onClose={() => setDel(null)}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Tx size={24} weight={700} ls={-0.4} lh={29} center>
            Supprimer cette exception ?
          </Tx>
          <P center>{del ? describeBlock(del) : ''} — les créneaux redeviennent réservables.</P>
        </View>
        <Button
          bg={C.danger}
          textColor="#fff"
          disabled={remove.isPending}
          loading={remove.isPending}
          onPress={async () => {
            if (!del) return;
            try {
              await remove.mutateAsync(del.id);
            } catch (err) {
              setError(errorText(err));
            }
            setDel(null);
          }}
        >
          Supprimer
        </Button>
        <Button variant="g" onPress={() => setDel(null)}>
          Garder
        </Button>
      </ModalSheet>
    </Screen>
  );
}
