/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Share2 } from 'lucide-react-native';
import { useFavorites, useSalon, useSalonReviews, useToggleFavorite } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, categoryLabel, formatDA, formatDZPhone, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatRating } from '@/lib/format';
import { open, openingStatus, publicUrl, shareUrl } from '@/lib/salon';
import { BottomSheet, Button, Card, ErrorText, Grid, H1, I, IconButton, Img, ListCard, P, Row, SectionLabel, Segmented, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

type Tab = 'services' | 'works' | 'infos';

export default function Salon() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  const reviews = useSalonReviews(salon.data?.id ?? '');
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
      <View style={{ height: 300, backgroundColor: C.line }}>
        <Img src={s.coverUrl} radius={0} style={{ height: 300 }} />
        <View style={{ position: 'absolute', left: 20, right: 20, top: insets.top + 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton lg accessibilityLabel="Retour" onPress={back}>
            <I icon={ChevronLeft} />
          </IconButton>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton lg accessibilityLabel="Partager" onPress={() => void shareUrl(s.name, publicUrl(s.slug))}>
              <I icon={Share2} size={20} />
            </IconButton>
            <IconButton lg accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} accessibilityState={{ selected: isFav }} disabled={toggle.isPending} onPress={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : router.push({ pathname: '/connexion', params: { next: `/s/${s.slug}` } }))}>
              <Heart size={22} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
            </IconButton>
          </View>
        </View>
      </View>

      <View style={{ marginTop: -20, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 24, gap: 16 }}>
        <View>
          <H1 size={30} lh={34} ls={-0.8}>
            {s.name}
          </H1>
          <Tx size={17} color={C.muted} lh={23} style={{ marginTop: 4 }}>
            {cats} — {place}
          </Tx>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {s.ratingCount > 0 && (
            <View style={{ backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 13, paddingVertical: 9 }}>
              <Tx size={15} weight={600} lh={19}>
                ★ {formatRating(s.ratingAvg)} · {s.ratingCount} avis
              </Tx>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.pill, backgroundColor: status.open ? C.okBg : C.fill, paddingHorizontal: 12, paddingVertical: 7 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.open ? C.okFg : C.muted }} />
            <Tx size={15} weight={600} lh={19} color={status.open ? C.okFg : C.muted}>
              {status.label}
            </Tx>
          </View>
        </View>
        {!!s.description && (
          <Tx size={17} color={C.muted} lh={25}>
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
          ]}
        />

        {tab === 'services' && (
          <ListCard>
            {s.services.map((sv) => (
              <Row key={sv.id} to={`/s/${s.slug}/prestation/${sv.id}`} py={20} chevron={false} right={<Tx size={20} weight={600} lh={25}>{formatDA(sv.priceDa)}</Tx>}>
                <Tx size={20} weight={600} lh={25}>
                  {sv.name}
                </Tx>
                <Tx size={15} color={C.muted} lh={20}>
                  {formatDuration(sv.durationMinutes)}
                </Tx>
              </Row>
            ))}
            {s.services.length === 0 && (
              <View style={{ paddingVertical: 12 }}>
                <P>Aucune prestation pour le moment.</P>
              </View>
            )}
          </ListCard>
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
          <View style={{ gap: 16 }}>
            <ListCard>
              {WEEK_DAYS.map((d) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <Row key={d} py={12} chevron={false} right={<Tx size={16} lh={21} mono color={rows.length ? C.muted : C.danger}>{rows.length ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ') : 'Fermé'}</Tx>}>
                    <Tx size={16} lh={21}>
                      {DAY_LABELS_FR[d]}
                    </Tx>
                  </Row>
                );
              })}
            </ListCard>
            <ListCard>
              <Row py={12} chevron={false} right={<Tx size={15} lh={20} right style={{ maxWidth: '60%' }}>{[s.address, place].filter(Boolean).join(', ')}</Tx>}>
                <Tx size={15} color={C.muted} lh={20}>
                  Adresse
                </Tx>
              </Row>
              {!!s.phone && (
                <Row py={12} chevron={false} onPress={() => void open(`tel:${s.phone}`)} right={<Tx size={15} lh={20}>{formatDZPhone(s.phone)}</Tx>}>
                  <Tx size={15} color={C.muted} lh={20}>
                    Téléphone
                  </Tx>
                </Row>
              )}
              {s.staff.length > 0 && (
                <Row py={12} chevron={false} right={<Tx size={15} lh={20} right style={{ maxWidth: '60%' }}>{s.staff.map((m) => m.displayName).join(' · ')}</Tx>}>
                  <Tx size={15} color={C.muted} lh={20}>
                    Équipe
                  </Tx>
                </Row>
              )}
            </ListCard>
            {reviews.data && reviews.data.items.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionLabel>Avis</SectionLabel>
                {reviews.data.items.slice(0, 5).map((r) => (
                  <Card key={r.id} sm gap={4}>
                    <Tx size={15} weight={600} lh={20}>
                      {'★'.repeat(r.rating)}
                      <Tx size={15} weight={600} lh={20} color={C.disabled}>
                        {'★'.repeat(5 - r.rating)}
                      </Tx>{' '}
                      · {r.authorName}
                    </Tx>
                    {!!r.comment && <P>{r.comment}</P>}
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}
