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
import { DAY_LABELS_FR, WEEK_DAYS, categoryLabel, formatDA, formatDZPhone, wilayaName, groupServices } from '@salondz/constants';
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
      <View style={{ height: 244, backgroundColor: C.line }}>
        <Img src={s.coverUrl} radius={0} style={{ height: 244 }} />
        <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton lg accessibilityLabel="Retour" onPress={back}>
            <I icon={ChevronLeft} />
          </IconButton>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton lg accessibilityLabel="Partager" onPress={() => void shareUrl(s.name, publicUrl(s.slug))}>
              <I icon={Share2} size={16} />
            </IconButton>
            <IconButton lg accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} accessibilityState={{ selected: isFav }} disabled={toggle.isPending} onPress={() => (session ? toggle.mutate({ salonId: s.id, on: !isFav }) : router.push({ pathname: '/connexion', params: { next: `/s/${s.slug}` } }))}>
              <Heart size={18} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
            </IconButton>
          </View>
        </View>
      </View>

      <View style={{ marginTop: -16, backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 20, gap: 13 }}>
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
            <View style={{ backgroundColor: C.fill, borderRadius: R.pill, paddingHorizontal: 11, paddingVertical: 7 }}>
              <Tx size={12} weight={600} lh={15.5}>
                ★ {formatRating(s.ratingAvg)} · {s.ratingCount} avis
              </Tx>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, backgroundColor: status.open ? C.okBg : C.fill, paddingHorizontal: 10, paddingVertical: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2, backgroundColor: status.open ? C.okFg : C.muted }} />
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
          ]}
        />

        {tab === 'services' && (
          <View style={{ gap: 10 }}>
            {groupServices(s.services).map((g) => (
              <View key={g.name} style={{ gap: 6 }}>
                <SectionLabel>{g.name}</SectionLabel>
                <ListCard>
                  {g.services.map((sv) => (
                    <Row key={sv.id} to={`/s/${s.slug}/prestation/${sv.id}`} py={16} chevron={false} right={<Tx size={13} weight={600} lh={17}>{formatDA(sv.priceDa)}</Tx>}>
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
                  <Row key={d} py={10} chevron={false} right={<Tx size={10.5} lh={14.5} mono color={rows.length ? C.muted : C.danger}>{rows.length ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ') : 'Fermé'}</Tx>}>
                    <Tx size={10.5} lh={14.5}>
                      {DAY_LABELS_FR[d]}
                    </Tx>
                  </Row>
                );
              })}
            </ListCard>
            <ListCard>
              <Row py={10} chevron={false} right={<Tx size={12} lh={16} right style={{ maxWidth: '60%' }}>{[s.address, place].filter(Boolean).join(', ')}</Tx>}>
                <Tx size={12} color={C.muted} lh={16}>
                  Adresse
                </Tx>
              </Row>
              {!!s.phone && (
                <Row py={10} chevron={false} onPress={() => void open(`tel:${s.phone}`)} right={<Tx size={12} lh={16}>{formatDZPhone(s.phone)}</Tx>}>
                  <Tx size={12} color={C.muted} lh={16}>
                    Téléphone
                  </Tx>
                </Row>
              )}
              {s.staff.length > 0 && (
                <Row py={10} chevron={false} right={<Tx size={12} lh={16} right style={{ maxWidth: '60%' }}>{s.staff.map((m) => m.displayName).join(' · ')}</Tx>}>
                  <Tx size={12} color={C.muted} lh={16}>
                    Équipe
                  </Tx>
                </Row>
              )}
            </ListCard>
            {reviews.data && reviews.data.items.length > 0 && (
              <View style={{ gap: 8 }}>
                <SectionLabel>Avis</SectionLabel>
                {reviews.data.items.slice(0, 5).map((r) => (
                  <Card key={r.id} sm gap={3}>
                    <Tx size={12} weight={600} lh={16}>
                      {'★'.repeat(r.rating)}
                      <Tx size={12} weight={600} lh={16} color={C.disabled}>
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
