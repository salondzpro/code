import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { DAY_LABELS_FR, DEFAULT_OPENING_HOURS, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import { setOpeningHoursSchema } from '@salondz/validation';
import { Button, Loading, Muted, Screen, TextField, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface DayRow {
  dayOfWeek: DayOfWeek;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

/** Horaires d'ouverture — une plage par jour, dimanche en premier. */
export default function Horaires() {
  const salon = useProSalon().data?.salon ?? null;
  const { setHours } = useProSalonMutations();
  const [rows, setRows] = useState<DayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon) return;
    setRows(
      WEEK_DAYS.map((d) => {
        const h = salon.openingHours.find((x) => x.dayOfWeek === d);
        const def = DEFAULT_OPENING_HOURS[d]!;
        return { dayOfWeek: d, opensAt: h?.opensAt ?? def.opensAt, closesAt: h?.closesAt ?? def.closesAt, isClosed: h ? h.isClosed : def.isClosed };
      }),
    );
  }, [salon]);

  if (!salon || rows.length === 0) return <Loading />;

  const patch = (d: DayOfWeek, p: Partial<DayRow>) => setRows((r) => r.map((x) => (x.dayOfWeek === d ? { ...x, ...p } : x)));

  const copyToAll = (d: DayOfWeek) => {
    const src = rows.find((x) => x.dayOfWeek === d)!;
    setRows((r) => r.map((x) => ({ ...x, opensAt: src.opensAt, closesAt: src.closesAt })));
  };

  const save = () => {
    const parsed = setOpeningHoursSchema.safeParse({ hours: rows });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue?.path[1] === 'number' ? issue.path[1] : null;
      return setError(`${idx !== null ? DAY_LABELS_FR[rows[idx]!.dayOfWeek] + ' : ' : ''}${issue?.message ?? 'Horaires invalides'}`);
    }
    setError(null);
    setHours.mutate(parsed.data, {
      onSuccess: () => Alert.alert('Horaires enregistrés'),
      onError: (e) => setError(errorMessage(e)),
    });
  };

  return (
    <Screen scroll>
      <Muted>Format 24 h (ex : 09:00 – 19:00). Les créneaux proposés aux clients s'appuient sur ces horaires.</Muted>
      <View style={{ height: spacing.md }} />
      {rows.map((r) => (
        <View key={r.dayOfWeek} style={[styles.row, r.isClosed && styles.rowClosed]}>
          <View style={styles.dayHead}>
            <Text style={styles.day}>{DAY_LABELS_FR[r.dayOfWeek]}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{r.isClosed ? 'Fermé' : 'Ouvert'}</Text>
              <Switch value={!r.isClosed} onValueChange={(v) => patch(r.dayOfWeek, { isClosed: !v })} trackColor={{ true: colors.success }} />
            </View>
          </View>
          {!r.isClosed ? (
            <View style={styles.times}>
              <TextField value={r.opensAt} onChangeText={(t) => patch(r.dayOfWeek, { opensAt: t })} placeholder="09:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
              <Text style={styles.dash}>–</Text>
              <TextField value={r.closesAt} onChangeText={(t) => patch(r.dayOfWeek, { closesAt: t })} placeholder="19:00" keyboardType="numbers-and-punctuation" containerStyle={styles.time} />
              <Button title="Tous" variant="ghost" size="sm" onPress={() => copyToAll(r.dayOfWeek)} />
            </View>
          ) : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Enregistrer" onPress={save} loading={setHours.isPending} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  rowClosed: { opacity: 0.7 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchLabel: { fontSize: font.size.sm, color: colors.textMuted },
  times: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  time: { flex: 1, marginBottom: 0 },
  dash: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.sm },
});
