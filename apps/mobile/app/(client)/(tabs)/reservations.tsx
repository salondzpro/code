import React, { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCancelBooking, useMyBookings } from '@salondz/api-client';
import { CLIENT_CANCEL_MIN_HOURS } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { BookingCard, Button, Chip, EmptyState, ErrorText, Loading, Screen, Title, errorMessage } from '@/components';
import { spacing } from '@/theme/tokens';

export default function Reservations() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
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
          onAction={() => router.push({ pathname: '/(auth)/connexion', params: { redirect: '/(client)/(tabs)/reservations' } } as never)}
        />
      </Screen>
    );
  }

  const confirmCancel = (id: string, startsAt: string) => {
    const hours = (new Date(startsAt).getTime() - Date.now()) / 3_600_000;
    if (hours < CLIENT_CANCEL_MIN_HOURS) {
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
              <Button title="Annuler" variant="danger" size="sm" onPress={() => confirmCancel(item.id, item.startsAt)} loading={cancel.isPending && cancel.variables?.id === item.id} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  tabs: { flexDirection: 'row', marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
});
