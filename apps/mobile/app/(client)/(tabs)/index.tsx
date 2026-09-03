import React, { useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSalonSearch } from '@salondz/api-client';
import { CATEGORIES, type CategoryId } from '@salondz/constants';
import { useDebounce } from '@/lib/use-debounce';
import { Chip, EmptyState, ErrorText, Loading, SalonCard, Screen, TextField, Title, WilayaPicker } from '@/components';
import { spacing } from '@/theme/tokens';

/** Explorer : recherche par texte, wilaya, catégorie. */
export default function Explorer() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [wilaya, setWilaya] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState<CategoryId | undefined>(undefined);
  const debouncedQ = useDebounce(q.trim());
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const search = useSalonSearch({ q: debouncedQ || undefined, wilaya, category, lat: near?.lat, lng: near?.lng });

  /** « Autour de moi » : position de l'appareil → tri par distance côté API (distanceKm sur les cartes). */
  const toggleNear = async () => {
    if (near) return setNear(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Localisation refusée', 'Autorisez la localisation pour trier les salons par distance.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNear({ lat: Number(pos.coords.latitude.toFixed(4)), lng: Number(pos.coords.longitude.toFixed(4)) });
    } catch {
      Alert.alert('Position indisponible', 'Réessayez dans un instant.');
    } finally {
      setLocating(false);
    }
  };
  const items = search.data?.items ?? [];

  const header = (
    <View style={styles.header}>
      <Title>Trouvez votre salon</Title>
      <TextField placeholder="Salon, barbier, service…" value={q} onChangeText={setQ} returnKeyType="search" autoCorrect={false} />
      <WilayaPicker value={wilaya} onChange={setWilaya} allowAll />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Chip label={locating ? 'Localisation…' : near ? '📍 Autour de moi ✕' : '📍 Autour de moi'} selected={!!near} disabled={locating} onPress={() => void toggleNear()} />
        <Chip label="Tout" selected={!category} onPress={() => setCategory(undefined)} />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.labelFr} selected={category === c.id} onPress={() => setCategory(category === c.id ? undefined : c.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshing={search.isRefetching}
        onRefresh={() => void search.refetch()}
        renderItem={({ item }) => <SalonCard salon={item} onPress={() => router.push(`/(client)/salon/${item.slug}` as never)} />}
        ListEmptyComponent={
          search.isLoading ? (
            <Loading inline label="Recherche…" />
          ) : search.isError ? (
            <ErrorText error={search.error} onRetry={() => void search.refetch()} />
          ) : (
            <EmptyState
              icon="storefront-outline"
              title="Aucun salon trouvé"
              description="Essayez une autre wilaya ou une autre catégorie. De nouveaux salons rejoignent SalonDZ chaque semaine."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chips: { marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
});
