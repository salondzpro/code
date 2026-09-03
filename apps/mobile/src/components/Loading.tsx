import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/theme/tokens';

export function Loading({ label, inline }: { label?: string; inline?: boolean }) {
  return (
    <View style={inline ? styles.inline : styles.full}>
      <ActivityIndicator size={inline ? 'small' : 'large'} color={colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bg },
  inline: { alignItems: 'center', padding: spacing.lg },
  label: { marginTop: spacing.sm, color: colors.textMuted, fontSize: font.size.sm },
});
