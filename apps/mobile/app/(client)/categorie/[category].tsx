/** C-H 06 / C-F 02 — Résultats d'une catégorie : filtres rapides (dispo aujourd'hui, < 2 km, prix, note). */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { categoryLabel, type CategoryId } from '@salondz/constants';
import { useLocationPrefs } from '@/lib/prefs';
import { ErrorText, H1, P, Pill, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { SalonListCard } from '@/ui/SalonListCard';
import { C, NAV_PAD } from '@/theme/design';

export default function CategoryResults() {
  const { category = '' } = useLocalSearchParams<{ category: string }>();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const [today, setToday] = useState(true);
  const [near, setNear] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'price_asc' | 'rating'>('relevance');

  const query = useSalonSearch({
    gender: market,
    category: category as CategoryId,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? (near ? 2 : prefs.radiusKm) : undefined,
    availableToday: today ? '1' : undefined,
    sort,
    limit: 30,
  } as Parameters<typeof useSalonSearch>[0]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;
  const noun = market === 'men' ? 'barbiers' : 'salons';

  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <TopBar backTo="/(client)/(tabs)" right={<Pill soft>{market === 'men' ? 'Homme' : 'Femme'}</Pill>} />
      <H1>{categoryLabel(category as CategoryId)}</H1>
      <PillRow>
        <Pill lg on={today} onPress={() => setToday((v) => !v)}>
          Dispo aujourd'hui
        </Pill>
        <Pill lg on={near} onPress={() => setNear((v) => !v)} disabled={prefs.lat == null}>
          {'< 2 km'}
        </Pill>
        <Pill lg on={sort === 'price_asc'} onPress={() => setSort(sort === 'price_asc' ? 'relevance' : 'price_asc')}>
          Prix
        </Pill>
        <Pill lg on={sort === 'rating'} onPress={() => setSort(sort === 'rating' ? 'relevance' : 'rating')}>
          Note
        </Pill>
      </PillRow>
      {query.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={20} w={224} />
          <Skeleton h={200} radius={20} />
          <Skeleton h={200} radius={20} />
        </View>
      ) : query.isError ? (
        <ErrorText error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Tx size={17} color={C.muted} lh={22}>
            {total} {noun} autour {/^[aeiouyhé]/i.test(prefs.label) ? "d'" : 'de '}
            {prefs.label}
          </Tx>
          {items.length === 0 && <P>Aucun résultat avec ces filtres.</P>}
          <View style={{ gap: 14 }}>
            {items.map((s) => (
              <SalonListCard key={s.id} salon={s} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
