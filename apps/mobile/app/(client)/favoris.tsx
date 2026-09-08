/** C-F 21 — Salons favoris : filtre Tous / Pour Femmes / Pour Hommes, cœur plein pour retirer. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useFavorites, useToggleFavorite } from '@salondz/api-client';
import { categoryLabel, salonMarkets, type Market, relativeDayLabelDZ } from '@salondz/constants';
import { Avatar, Button, Card, ErrorText, H1, P, Pill, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { RatingPill } from '@/ui/SalonListCard';
import { C, NAV_PAD } from '@/theme/design';

export default function Favorites() {
  const router = useRouter();
  const favs = useFavorites();
  const toggle = useToggleFavorite();
  const [filter, setFilter] = useState<'all' | Market>('all');
  const all = favs.data?.items ?? [];
  const items = filter === 'all' ? all : all.filter((s) => salonMarkets(s.genderTarget).includes(filter));

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <TopBar backTo="/(client)/(tabs)/profil" right="Favoris" />
      <H1>Mes favoris</H1>
      <PillRow>
        <Pill lg on={filter === 'all'} onPress={() => setFilter('all')}>
          {`Tous · ${all.length}`}
        </Pill>
        <Pill lg on={filter === 'women'} onPress={() => setFilter('women')}>
          Pour Femmes
        </Pill>
        <Pill lg on={filter === 'men'} onPress={() => setFilter('men')}>
          Pour Hommes
        </Pill>
      </PillRow>
      {favs.isPending ? (
        <>
          <Skeleton h={114} radius={16} />
          <Skeleton h={114} radius={16} />
        </>
      ) : favs.isError ? (
        <ErrorText error={favs.error} retry={() => void favs.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 46 }}>
          <Tx size={14.5} weight={700} lh={18.5} center>
            Aucun salon en favori
          </Tx>
          <P center>Touchez le cœur sur la page d'un salon pour le retrouver ici.</P>
          <Button onPress={() => router.push('/(client)/(tabs)')} style={{ marginTop: 6 }}>
            Explorer les salons
          </Button>
        </View>
      ) : (
        items.map((s) => (
          <Card key={s.id} row gap={11}>
            <Pressable accessibilityRole="link" accessibilityLabel={s.name} onPress={() => router.push(`/s/${s.slug}` as never)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={88} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={14.5} weight={700} ls={-0.4} lh={18.5}>
                  {s.name}
                </Tx>
                <Tx size={10.5} color={C.muted} lh={15.5}>
                  {[...s.categoryIds.slice(0, 2).map((c) => categoryLabel(c)), s.zone ?? s.city].join(' · ')}
                </Tx>
                <Tx size={10.5} lh={15.5} style={{ marginTop: 3 }}>
                  {s.nextAvailable ? `Dispo ${relativeDayLabelDZ(s.nextAvailable.date).toLowerCase()} ${s.nextAvailable.slots[0]}` : 'Aucune disponibilité cette semaine'}
                </Tx>
              </View>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 10 }}>
              {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
              <Pressable accessibilityRole="button" accessibilityLabel="Retirer des favoris" onPress={() => toggle.mutate({ salonId: s.id, on: false })} disabled={toggle.isPending} hitSlop={8}>
                <Heart size={21} strokeWidth={1.6} color={C.text} fill={C.text} />
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
