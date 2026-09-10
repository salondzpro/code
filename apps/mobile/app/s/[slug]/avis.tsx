/**
 * C-F 04 → Avis du salon : ouverts depuis la puce « ★ 4,8 · 12 avis » de la page du salon. Résumé, tri
 * « Mieux notés » (défaut) / « Plus récents », cartes (étoiles, date, prénom, commentaire), pagination.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  pagesItems,
  useSalon,
  useSalonReviewsInfinite,
  type ReviewSort,
} from '@salondz/api-client';
import { formatDateShortDZ } from '@salondz/constants';
import { LoadMore } from '@/ui/LoadMore';
import { formatRating } from '@/lib/format';
import { Card, ErrorText, H1, P, Pill, Skeleton, TopBar, Tx } from '@/ui';
import { PillRow } from '@/ui/Pills';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function SalonReviews() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const salon = useSalon(slug);
  const [sort, setSort] = useState<ReviewSort>('best');
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 10, sort);
  const reviewItems = pagesItems(reviews.data);
  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  const count = Math.max(s.ratingCount, reviewItems.length);
  const avg =
    s.ratingCount > 0 || reviewItems.length === 0
      ? s.ratingAvg
      : reviewItems.reduce((a, r) => a + r.rating, 0) / reviewItems.length;
  const has = count > 0;

  return (
    <Screen gap={13}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <H1>Avis</H1>
      {has ? (
        <Card row gap={13} style={{ alignItems: 'center' }}>
          <Tx size={32} weight={700} ls={-1} lh={36}>
            {formatRating(avg)}
          </Tx>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={14.5} weight={600} lh={19}>
              {'★'.repeat(Math.round(avg))}
              <Tx size={14.5} weight={600} lh={19} color={C.disabled}>
                {'★'.repeat(5 - Math.round(avg))}
              </Tx>
            </Tx>
            <Tx size={12} color={C.muted} lh={16}>
              {count} avis vérifié{count > 1 ? 's' : ''} · après rendez-vous
            </Tx>
          </View>
        </Card>
      ) : (
        <View style={{ paddingVertical: 10 }}>
          <P center>Pas encore d'avis : soyez le premier après votre rendez-vous.</P>
        </View>
      )}
      {has && (
        <PillRow>
          <Pill lg on={sort === 'best'} onPress={() => setSort('best')}>
            Mieux notés
          </Pill>
          <Pill lg on={sort === 'recent'} onPress={() => setSort('recent')}>
            Plus récents
          </Pill>
        </PillRow>
      )}
      {reviews.isPending && has && <Skeleton h={78} radius={16} />}
      {reviewItems.map((r) => (
        <Card key={r.id} gap={4}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Tx size={13.5} weight={600} lh={17.5}>
              {'★'.repeat(r.rating)}
              <Tx size={13.5} weight={600} lh={17.5} color={C.disabled}>
                {'★'.repeat(5 - r.rating)}
              </Tx>
            </Tx>
            <Tx size={10.5} color={C.muted} lh={14}>
              {formatDateShortDZ(r.createdAt)}
            </Tx>
          </View>
          <Tx size={13} weight={600} lh={17}>
            {r.authorName}
          </Tx>
          {!!r.comment && <P>{r.comment}</P>}
        </Card>
      ))}
      <LoadMore
        hasMore={reviews.hasNextPage}
        loading={reviews.isFetchingNextPage}
        onMore={() => void reviews.fetchNextPage()}
        label="Voir plus d'avis"
      />
    </Screen>
  );
}
