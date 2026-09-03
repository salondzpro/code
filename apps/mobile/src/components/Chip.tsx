import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[styles.chip, selected && styles.selected, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: font.size.sm, color: colors.text, fontWeight: font.weight.medium },
  textSelected: { color: colors.textOnPrimary },
});
