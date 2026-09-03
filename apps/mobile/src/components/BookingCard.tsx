import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Booking } from '@salondz/types';
import { formatDA, formatDateShortDZ, formatDZPhone, formatTimeDZ } from '@salondz/constants';
import { colors, font, radius, shadow, spacing } from '@/theme/tokens';
import { StatusBadge } from './StatusBadge';

interface BookingCardProps {
  booking: Booking;
  /** Nom du salon (vue client) ou du client (vue pro). */
  title: string;
  subtitle?: string | null;
  staffName?: string | null;
  showDate?: boolean;
  children?: React.ReactNode;
}

export function BookingCard({ booking, title, subtitle, staffName, showDate = true, children }: BookingCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.time}>
          {showDate ? <Text style={styles.date}>{formatDateShortDZ(booking.startsAt)}</Text> : null}
          <Text style={styles.hour}>
            {formatTimeDZ(booking.startsAt)} – {formatTimeDZ(booking.endsAt)}
          </Text>
        </View>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.service}>
        {booking.serviceName} · {booking.durationMinutes} min · {formatDA(booking.priceDa)}
      </Text>
      {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
      {staffName ? <Text style={styles.meta}>Avec {staffName}</Text> : null}
      {booking.clientPhone && !subtitle ? <Text style={styles.meta}>{formatDZPhone(booking.clientPhone)}</Text> : null}
      {booking.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          « {booking.notes} »
        </Text>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: 4, ...shadow.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  time: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  date: { fontSize: font.size.sm, color: colors.textMuted, textTransform: 'capitalize' },
  hour: { fontSize: font.size.md, fontWeight: font.weight.bold, color: colors.primaryDark },
  title: { fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text },
  service: { fontSize: font.size.sm, color: colors.text },
  meta: { fontSize: font.size.sm, color: colors.textMuted },
  notes: { fontSize: font.size.sm, color: colors.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
