/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import React, { useEffect, useState } from 'react';
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
import type { Service } from '@salondz/types';
import { useAuth } from '@/lib/auth';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
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
  Checkbox,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
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
  const [tab, setTab] = useState<Tab>('services');
  // Sélection directe des prestations sur la page (brouillon partagé avec « Quand ? » et le récapitulatif).
  const [selected, setSelected] = useState<string[]>(() => readDraft(slug).serviceIds);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    writeDraft(slug, { serviceIds: selected });
  }, [slug, selected]);
  const toggleService = (id: string) => {
    setHint(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
  const works = s.works;
  const chosen = selected
    .map((id) => s.services.find((x) => x.id === id))
    .filter((x): x is Service => !!x);
  const total = chosen.reduce((a, x) => a + x.priceDa, 0);
  const minutes = chosen.reduce((a, x) => a + x.durationMinutes, 0);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)'));

  return (
    <Screen
      px={0}
      top={0}
      gap={0}
      edges={[]}
      footer={
        <BottomSheet grab={false}>
          {chosen.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={19.5} weight={700} ls={-0.6} lh={23.5}>
                  {formatDA(total)}
                </Tx>
                <P numberOfLines={1}>
                  {chosen.length} prestation{chosen.length > 1 ? 's' : ''} ·{' '}
                  {formatDuration(minutes)} au total
                </P>
              </View>
              <Button
                pill
                onPress={() => router.push(`/s/${s.slug}/reserver/quand` as never)}
                style={{ paddingHorizontal: 20, paddingVertical: 13 }}
              >
                Choisir un créneau
              </Button>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {hint && (
                <Tx size={12} color={C.danger} lh={16} center accessibilityRole="alert">
                  Cochez une ou plusieurs prestations ci-dessus.
                </Tx>
              )}
              <Button
                onPress={() => {
                  setTab('services');
                  setHint(true);
                }}
              >
                Réserver
              </Button>
            </View>
          )}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              s.ratingCount > 0
                ? `${s.ratingCount} avis, note ${formatRating(s.ratingAvg)} sur 5 : voir les avis`
                : 'Avis : voir les avis'
            }
            onPress={() => router.push(`/s/${s.slug}/avis` as never)}
            style={{
              backgroundColor: C.fill,
              borderRadius: R.pill,
              paddingHorizontal: 11,
              paddingVertical: 7,
            }}
          >
            <Tx size={12} weight={600} lh={15.5} color={s.ratingCount > 0 ? C.text : C.muted}>
              {s.ratingCount > 0
                ? `★ ${formatRating(s.ratingAvg)} · ${s.ratingCount} avis`
                : '★ Avis'}
            </Tx>
          </Pressable>
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
          ]}
        />

        {tab === 'services' && (
          <View style={{ gap: 10 }}>
            {groupServices(s.services).map((g) => (
              <View key={g.name} style={{ gap: 6 }}>
                <SectionLabel>{g.name}</SectionLabel>
                <ListCard>
                  {g.services.map((sv) => {
                    const on = selected.includes(sv.id);
                    return (
                      <Row
                        key={sv.id}
                        onPress={() => toggleService(sv.id)}
                        accessibilityLabel={sv.name}
                        py={13}
                        chevron={false}
                        right={<Checkbox on={on} label={sv.name} />}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                          {!!sv.photos?.[0]?.url && (
                            <Img
                              src={sv.photos[0].url}
                              radius={11}
                              style={{ width: 52, height: 52 }}
                            />
                          )}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Tx size={13.5} weight={700} ls={-0.3} lh={17.5}>
                              {sv.name}
                            </Tx>
                            <Tx size={12} color={C.muted} lh={16}>
                              {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                            </Tx>
                          </View>
                        </View>
                      </Row>
                    );
                  })}
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
      </View>
    </Screen>
  );
}
