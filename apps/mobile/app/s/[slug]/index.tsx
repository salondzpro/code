/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import {
  pagesItems,
  useFavorites,
  useSalon,
  useSalonReviewsInfinite,
  useToggleFavorite,
  type ReviewSort,
} from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import {
  DAY_LABELS_FR,
  WEEK_DAYS,
  categoryLabel,
  formatDA,
  formatDZPhone,
  wilayaName,
  groupServices,
  formatDateShortDZ,
} from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatRating } from '@/lib/format';
import { open, openingStatus, publicUrl, shareUrl } from '@/lib/salon';
import {
  BottomSheet,
  Button,
  Card,
  ErrorText,
  Grid,
  H1,
  I,
  IconButton,
  Img,
  ListCard,
  P,
  Row,
  SectionLabel,
  Segmented,
  Tx,
  Pill,
  Skeleton,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

type Tab = 'services' | 'works' | 'infos' | 'avis';

export default function Salon() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  // Avis : mieux notés d'abord (puis plus récents), ou plus récents ; pagination « Voir plus d'avis ».
  const [sort, setSort] = useState<ReviewSort>('best');
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 10, sort);
  const reviewItems = pagesItems(reviews.data);
  const [tab, setTab] = useState<Tab>('services');

  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const status = openingStatus(s);
  const cats = s.categoryIds.map((c) => categoryLabel(c)).join(' · ');
  const place = `${s.zone ?? s.city}, ${wilayaName(s.wilayaCode)}`;
  const works = [...s.photos, ...s.services.flatMap((sv) => sv.photos ?? [])];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)'));

  return (
    <Screen
      px={0}
      top={0}
      gap={0}
      edges={[]}
      footer={
        <BottomSheet grab={false}>
          <Button onPress={() => router.push(`/s/${s.slug}/prestations` as never)}>Réserver</Button>
        </BottomSheet>
      }
    >
      {/* Couverture */}
      <View style={{ height: 244, backgroundColor: C.line }}>
        <Img src={s.coverUrl} radius={0} style={{ height: 244 }} />
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton lg accessibilityLabel="Retour" onPress={back}>
            <I icon={ChevronLeft} />
          </IconButton>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton
              lg
              accessibilityLabel="Partager"
              onPress={() => void shareUrl(s.name, publicUrl(s.slug))}
            >
              <I icon={Share2} size={16} />
            </IconButton>
            <IconButton
              lg
              accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              accessibilityState={{ selected: isFav }}
              disabled={toggle.isPending}
              onPress={() =>
                session
                  ? toggle.mutate({ salonId: s.id, on: !isFav })
                  : router.push({ pathname: '/connexion', params: { next: `/s/${s.slug}` } })
              }
            >
              <Heart size={18} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
            </IconButton>
          </View>
        </View>
      </View>

      <View
        style={{
          marginTop: -16,
          backgroundColor: C.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 20,
          gap: 13,
        }}
      >
        <View>
          <H1 size={21} lh={24.5} ls={-0.8}>
            {s.name}
          </H1>
          <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
            {cats} — {place}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {s.ratingCount > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${s.ratingCount} avis, note ${formatRating(s.ratingAvg)} sur 5 : voir les avis`}
              onPress={() => setTab('avis')}
              style={{
                backgroundColor: C.fill,
                borderRadius: R.pill,
                paddingHorizontal: 11,
                paddingVertical: 7,
              }}
            >
              <Tx size={12} weight={600} lh={15.5}>
                ★ {formatRating(s.ratingAvg)} · {s.ratingCount} avis
              </Tx>
            </Pressable>
          )}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              borderRadius: R.pill,
              backgroundColor: status.open ? C.okBg : C.fill,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2,
                backgroundColor: status.open ? C.okFg : C.muted,
              }}
            />
            <Tx size={12} weight={600} lh={15.5} color={status.open ? C.okFg : C.muted}>
              {status.label}
            </Tx>
          </View>
        </View>
        {!!s.description && (
          <Tx size={10.5} color={C.muted} lh={17}>
            {s.description}
          </Tx>
        )}

        <Segmented
          label="Sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'services', label: 'Prestations' },
            { value: 'works', label: 'Réalisations' },
            { value: 'infos', label: 'Infos' },
            { value: 'avis', label: s.ratingCount ? `Avis · ${s.ratingCount}` : 'Avis' },
          ]}
        />

        {tab === 'services' && (
          <View style={{ gap: 10 }}>
            {groupServices(s.services).map((g) => (
              <View key={g.name} style={{ gap: 6 }}>
                <SectionLabel>{g.name}</SectionLabel>
                <ListCard>
                  {g.services.map((sv) => (
                    <Row
                      key={sv.id}
                      to={`/s/${s.slug}/prestation/${sv.id}`}
                      py={16}
                      chevron={false}
                      right={
                        <Tx size={13} weight={600} lh={17}>
                          {formatDA(sv.priceDa)}
                        </Tx>
                      }
                    >
                      <Tx size={13} weight={600} lh={17}>
                        {sv.name}
                      </Tx>
                      <Tx size={12} color={C.muted} lh={16}>
                        {formatDuration(sv.durationMinutes)}
                      </Tx>
                    </Row>
                  ))}
                </ListCard>
              </View>
            ))}
            {s.services.length === 0 && (
              <View style={{ paddingVertical: 10 }}>
                <P>Aucune prestation pour le moment.</P>
              </View>
            )}
          </View>
        )}
        {tab === 'works' && (
          <>
            {works.length === 0 ? (
              <P>Pas encore de réalisations.</P>
            ) : (
              <Grid cols={2}>
                {works.slice(0, 8).map((p) => (
                  <Img key={p.id} src={p.url} style={{ width: '100%', aspectRatio: 1 }} />
                ))}
              </Grid>
            )}
            {works.length > 8 && (
              <Button variant="g" onPress={() => router.push(`/s/${s.slug}/realisations` as never)}>
                Voir toutes les réalisations
              </Button>
            )}
          </>
        )}

        {tab === 'infos' && (
          <View style={{ gap: 13 }}>
            <ListCard>
              {WEEK_DAYS.map((d) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <Row
                    key={d}
                    py={10}
                    chevron={false}
                    right={
                      <Tx size={10.5} lh={14.5} mono color={rows.length ? C.muted : C.danger}>
                        {rows.length
                          ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ')
                          : 'Fermé'}
                      </Tx>
                    }
                  >
                    <Tx size={10.5} lh={14.5}>
                      {DAY_LABELS_FR[d]}
                    </Tx>
                  </Row>
                );
              })}
            </ListCard>
            <ListCard>
              <Row
                py={10}
                chevron={false}
                right={
                  <Tx size={12} lh={16} right style={{ maxWidth: '60%' }}>
                    {[s.address, place].filter(Boolean).join(', ')}
                  </Tx>
                }
              >
                <Tx size={12} color={C.muted} lh={16}>
                  Adresse
                </Tx>
              </Row>
              {!!s.phone && (
                <Row
                  py={10}
                  chevron={false}
                  onPress={() => void open(`tel:${s.phone}`)}
                  right={
                    <Tx size={12} lh={16}>
                      {formatDZPhone(s.phone)}
                    </Tx>
                  }
                >
                  <Tx size={12} color={C.muted} lh={16}>
                    Téléphone
                  </Tx>
                </Row>
              )}
              {s.staff.length > 0 && (
                <Row
                  py={10}
                  chevron={false}
                  right={
                    <Tx size={12} lh={16} right style={{ maxWidth: '60%' }}>
                      {s.staff.map((m) => m.displayName).join(' · ')}
                    </Tx>
                  }
                >
                  <Tx size={12} color={C.muted} lh={16}>
                    Équipe
                  </Tx>
                </Row>
              )}
            </ListCard>
          </View>
        )}
        {tab === 'avis' && (
          <View style={{ gap: 10 }}>
            {s.ratingCount > 0 ? (
              <Card row gap={13} style={{ alignItems: 'center' }}>
                <Tx size={32} weight={700} ls={-1} lh={36}>
                  {formatRating(s.ratingAvg)}
                </Tx>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14.5} weight={600} lh={19}>
                    {'★'.repeat(Math.round(s.ratingAvg))}
                    <Tx size={14.5} weight={600} lh={19} color={C.disabled}>
                      {'★'.repeat(5 - Math.round(s.ratingAvg))}
                    </Tx>
                  </Tx>
                  <Tx size={12} color={C.muted} lh={16}>
                    {s.ratingCount} avis vérifié{s.ratingCount > 1 ? 's' : ''} · après rendez-vous
                  </Tx>
                </View>
              </Card>
            ) : (
              <View style={{ paddingVertical: 10 }}>
                <P center>Pas encore d'avis : soyez le premier après votre rendez-vous.</P>
              </View>
            )}
            {s.ratingCount > 0 && (
              <PillRow>
                <Pill lg on={sort === 'best'} onPress={() => setSort('best')}>
                  Mieux notés
                </Pill>
                <Pill lg on={sort === 'recent'} onPress={() => setSort('recent')}>
                  Plus récents
                </Pill>
              </PillRow>
            )}
            {reviews.isPending && s.ratingCount > 0 && <Skeleton h={78} radius={16} />}
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
          </View>
        )}
      </View>
    </Screen>
  );
}
