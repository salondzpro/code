import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '@/theme/tokens';
import { Button } from './Button';

interface EmptyStateProps {
  /** Icône Ionicons — l'illustration du design viendra la remplacer. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'sparkles-outline', title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <Ionicons name={icon} size={40} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  illustration: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text, textAlign: 'center' },
  description: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
