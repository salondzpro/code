import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDaysToKey, DAY_LABELS_SHORT_FR, dayOfWeekFromKey, toLocalDateKey, weekKeys } from '@salondz/constants';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface WeekStripProps {
  /** "YYYY-MM-DD" sélectionné. */
  value: string;
  onChange: (dateKey: string) => void;
  /** Jours antérieurs désactivés (défaut : aujourd'hui). null = aucun minimum. */
  minDateKey?: string | null;
  maxDateKey?: string | null;
  /** Jours ayant un indicateur (ex : réservations). */
  markedDays?: ReadonlySet<string>;
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthLabel(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  return `${MONTHS_FR[(m ?? 1) - 1]} ${y}`;
}

/** Bande de 7 jours, DIMANCHE en premier (convention algérienne). */
export function WeekStrip({ value, onChange, minDateKey = toLocalDateKey(), maxDateKey = null, markedDays }: WeekStripProps) {
  const days = weekKeys(value);
  const today = toLocalDateKey();
  const first = days[0]!;
  const last = days[6]!;
  const canPrev = !minDateKey || addDaysToKey(first, -1) >= minDateKey || first > minDateKey;
  const canNext = !maxDateKey || addDaysToKey(last, 1) <= maxDateKey;

  const goPrev = () => {
    const target = addDaysToKey(first, -7);
    onChange(minDateKey && target < minDateKey ? minDateKey : target);
  };
  const goNext = () => onChange(addDaysToKey(first, 7));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={goPrev} disabled={!canPrev} hitSlop={8} style={{ opacity: canPrev ? 1 : 0.3 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.month}>{monthLabel(value)}</Text>
        <Pressable onPress={goNext} disabled={!canNext} hitSlop={8} style={{ opacity: canNext ? 1 : 0.3 }}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {days.map((key) => {
          const disabled = (!!minDateKey && key < minDateKey) || (!!maxDateKey && key > maxDateKey);
          const selected = key === value;
          const dow = dayOfWeekFromKey(key);
          const dayNum = Number(key.slice(8, 10));
          return (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => onChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={[styles.day, selected && styles.daySelected, disabled && styles.dayDisabled]}
            >
              <Text style={[styles.dow, selected && styles.textSelected]}>{DAY_LABELS_SHORT_FR[dow]}</Text>
              <Text style={[styles.num, selected && styles.textSelected, key === today && !selected && styles.today]}>{dayNum}</Text>
              <View style={[styles.dot, markedDays?.has(key) ? { backgroundColor: selected ? colors.textOnPrimary : colors.primary } : null]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  month: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, textTransform: 'capitalize' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  daySelected: { backgroundColor: colors.primary },
  dayDisabled: { opacity: 0.35 },
  dow: { fontSize: font.size.xs, color: colors.textMuted },
  num: { fontSize: font.size.md, fontWeight: font.weight.semibold, color: colors.text, marginTop: 2 },
  today: { color: colors.primary },
  textSelected: { color: colors.textOnPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: 'transparent' },
});
