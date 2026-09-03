import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProBlockMutations, useProBlocks, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDateShortDZ, formatTimeDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import { createTimeBlockSchema } from '@salondz/validation';
import type { SalonOwnerView, TimeBlock } from '@salondz/types';
import { Button, Chip, EmptyState, ErrorText, Loading, Muted, Screen, Sheet, TextField, WeekStrip, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

/** Fenêtre affichée : aujourd'hui → +90 jours. */
const HORIZON_DAYS = 90;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_PRESETS = [1, 2, 3, 7] as const;

/** Un blocage « journée entière » commence et finit à minuit (heure d'Alger). */
function isAllDay(b: TimeBlock): boolean {
  return formatTimeDZ(b.startsAt) === '00:00' && formatTimeDZ(b.endsAt) === '00:00';
}

export function describeBlock(b: TimeBlock): string {
  if (isAllDay(b)) {
    const lastDay = new Date(new Date(b.endsAt).getTime() - 60_000);
    const from = formatDateShortDZ(b.startsAt);
    const to = formatDateShortDZ(lastDay);
    return from === to ? `${from} · journée entière` : `du ${from} au ${to} · journées entières`;
  }
  const sameDay = formatDateShortDZ(b.startsAt) === formatDateShortDZ(b.endsAt);
  return sameDay
    ? `${formatDateShortDZ(b.startsAt)} · ${formatTimeDZ(b.startsAt)} – ${formatTimeDZ(b.endsAt)}`
    : `${formatDateShortDZ(b.startsAt)} ${formatTimeDZ(b.startsAt)} → ${formatDateShortDZ(b.endsAt)} ${formatTimeDZ(b.endsAt)}`;
}

/** Congés, pauses, fermetures exceptionnelles : retirent des créneaux réservables. */
export default function Blocages() {
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, HORIZON_DAYS));
  const { remove } = useProBlockMutations();
  const [open, setOpen] = useState(false);
  const staffName = useMemo(() => new Map((salon?.staff ?? []).map((m) => [m.id, m.displayName])), [salon]);

  if (!salon) return <Loading />;

  const confirmDelete = (b: TimeBlock) =>
    Alert.alert('Supprimer ce blocage ?', describeBlock(b), [
      { text: 'Garder', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => remove.mutate(b.id, { onError: (e) => Alert.alert('Impossible', errorMessage(e)) }) },
    ]);

  const items = blocks.data?.items ?? [];

  return (
    <Screen scroll refreshing={blocks.isRefetching} onRefresh={() => void blocks.refetch()}>
      <Muted>Un blocage retire des créneaux réservables en ligne : fermeture exceptionnelle, congé d'un membre, pause déjeuner…</Muted>
      <View style={{ height: spacing.md }} />
      <Button title="+ Ajouter un blocage" onPress={() => setOpen(true)} fullWidth />
      <View style={{ height: spacing.md }} />
      {blocks.isLoading ? (
        <Loading inline />
      ) : blocks.isError ? (
        <ErrorText error={blocks.error} onRetry={() => void blocks.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="sunny-outline" title="Aucun blocage à venir" description="Vos horaires d'ouverture s'appliquent normalement sur les 90 prochains jours." />
      ) : (
        items.map((b) => (
          <View key={b.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{describeBlock(b)}</Text>
              <Text style={styles.itemMeta}>
                {b.staffId ? (staffName.get(b.staffId) ?? 'Membre') : 'Tout le salon'}
                {b.reason ? ` · ${b.reason}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => confirmDelete(b)} hitSlop={8} accessibilityLabel="Supprimer le blocage">
              <Text style={styles.delete}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
      <BlockSheet visible={open} onClose={() => setOpen(false)} salon={salon} today={today} />
    </Screen>
  );
}

function BlockSheet({ visible, onClose, salon, today }: { visible: boolean; onClose: () => void; salon: SalonOwnerView; today: string }) {
  const { create } = useProBlockMutations();
  const activeStaff = salon.staff.filter((m) => m.isActive);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [days, setDays] = useState(1);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!allDay && (!TIME_RE.test(startTime) || !TIME_RE.test(endTime))) return setError('Heures au format HH:mm (ex : 12:30)');
    const startsAt = localDateTimeToISO(startDate, allDay ? '00:00' : startTime);
    const endsAt = allDay ? localDateTimeToISO(addDaysToKey(startDate, days), '00:00') : localDateTimeToISO(startDate, endTime);
    const parsed = createTimeBlockSchema.safeParse({ staffId, startsAt, endsAt, reason: reason.trim() || undefined });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Plage invalide');
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setReason('');
        onClose();
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Nouveau blocage">
      <Text style={styles.label}>Concerne</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Chip label="Tout le salon" selected={staffId === null} onPress={() => setStaffId(null)} />
        {activeStaff.map((m) => (
          <Chip key={m.id} label={m.displayName} selected={staffId === m.id} onPress={() => setStaffId(m.id)} />
        ))}
      </ScrollView>
      <Text style={styles.label}>Durée</Text>
      <View style={[styles.row, styles.chips]}>
        <Chip label="Journée(s) entière(s)" selected={allDay} onPress={() => setAllDay(true)} />
        <Chip label="Plage horaire" selected={!allDay} onPress={() => setAllDay(false)} />
      </View>
      <Text style={styles.label}>{allDay ? 'À partir du' : 'Date'}</Text>
      <WeekStrip value={startDate} onChange={setStartDate} />
      {allDay ? (
        <>
          <Text style={styles.label}>Nombre de jours</Text>
          <View style={[styles.row, styles.chips]}>
            {DAY_PRESETS.map((n) => (
              <Chip key={n} label={n === 7 ? '1 semaine' : `${n} jour${n > 1 ? 's' : ''}`} selected={days === n} onPress={() => setDays(n)} />
            ))}
          </View>
          <Text style={styles.hint}>
            Du {formatDateShortDZ(localDateTimeToISO(startDate, '12:00'))} au {formatDateShortDZ(localDateTimeToISO(addDaysToKey(startDate, days - 1), '12:00'))} inclus.
          </Text>
        </>
      ) : (
        <View style={styles.times}>
          <TextField label="De" value={startTime} onChangeText={setStartTime} placeholder="12:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
          <TextField label="À" value={endTime} onChangeText={setEndTime} placeholder="14:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
        </View>
      )}
      <TextField label="Motif (facultatif)" value={reason} onChangeText={setReason} placeholder="Congé, formation, pause…" maxLength={120} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Ajouter le blocage" onPress={submit} loading={create.isPending} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  itemTitle: { fontSize: font.size.md, fontWeight: font.weight.medium, color: colors.text },
  itemMeta: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
  delete: { color: colors.danger, fontSize: font.size.md, fontWeight: font.weight.bold, paddingHorizontal: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  chips: { marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  times: { flexDirection: 'row', gap: spacing.sm },
  time: { flex: 1 },
  hint: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.sm },
});
