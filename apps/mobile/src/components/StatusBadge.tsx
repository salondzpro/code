import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BOOKING_STATUS_LABELS_FR, type BookingStatus } from '@salondz/constants';
import { font, radius, spacing, statusColors } from '@/theme/tokens';

export function StatusBadge({ status }: { status: BookingStatus }) {
  const c = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{BOOKING_STATUS_LABELS_FR[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: font.size.xs, fontWeight: font.weight.semibold },
});
