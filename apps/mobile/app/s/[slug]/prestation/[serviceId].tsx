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
      <View style={{ height: 330, backgroundColor: C.line }}>
        <Img src={photos[0]?.url ?? s.coverUrl} radius={0} style={{ height: 330 }} />
        <View style={{ position: 'absolute', left: 20, right: 20, top: insets.top + 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton lg accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/s/${s.slug}` as never))}>
            <I icon={ChevronLeft} />
          </IconButton>
          <IconButton lg accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} accessibilityState={{ selected: isFav }} onPress={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : router.push({ pathname: '/connexion', params: { next: `/s/${s.slug}/prestation/${sv.id}` } }))}>
            <Heart size={22} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
          </IconButton>
        </View>
      </View>
      <View style={{ marginTop: -20, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <H1 size={30} lh={34} ls={-0.8}>
              {sv.name}
            </H1>
            <Tx size={17} color={C.muted} lh={23} style={{ marginTop: 4 }}>
              {formatDuration(sv.durationMinutes)}
              {sv.categoryId ? ` · ${categoryLabel(sv.categoryId)}` : ''}
            </Tx>
          </View>
          <Tx size={26} weight={700} ls={-0.5} lh={31}>
            {formatDA(sv.priceDa)}
          </Tx>
        </View>
        {!!sv.description && (
          <Tx size={17} color={C.muted} lh={25}>
            {sv.description}
          </Tx>
        )}
        {photos.length > 1 && (
          <>
            <SectionLabel>Réalisations</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {photos.slice(1).map((p) => (
                <Img key={p.id} src={p.url} style={{ width: 220, height: 200 }} />
              ))}
            </ScrollView>
          </>
        )}
        <Card row gap={14}>
          <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={64} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={20} weight={700} ls={-0.3} lh={25}>
              {s.name}
            </Tx>
            <Tx size={16} color={C.muted} lh={22}>
              {s.zone ?? s.city}
              {s.ratingCount > 0 ? ` · ★ ${formatRating(s.ratingAvg)}` : ''}
            </Tx>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.pill, backgroundColor: status.open ? C.okBg : C.fill, paddingHorizontal: 12, paddingVertical: 7 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.open ? C.okFg : C.muted }} />
            <Tx size={15} weight={600} lh={19} color={status.open ? C.okFg : C.muted}>
              {status.open ? 'Ouvert' : 'Fermé'}
            </Tx>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
