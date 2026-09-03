import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/theme/tokens';

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  pageTitle: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text, marginBottom: spacing.md },
  muted: { fontSize: font.size.sm, color: colors.textMuted },
});
