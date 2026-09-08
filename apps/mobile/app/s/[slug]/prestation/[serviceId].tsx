/** C-F 07 — Détail de la prestation : photo plein cadre, nom + prix, durée · catégorie, description, réalisations, salon, « Réserver · 2 500 DA ». */
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart } from 'lucide-react-native';
import { useFavorites, useSalon, useToggleFavorite } from '@salondz/api-client';
import { categoryLabel, formatDA } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatRating } from '@/lib/format';
import { openingStatus } from '@/lib/salon';
import { Avatar, BottomSheet, Button, Card, ErrorText, H1, I, IconButton, Img, SectionLabel, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

export default function ServiceDetail() {
  const { slug = '', serviceId = '' } = useLocalSearchParams<{ slug: string; serviceId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  const sv = s.services.find((x) => x.id === serviceId);
  if (!sv)
    return (
      <Screen center>
        <ErrorText error={new Error('Prestation introuvable')} />
      </Screen>
    );
  const photos = sv.photos ?? [];
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const status = openingStatus(s);

  return (
    <Screen
      px={0}
      top={0}
      gap={0}
      edges={[]}
      footer={
        <BottomSheet grab={false}>
          <Button onPress={() => router.push({ pathname: `/s/${s.slug}/prestations`, params: { services: sv.id } } as never)}>Réserver · {formatDA(sv.priceDa)}</Button>
        </BottomSheet>
      }
    >
      <View style={{ height: 268, backgroundColor: C.line }}>
        <Img src={photos[0]?.url ?? s.coverUrl} radius={0} style={{ height: 268 }} />
        <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton lg accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/s/${s.slug}` as never))}>
            <I icon={ChevronLeft} />
          </IconButton>
          <IconButton lg accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} accessibilityState={{ selected: isFav }} onPress={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : router.push({ pathname: '/connexion', params: { next: `/s/${s.slug}/prestation/${sv.id}` } }))}>
            <Heart size={18} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
          </IconButton>
        </View>
      </View>
      <View style={{ marginTop: -16, backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 20, gap: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <H1 size={21} lh={24.5} ls={-0.8}>
              {sv.name}
            </H1>
            <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
              {formatDuration(sv.durationMinutes)}
              {sv.categoryId ? ` · ${categoryLabel(sv.categoryId)}` : ''}
            </Tx>
          </View>
          <Tx size={18} weight={700} ls={-0.5} lh={22}>
            {formatDA(sv.priceDa)}
          </Tx>
        </View>
        {!!sv.description && (
          <Tx size={10.5} color={C.muted} lh={17}>
            {sv.description}
          </Tx>
        )}
        {photos.length > 1 && (
          <>
            <SectionLabel>Réalisations</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {photos.slice(1).map((p) => (
                <Img key={p.id} src={p.url} style={{ width: 179, height: 162 }} />
              ))}
            </ScrollView>
          </>
        )}
        <Card row gap={11}>
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={13} weight={700} ls={-0.3} lh={17}>
              {s.name}
            </Tx>
            <Tx size={10.5} color={C.muted} lh={15.5}>
              {s.zone ?? s.city}
              {s.ratingCount > 0 ? ` · ★ ${formatRating(s.ratingAvg)}` : ''}
            </Tx>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, backgroundColor: status.open ? C.okBg : C.fill, paddingHorizontal: 10, paddingVertical: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2, backgroundColor: status.open ? C.okFg : C.muted }} />
            <Tx size={12} weight={600} lh={15.5} color={status.open ? C.okFg : C.muted}>
              {status.open ? 'Ouvert' : 'Fermé'}
            </Tx>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
