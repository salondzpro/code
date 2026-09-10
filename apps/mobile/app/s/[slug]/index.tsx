/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Heart,
  Share2,
  Clock,
  Info,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Users,
  Ban,
} from 'lucide-react-native';
import {
  pagesItems,
  useFavorites,
  useSalon,
  useSalonReviewsInfinite,
  useToggleFavorite,
  type ReviewSort,
  useBookingStanding,
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
  ARRIVAL_ADVANCE_MINUTES,
  LATE_TOLERANCE_MINUTES,
  dayOfWeekFromKey,
  toLocalDateKey,
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
  Avatar,
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
  const standing = useBookingStanding(salon.data?.id ?? '', !!session);
  const cannotBook = !!standing.data && !standing.data.canBook;
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
  const todayDow = dayOfWeekFromKey(toLocalDateKey());
  const todayRows = s.openingHours.filter((h) => h.dayOfWeek === todayDow && !h.isClosed);
  const weekFromToday = WEEK_DAYS.map((_, k) => ((todayDow + k) % 7) as (typeof WEEK_DAYS)[number]);
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
          {cannotBook && !!standing.data?.message && (
            <View
              accessibilityRole="alert"
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: C.dangerLine,
                backgroundColor: C.cancelBg,
                paddingHorizontal: 13,
                paddingVertical: 10,
              }}
            >
              <I icon={Ban} size={17} color={C.danger} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Tx size={13} weight={700} lh={17} color={C.cancelFg}>
                  Réservation en ligne impossible
                </Tx>
                <Tx size={12} lh={16} color={C.cancelFg}>
                  {standing.data.message}
                </Tx>
                {!!s.phone && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void open(`tel:${s.phone}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}
                  >
                    <I icon={Phone} size={12} color={C.cancelFg} />
                    <Tx
                      size={12}
                      weight={600}
                      lh={16}
                      color={C.cancelFg}
                      style={{ textDecorationLine: 'underline' }}
                    >
                      Appeler le salon
                    </Tx>
                  </Pressable>
                )}
              </View>
            </View>
          )}
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
                disabled={cannotBook}
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
                disabled={cannotBook}
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
          <View style={{ gap: 12 }}>
            {/* Aujourd'hui en premier et en grand, puis la semaine à partir d'aujourd'hui. */}
            <Card
              gap={6}
              style={status.open ? { backgroundColor: C.okBg, borderColor: C.okFg } : undefined}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <I icon={Clock} size={13} color={C.muted} />
                <Tx size={10.5} weight={700} upper ls={0.8} lh={14} color={C.muted}>
                  Aujourd'hui · {DAY_LABELS_FR[todayDow]}
                </Tx>
              </View>
              <Tx size={23} weight={700} ls={-0.8} lh={27} mono>
                {todayRows.length
                  ? todayRows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(' · ')
                  : 'Fermé aujourd’hui'}
              </Tx>
              <Tx size={13} weight={600} lh={17} color={status.open ? C.okFg : C.muted}>
                {status.label}
              </Tx>
            </Card>
            <ListCard>
              {weekFromToday.map((d, idx) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <Row
                    key={d}
                    py={11}
                    chevron={false}
                    right={
                      <Tx size={13} lh={17} mono color={rows.length ? C.text : C.danger}>
                        {rows.length
                          ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ')
                          : 'Fermé'}
                      </Tx>
                    }
                  >
                    <Tx size={13} weight={idx === 0 ? 700 : 400} lh={17}>
                      {idx === 0 ? "Aujourd'hui" : idx === 1 ? 'Demain' : DAY_LABELS_FR[d]}
                      {idx <= 1 ? (
                        <Tx size={12} color={C.muted} lh={17}>
                          {'  '}
                          {DAY_LABELS_FR[d]}
                        </Tx>
                      ) : null}
                    </Tx>
                  </Row>
                );
              })}
            </ListCard>

            <Card gap={10}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: C.fill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <I icon={MapPin} size={16} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={700} lh={18}>
                    {s.address || place}
                  </Tx>
                  {!!s.address && (
                    <Tx size={12} color={C.muted} lh={16}>
                      {place}
                    </Tx>
                  )}
                </View>
              </View>
              <Button
                variant="g"
                sm
                onPress={() =>
                  void open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address, place].filter(Boolean).join(', '))}`,
                  )
                }
              >
                <I icon={Navigation} size={14.5} />
                <Tx size={13} weight={600} lh={17}>
                  Itinéraire
                </Tx>
              </Button>
            </Card>

            {!!s.phone && (
              <Card gap={10}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: C.fill,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <I icon={Phone} size={16} />
                  </View>
                  <Tx size={16} weight={700} lh={20} mono>
                    {formatDZPhone(s.phone)}
                  </Tx>
                </View>
                <Grid cols={2} gap={8}>
                  <Button variant="g" sm onPress={() => void open(`tel:${s.phone}`)}>
                    <I icon={Phone} size={14.5} />
                    <Tx size={13} weight={600} lh={17}>
                      Appeler
                    </Tx>
                  </Button>
                  <Button
                    variant="g"
                    sm
                    onPress={() => void open(`https://wa.me/${s.phone!.replace(/\D/g, '')}`)}
                  >
                    <I icon={MessageCircle} size={14.5} />
                    <Tx size={13} weight={600} lh={17}>
                      WhatsApp
                    </Tx>
                  </Button>
                </Grid>
              </Card>
            )}

            {s.staff.length > 0 && (
              <Card gap={10}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <I icon={Users} size={13} color={C.muted} />
                  <Tx size={10.5} weight={700} upper ls={0.8} lh={14} color={C.muted}>
                    Équipe · {s.staff.length}
                  </Tx>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {s.staff.map((m) => (
                    <View
                      key={m.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: C.line,
                        backgroundColor: C.surface,
                        paddingVertical: 3,
                        paddingLeft: 3,
                        paddingRight: 11,
                      }}
                    >
                      <Avatar src={m.avatarUrl} name={m.displayName} size={26} />
                      <Tx size={13} weight={600} lh={17}>
                        {m.displayName}
                      </Tx>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Card gap={6}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <I icon={Info} size={13} color={C.muted} />
                <Tx size={10.5} weight={700} upper ls={0.8} lh={14} color={C.muted}>
                  Bon à savoir
                </Tx>
              </View>
              <Tx size={13} lh={18}>
                • Réservation en ligne, paiement sur place.
              </Tx>
              <Tx size={13} lh={18}>
                • Annulation ou report en ligne jusqu'à {s.cancelMinHours} h avant le rendez-vous.
              </Tx>
              <Tx size={13} lh={18}>
                • Arrivez {ARRIVAL_ADVANCE_MINUTES} min avant l'heure : retard toléré{' '}
                {LATE_TOLERANCE_MINUTES} min.
              </Tx>
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}
