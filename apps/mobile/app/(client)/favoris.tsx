import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFavorites } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { EmptyState, ErrorText, Loading, SalonCard, Screen } from '@/components';
import { spacing } from '@/theme/tokens';

/** Salons mis en favori (cœur sur la page salon). */
export default function Favoris() {
  const router = useRouter();
  const { session } = useAuth();
  const favs = useFavorites(!!session);
  const items = favs.data?.items ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Mes favoris' }} />
      <Screen padded={false}>
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshing={favs.isRefetching}
          onRefresh={() => void favs.refetch()}
          renderItem={({ item }) => <SalonCard salon={item} onPress={() => router.push(`/(client)/salon/${item.slug}` as never)} />}
          ListEmptyComponent={
            !session ? (
              <EmptyState
                icon="heart-outline"
                title="Connectez-vous"
                description="Vos salons favoris vous suivent sur tous vos appareils."
                actionLabel="Se connecter"
                onAction={() => router.push({ pathname: '/connexion', params: { redirect: '/(client)/favoris' } } as never)}
              />
            ) : favs.isLoading ? (
              <Loading inline />
            ) : favs.isError ? (
              <ErrorText error={favs.error} onRetry={() => void favs.refetch()} />
            ) : (
              <EmptyState
                icon="heart-outline"
                title="Aucun salon en favori"
                description="Touchez le cœur sur la page d'un salon pour le retrouver ici."
                actionLabel="Explorer les salons"
                onAction={() => router.push('/(client)/(tabs)' as never)}
              />
            )
          }
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
