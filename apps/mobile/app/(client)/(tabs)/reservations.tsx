import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAvailability, useCancelBooking, useMyBookings, useRescheduleBooking, useSalon } from '@salondz/api-client';
import type { BookingWithSalon } from '@salondz/types';
import { CLIENT_CANCEL_MIN_HOURS, addDaysToKey, formatDateLongDZ, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { BookingCard, Button, Chip, EmptyState, ErrorText, Loading, Screen, Sheet, SlotGrid, Title, WeekStrip, errorMessage } from '@/components';
import { colors, font, spacing } from '@/theme/tokens';

export default function Reservations() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [rescheduling, setRescheduling] = useState<BookingWithSalon | null>(null);
  const bookings = useMyBookings({ scope }, !!session);
  const cancel = useCancelBooking();
  useRealtimeMyBookings(user?.id);

  if (!session) {
    return (
      <Screen>
        <Title>Mes réservations</Title>
        <EmptyState
          icon="calendar-outline"
          title="Connectez-vous"
          description="Retrouvez ici vos rendez-vous à venir et votre historique."
          actionLabel="Se connecter"
          onAction={() => router.push({ pathname: '/connexion', params: { redirect: '/(client)/(tabs)/reservations' } } as never)}
        />
      </Screen>
    );
  }

  /** Annulation et report possibles jusqu'à CLIENT_CANCEL_MIN_HOURS avant le rendez-vous. */
  const tooLate = (startsAt: string) => (new Date(startsAt).getTime() - Date.now()) / 3_600_000 < CLIENT_CANCEL_MIN_HOURS;

  const confirmCancel = (id: string, startsAt: string) => {
    if (tooLate(startsAt)) {
      Alert.alert('Trop tard', `L'annulation en ligne n'est plus possible à moins de ${CLIENT_CANCEL_MIN_HOURS} h du rendez-vous. Contactez le salon.`);
      return;
    }
    Alert.alert('Annuler le rendez-vous ?', 'Le salon sera prévenu.', [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Annuler le RDV',
        style: 'destructive',
        onPress: () => cancel.mutate({ id }, { onError: (e) => Alert.alert('Impossible', errorMessage(e)) }),
      },
    ]);
  };

  const startReschedule = (b: BookingWithSalon) => {
    if (tooLate(b.startsAt)) {
      Alert.alert('Trop tard', `Le report en ligne n'est plus possible à moins de ${CLIENT_CANCEL_MIN_HOURS} h du rendez-vous. Contactez le salon.`);
      return;
    }
    setRescheduling(b);
  };

  const items = bookings.data?.items ?? [];

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshing={bookings.isRefetching}
        onRefresh={() => void bookings.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Title>Mes réservations</Title>
            <View style={styles.tabs}>
              <Chip label="À venir" selected={scope === 'upcoming'} onPress={() => setScope('upcoming')} />
              <Chip label="Passées" selected={scope === 'past'} onPress={() => setScope('past')} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <BookingCard booking={item} title={item.salon.name} subtitle={`${item.salon.city}${item.salon.address ? ` · ${item.salon.address}` : ''}`} staffName={item.staff?.displayName}>
            <Button title="Voir le salon" variant="secondary" size="sm" onPress={() => router.push(`/(client)/salon/${item.salon.slug}` as never)} />
            {scope === 'upcoming' && (item.status === 'pending' || item.status === 'confirmed') ? (
              <>
                <Button title="Reporter" variant="ghost" size="sm" onPress={() => startReschedule(item)} />
                <Button title="Annuler" variant="danger" size="sm" onPress={() => confirmCancel(item.id, item.startsAt)} loading={cancel.isPending && cancel.variables?.id === item.id} />
              </>
            ) : null}
          </BookingCard>
        )}
        ListEmptyComponent={
          bookings.isLoading ? (
            <Loading inline />
          ) : bookings.isError ? (
            <ErrorText error={bookings.error} onRetry={() => void bookings.refetch()} />
          ) : (
            <EmptyState
              icon="cut-outline"
              title={scope === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
              description={scope === 'upcoming' ? 'Réservez en quelques secondes dans le salon de votre choix.' : undefined}
              actionLabel={scope === 'upcoming' ? 'Explorer les salons' : undefined}
              onAction={() => router.push('/(client)/(tabs)' as never)}
            />
          )
        }
      />
      {rescheduling ? <RescheduleSheet booking={rescheduling} onClose={() => setRescheduling(null)} /> : null}
    </Screen>
  );
}

/**
 * Report : même salon, même service, même membre ; seul le créneau change.
 * Les créneaux viennent de `get_available_slots` (source de vérité).
 */
function RescheduleSheet({ booking, onClose }: { booking: BookingWithSalon; onClose: () => void }) {
  const salon = useSalon(booking.salon.slug);
  const reschedule = useRescheduleBooking();
  const today = toLocalDateKey();
  const [date, setDate] = useState(() => toLocalDateKey(new Date(booking.startsAt)));
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availability = useAvailability(booking.salonId, { serviceId: booking.serviceId, date, ...(booking.staffId ? { staffId: booking.staffId } : {}) });
  const maxDate = salon.data ? addDaysToKey(today, salon.data.bookingHorizonDays) : null;

  useEffect(() => {
    setSlot(null);
  }, [date]);

  const confirm = () => {
    if (!slot) return;
    setError(null);
    reschedule.mutate(
      { id: booking.id, startsAt: slot, staffId: booking.staffId },
      {
        onSuccess: (b) => {
          Alert.alert('Rendez-vous reporté', `${formatDateLongDZ(b.startsAt)} à ${formatTimeDZ(b.startsAt)}`);
          onClose();
        },
        onError: (e) => {
          setError(errorMessage(e));
          setSlot(null);
          void availability.refetch();
        },
      },
    );
  };

  return (
    <Sheet visible onClose={onClose} title="Reporter le rendez-vous">
      <Text style={styles.sheetMeta}>
        {booking.salon.name} · {booking.serviceName}
        {booking.staff ? ` · avec ${booking.staff.displayName}` : ''}
      </Text>
      <WeekStrip value={date} onChange={setDate} maxDateKey={maxDate} />
      {availability.isLoading || availability.isFetching ? (
        <Loading inline label="Recherche des créneaux…" />
      ) : availability.isError ? (
        <ErrorText error={availability.error} onRetry={() => void availability.refetch()} />
      ) : (availability.data?.slots.length ?? 0) === 0 ? (
        <EmptyState icon="time-outline" title="Aucun créneau ce jour" description="Essayez un autre jour." />
      ) : (
        <SlotGrid slots={availability.data!.slots} value={slot} onChange={setSlot} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={slot ? `Reporter au ${formatDateLongDZ(slot)} à ${formatTimeDZ(slot)}` : 'Choisissez un créneau'}
        onPress={confirm}
        disabled={!slot}
        loading={reschedule.isPending}
        fullWidth
        style={{ marginTop: spacing.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  tabs: { flexDirection: 'row', marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sheetMeta: { color: colors.textMuted, fontSize: font.size.sm, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm, marginTop: spacing.sm },
});
