import React from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';
import { useProBookingMutations, useProPendingBookings, useProSalon } from '@salondz/api-client';
import { useRealtimeBookings } from '@/lib/realtime';
import { BookingCard, Button, EmptyState, ErrorText, Loading, Screen, Title, errorMessage } from '@/components';
import { spacing } from '@/theme/tokens';

/** Demandes de réservation en attente de confirmation. */
export default function Demandes() {
  const salon = useProSalon().data?.salon ?? null;
  const pending = useProPendingBookings();
  const { setStatus, cancel } = useProBookingMutations();
  useRealtimeBookings(salon?.id);

  const onError = (e: unknown) => Alert.alert('Action impossible', errorMessage(e));
  const items = pending.data?.items ?? [];

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshing={pending.isRefetching}
        onRefresh={() => void pending.refetch()}
        ListHeaderComponent={<Title>Demandes</Title>}
        renderItem={({ item }) => (
          <BookingCard booking={item} title={item.clientName} staffName={item.staff?.displayName}>
            <Button title="Confirmer" size="sm" onPress={() => setStatus.mutate({ id: item.id, status: 'confirmed' }, { onError })} loading={setStatus.isPending && setStatus.variables?.id === item.id} />
            <Button
              title="Refuser"
              size="sm"
              variant="danger"
              onPress={() =>
                Alert.alert('Refuser cette demande ?', 'Le client sera prévenu.', [
                  { text: 'Non', style: 'cancel' },
                  { text: 'Refuser', style: 'destructive', onPress: () => cancel.mutate({ id: item.id, reason: 'Créneau indisponible' }, { onError }) },
                ])
              }
            />
          </BookingCard>
        )}
        ListEmptyComponent={
          pending.isLoading ? (
            <Loading inline />
          ) : pending.isError ? (
            <ErrorText error={pending.error} onRetry={() => void pending.refetch()} />
          ) : (
            <EmptyState icon="checkmark-done-outline" title="Aucune demande en attente" description={salon?.autoConfirm ? 'Vos réservations en ligne sont confirmées automatiquement.' : 'Les nouvelles demandes apparaîtront ici en temps réel.'} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
});
