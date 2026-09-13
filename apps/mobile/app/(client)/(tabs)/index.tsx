/**
 * C-H 01 / C-F 01 — Marketplace « Pour Hommes » / « Pour Femmes ».
 *
 * L'écran ne garde que ce qui INFORME : la recherche en cours, le marché affiché et les
 * résultats. Les CHOIX (prestations, disponibilité, note, tri) vivent dans les deux
 * panneaux de `SearchTools` — jumeau du web. L'avatar a disparu d'ici : l'onglet Profil
 * mène déjà au même endroit. C-H 08 — aucun résultat.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeftRight, Search } from 'lucide-react-native';
import { pagesItems, useMe, useSalonSearchInfinite, useUpdateProfile } from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import {
  MARKET_LABELS_FR,
  categoryLabel,
  type CategoryId,
  type Market,
} from '@salondz/constants';
import { useLocationPrefs } from '@/lib/prefs';
import { ErrorText, H1, I, IconButton, P, Pill, Skeleton, Tx } from '@/ui';
import { SearchField, SearchTools } from '@/ui/SearchTools';
import { Screen } from '@/ui/Screen';
import { SalonListCard } from '@/ui/SalonListCard';
import { C, NAV_PAD } from '@/theme/design';

const NOUN: Record<Market, [string, string]> = {
  men: ['barbier', 'barbiers'],
  women: ['salon', 'salons'],
};

export default function Marketplace() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const market: Market = me.data?.profile.market ?? 'women';
  const q = params.q ?? '';
  const [category, setCategory] = useState<string>(params.category ?? '');

  const query = useSalonSearchInfinite({
    q: q || undefined,
    gender: market,
    category: category ? (category as CategoryId) : undefined,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? prefs.radiusKm : undefined,
    sort: prefs.sort,
    availableToday: prefs.availableToday || undefined,
    ratingMin: prefs.ratingMin ?? undefined,
    limit: 20,
  });

  const swapMarket = () => update.mutate({ market: market === 'men' ? 'women' : 'men' });
  const all = pagesItems(query.data);
  // « Ouvert maintenant » se filtre côté client : l'état d'ouverture est déjà dans chaque carte.
  const items = prefs.openNow ? all.filter((s) => s.isOpenNow) : all;
  const total = prefs.openNow ? items.length : (query.data?.pages[0]?.total ?? items.length);

  const noun = NOUN[market][total > 1 ? 1 : 0];
  // Compteur honnête : « disponibles aujourd'hui » seulement si des créneaux du jour existent dans la page.
  const todayCount = items.filter((x) => x.nextSlots.length > 0).length;
  const countLabel =
    todayCount > 0
      ? `${todayCount} ${NOUN[market][todayCount > 1 ? 1 : 0]} disponible${todayCount > 1 ? 's' : ''} aujourd'hui`
      : `${total} ${noun} · prochaines disponibilités ci-dessous`;

  return (
    <Screen
      gap={9}
      bottom={NAV_PAD}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <SearchField
        market={market}
        q={q}
        place={prefs.label}
        radiusKm={prefs.radiusKm}
        wilaya={prefs.wilaya}
        onQuery={(v) => router.setParams({ q: v })}
      />
      <SearchTools
        market={market}
        category={category}
        onCategory={setCategory}
        view="list"
        onView={() => router.push({ pathname: '/carte', params: category ? { category } : {} })}
      />

      {/* Titre du marché affiché, au-dessus des résultats qu'il commande. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          borderTopWidth: 1,
          borderTopColor: C.line,
          paddingTop: 9,
        }}
      >
        <H1 size={23} lh={26} ls={-0.8}>
          {market === 'women' ? 'Pour ' : MARKET_LABELS_FR[market]}
          {market === 'women' && (
            <Tx size={24} weight={700} lh={26} ls={-0.8} color={C.women}>
              Femmes
            </Tx>
          )}
        </H1>
        <IconButton
          accessibilityLabel="Changer de marché"
          onPress={swapMarket}
          disabled={update.isPending}
          style={{ width: 29, height: 29, borderRadius: 10 }}
        >
          <I icon={ArrowLeftRight} size={14} />
        </IconButton>
      </View>

      {/* Résultats */}
      {query.isPending ? (
        <View style={{ gap: 10 }}>
          <Skeleton h={16} w={182} />
          <Skeleton h={309} radius={16} />
          <Skeleton h={162} radius={16} />
        </View>
      ) : query.isError ? (
        <ErrorText error={query.error} retry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingTop: 22 }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: C.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <I icon={Search} size={36} color={C.subtle} />
          </View>
          <Tx size={16} weight={700} ls={-0.4} lh={19.5} center style={{ marginTop: 6 }}>
            Aucun professionnel{category ? ` « ${categoryLabel(category as CategoryId)} »` : ''} à{' '}
            {prefs.label}
          </Tx>
          <P center>Essayez d'élargir le rayon ou de retirer un filtre.</P>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 6,
            }}
          >
            {prefs.radiusKm < 10 && (
              <Pill lg onPress={() => setPrefs({ radiusKm: 10 })}>
                Rayon 10 km
              </Pill>
            )}
            {/* Un filtre rangé dans un panneau ne se voit plus : il faut une sortie ici. */}
            {(prefs.availableToday || prefs.openNow || prefs.ratingMin != null) && (
              <Pill
                lg
                onPress={() =>
                  setPrefs({ availableToday: false, openNow: false, ratingMin: null })
                }
              >
                Retirer les filtres
              </Pill>
            )}
            {!!category && (
              <Pill lg onPress={() => setCategory('')}>
                Retirer « {categoryLabel(category as CategoryId).split(' ')[0]} »
              </Pill>
            )}
            <Pill lg onPress={() => router.push('/localisation')}>
              Autres quartiers
            </Pill>
          </View>
        </View>
      ) : (
        <>
          <Tx size={12} weight={600} lh={16}>
            {countLabel}
          </Tx>
          <View style={{ gap: 11 }}>
            {items.map((s) => (
              <SalonListCard key={s.id} salon={s} />
            ))}
          </View>
          <LoadMore
            hasMore={query.hasNextPage}
            loading={query.isFetchingNextPage}
            onMore={() => void query.fetchNextPage()}
            label="Voir plus de professionnels"
          />
        </>
      )}
    </Screen>
  );
}
