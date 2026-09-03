import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AvailabilitySlot } from '@salondz/types';
import { formatTimeDZ } from '@salondz/constants';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface SlotGridProps {
  slots: AvailabilitySlot[];
  value: string | null;
  onChange: (startsAt: string) => void;
}

function period(iso: string): 'matin' | 'après-midi' | 'soir' {
  const h = Number(formatTimeDZ(iso).slice(0, 2));
  if (h < 12) return 'matin';
  if (h < 17) return 'après-midi';
  return 'soir';
}

/** Grille de créneaux groupés matin / après-midi / soir. */
export function SlotGrid({ slots, value, onChange }: SlotGridProps) {
  const groups = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const p = period(s.startsAt);
    groups.set(p, [...(groups.get(p) ?? []), s]);
  }
  return (
    <View>
      {[...groups.entries()].map(([label, items]) => (
        <View key={label} style={styles.group}>
          <Text style={styles.groupTitle}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
          <View style={styles.grid}>
            {items.map((s) => {
              const selected = s.startsAt === value;
              return (
                <Pressable
                  key={s.startsAt}
                  onPress={() => onChange(s.startsAt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.slot, selected && styles.slotSelected]}
                >
                  <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{formatTimeDZ(s.startsAt)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  groupTitle: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: font.weight.medium },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, minWidth: 72, alignItems: 'center' },
  slotSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.medium },
  slotTextSelected: { color: colors.textOnPrimary },
});
