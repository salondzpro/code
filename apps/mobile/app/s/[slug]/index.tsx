/**
 * C-F 04 — Page du salon : couverture (retour, favori), nom, catégories — quartier, note, ouverture,
 * description, onglets Prestations / Réalisations / Infos, feuille « Réserver ».
 */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
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
  Star,
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
  SHOW_SALON_CONTACT_TO_CLIENTS,
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
import { Accordion, Tabs } from '@/ui/Sections';
import { SalonGallery } from '@/ui/SalonGallery';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

type Tab = 'book' | 'reviews' | 'about';

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
  const [tab, setTab] = useState<Tab>('book');
  // Catégories repliées par défaut : le client voit d'abord le salon, puis ouvre la sienne.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 5, 'best');
  const reviewItems = pagesItems(reviews.data);
  // Hauteur réelle de la feuille du bas (bandeau, résumé, bouton) → espace inférieur du contenu.
  /**
   * UNE prestation par rendez-vous. Deux prestations, c'est deux rendez-vous : le salon
   * garde ainsi la main sur la durée réelle de chaque créneau.
   */
  const chooseService = (id: string) => {
    writeDraft(slug, { serviceIds: [id] });
    router.push(`/s/${slug}/reserver/quand` as never);
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
  const groups = groupServices(s.services);
  const prices = s.services.map((x) => x.priceDa).filter((x) => x > 0);
  const priceRange = prices.length
    ? `${formatDA(Math.min(...prices))} – ${formatDA(Math.max(...prices))}`
    : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address, place].filter(Boolean).join(', '))}`;
  const works = s.works;
  /** Couverture, puis photos du salon, puis réalisations — sans doublon ni trou. */
  const gallery = [
    s.coverUrl,
    ...(s.photos ?? []).map((x) => x.url),
    ...works.map((x) => x.url),
  ].filter((x, idx, arr): x is string => !!x && arr.indexOf(x) === idx);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)'));

  return (
    <Screen
      px={0}
      bottom={24}
      top={0}
      gap={0}
      edges={[]}
    >
      {/* Onglets avant la couverture, comme sur le web : ils commandent la page. */}
      <Tabs
        label="Sections du salon"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'book', label: 'Prendre RDV' },
          { value: 'reviews', label: 'Avis' },
          { value: 'about', label: 'À propos' },
        ]}
      />
      {/* Couverture */}
      {/* Album : couverture, photos du salon et réalisations réunies. */}
      <SalonGallery images={gallery}>
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
      </SalonGallery>

      {/* Contenu à plat sous la photo : le chevauchement arrondi rognait l'image. */}
      <View
        style={{
          backgroundColor: C.bg,
          paddingHorizontal: 16,
          paddingTop: 14,
          gap: 13,
        }}
      >
        {/* Identité réservée à l'onglet de réservation : sur « Avis » et « À propos »
            elle répétait nom, adresse, note, prix et horaires pour rien. */}
        {tab === 'book' && (
          <>
          <View style={{ gap: 5 }}>
            <H1 size={21} lh={24.5} ls={-0.8}>
              {s.name}
            </H1>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Itinéraire vers le salon"
              onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <I icon={MapPin} size={14} color={C.muted} />
              <Tx size={12} lh={16} numberOfLines={1} style={{ flex: 1, textDecorationLine: 'underline' }}>
                {s.address ? `${s.address}, ${place}` : place}
              </Tx>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  s.ratingCount > 0
                    ? `${s.ratingCount} avis, note ${formatRating(s.ratingAvg)} sur 5 : voir les avis`
                    : 'Avis : voir les avis'
                }
                onPress={() => setTab('reviews')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <I icon={Star} size={14} />
                <Tx size={12} weight={600} lh={16} color={s.ratingCount > 0 ? C.text : C.muted}>
                  {s.ratingCount > 0
                    ? `${formatRating(s.ratingAvg)} (${s.ratingCount} avis)`
                    : "Pas encore d'avis"}
                </Tx>
              </Pressable>
              {!!priceRange && (
                <Tx size={12} color={C.muted} lh={16}>
                  {`· ${priceRange}`}
                </Tx>
              )}
              <Tx size={12} weight={600} lh={16} color={status.open ? C.okFg : C.muted}>
                {`· ${status.label}`}
              </Tx>
            </View>
          </View>

          {/* Deux gestes utiles tout de suite : joindre le salon, ou y aller. */}
          <Grid cols={2}>
            {SHOW_SALON_CONTACT_TO_CLIENTS && s.phone ? (
              <Button variant="g" sm onPress={() => void Linking.openURL(`tel:${s.phone}`).catch(() => undefined)}>
                <Tx size={14} weight={600} ls={-0.2}>
                  Appeler
                </Tx>
              </Button>
            ) : (
              <Button variant="g" sm onPress={() => void shareUrl(s.name, publicUrl(s.slug))}>
                <Tx size={14} weight={600} ls={-0.2}>
                  Partager
                </Tx>
              </Button>
            )}
            <Button variant="g" sm onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)}>
              <Tx size={14} weight={600} ls={-0.2}>
                Itinéraire
              </Tx>
            </Button>
          </Grid>
          </>
        )}

        {tab === 'book' && (
          <View style={{ gap: 9 }}>
            {cannotBook && !!standing.data?.message && (
              <View
                accessibilityRole="alert"
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: C.dangerLine,
                  backgroundColor: C.cancelBg,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                }}
              >
                <I icon={Ban} size={18} color={C.danger} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Tx size={14} weight={700} lh={17} color={C.cancelFg}>
                    Réservation en ligne impossible
                  </Tx>
                  <Tx size={12} lh={16} color={C.cancelFg}>
                    {standing.data.message}
                  </Tx>
                  {SHOW_SALON_CONTACT_TO_CLIENTS && !!s.phone && (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => void open(`tel:${s.phone}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}
                    >
                      <I icon={Phone} size={14} color={C.cancelFg} />
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
            <Tx size={16} weight={700} ls={-0.5} lh={19}>
              Choix de la prestation
            </Tx>
            <P>
              Une prestation par rendez-vous. Pour en cumuler plusieurs, prenez un rendez-vous par
              prestation.
            </P>
            {groups.map((g) => (
              <Accordion
                key={g.name}
                title={g.name}
                hint={`${g.services.length} prestation${g.services.length > 1 ? 's' : ''}`}
                open={openGroup === g.name}
                onToggle={() => setOpenGroup((cur) => (cur === g.name ? null : g.name))}
              >
                <View>
                  {g.services.map((sv, i) => (
                    <View
                      key={sv.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                        paddingVertical: 11,
                        borderBottomWidth: i === g.services.length - 1 ? 0 : 1,
                        borderBottomColor: C.lineSoft,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Tx size={14} weight={700} ls={-0.3} lh={17.5}>
                          {sv.name}
                        </Tx>
                        {!!sv.description && (
                          <Tx size={12} color={C.muted} lh={15}>
                            {sv.description}
                          </Tx>
                        )}
                        <Tx size={14} weight={600} lh={16}>
                          {formatDA(sv.priceDa)}
                          <Tx size={14} color={C.muted} lh={16}>
                            {` · ${formatDuration(sv.durationMinutes)}`}
                          </Tx>
                        </Tx>
                      </View>
                      <Button
                        sm
                        auto
                        pill
                        disabled={cannotBook}
                        onPress={() => chooseService(sv.id)}
                      >
                        <Tx size={12} weight={600} color="#fff" ls={-0.2}>
                          Choisir
                        </Tx>
                      </Button>
                    </View>
                  ))}
                </View>
              </Accordion>
            ))}
            {s.services.length === 0 && (
              <View style={{ paddingVertical: 10 }}>
                <P>Aucune prestation pour le moment.</P>
              </View>
            )}
          </View>
        )}
        {tab === 'reviews' && (
          <View style={{ gap: 9 }}>
            <Tx size={16} weight={700} ls={-0.5} lh={19}>
              Avis
            </Tx>
            {s.ratingCount > 0 ? (
              <Card row gap={11} style={{ alignItems: 'center' }}>
                <Tx size={32} weight={600} ls={-1} lh={35}>
                  {formatRating(s.ratingAvg)}
                </Tx>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={600} lh={18}>
                    {'★'.repeat(Math.round(s.ratingAvg))}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={16}>
                    {`${s.ratingCount} avis vérifié${s.ratingCount > 1 ? 's' : ''} · après rendez-vous`}
                  </Tx>
                </View>
              </Card>
            ) : (
              <P>Pas encore d'avis : soyez le premier après votre rendez-vous.</P>
            )}
            {reviewItems.map((r) => (
              <Card key={r.id} gap={4}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Tx size={14} weight={600} lh={16}>
                    {'★'.repeat(r.rating)}
                  </Tx>
                  <Tx size={12} color={C.muted} lh={15}>
                    {formatDateShortDZ(r.createdAt)}
                  </Tx>
                </View>
                {!!r.comment && <P>{r.comment}</P>}
              </Card>
            ))}
            {reviewItems.length > 0 && (
              <Button variant="g" onPress={() => router.push(`/s/${s.slug}/avis` as never)}>
                Tous les avis
              </Button>
            )}
          </View>
        )}

        {tab === 'about' && (
          <View style={{ gap: 9 }}>
            {/* 1. Où. L'adresse n'est PAS répétée ici : le bloc d'identité, juste au-dessus,
                reste visible sur tous les onglets et la porte déjà, cliquable. */}
            <Tx size={16} weight={700} ls={-0.5} lh={20}>
              Où se situe le salon ?
            </Tx>
            <Button onPress={() => void Linking.openURL(mapsUrl).catch(() => undefined)}>
              <Tx size={14} weight={600} color="#fff" ls={-0.2}>
                Afficher la carte
              </Tx>
            </Button>

            {/* 2. Quand. Aujourd'hui en tête, puis la semaine. */}
            <Tx size={16} weight={700} ls={-0.5} lh={19} style={{ marginTop: 6 }}>
              Horaires d'ouverture
            </Tx>
            <ListCard>
              {weekFromToday.map((d, idx) => {
                const rows = s.openingHours.filter((h) => h.dayOfWeek === d && !h.isClosed);
                return (
                  <Row key={d} chevron={false} right={
                    <Tx size={14} weight={rows.length ? 600 : 400} lh={16} color={rows.length ? C.text : C.muted} mono>
                      {rows.length ? rows.map((h) => `${h.opensAt} – ${h.closesAt}`).join(', ') : 'Fermé'}
                    </Tx>
                  }>
                    <Tx size={14} weight={idx === 0 ? 700 : 400} lh={16}>
                      {idx === 0 ? "Aujourd'hui" : idx === 1 ? 'Demain' : DAY_LABELS_FR[d]}
                    </Tx>
                  </Row>
                );
              })}
            </ListCard>

            {/* 3. Qui. */}
            {s.staff.length > 0 && (
              <>
                <Tx size={16} weight={700} ls={-0.5} lh={19} style={{ marginTop: 6 }}>
                  {s.staff.length > 1 ? 'Collaborateurs' : 'Collaborateur'}
                </Tx>
                <ListCard>
                  {s.staff.map((m) => (
                    <Row key={m.id} chevron={false}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Avatar src={m.avatarUrl} name={m.displayName} size={40} />
                        <Tx size={14} weight={600} lh={17}>
                          {m.displayName}
                        </Tx>
                      </View>
                    </Row>
                  ))}
                </ListCard>
              </>
            )}

            {/* 4. Ce qu'il faut savoir, replié. */}
            {(!!s.description || !!cats) && (
              <>
                <Tx size={16} weight={700} ls={-0.5} lh={19} style={{ marginTop: 6 }}>
                  Informations
                </Tx>
                <Accordion
                  title="À propos du salon"
                  open={aboutOpen}
                  onToggle={() => setAboutOpen((v) => !v)}
                >
                  <View style={{ gap: 4, paddingVertical: 10 }}>
                    {!!s.description && <P>{s.description}</P>}
                    {!!cats && (
                      <Tx size={12} color={C.muted} lh={16}>
                        {cats}
                      </Tx>
                    )}
                  </View>
                </Accordion>
              </>
            )}

            {/* 5. Réalisations : déjà dans l'album en haut de page, donc pas de seconde
                grille ici — seulement l'accès à la planche complète. */}
            {works.length > 0 && (
              <Button
                variant="g"
                onPress={() => router.push(`/s/${s.slug}/realisations` as never)}
              >
                {`Voir les ${works.length} réalisation${works.length > 1 ? 's' : ''}`}
              </Button>
            )}

            <Card gap={5}>
              <Tx size={12} weight={700} lh={16}>
                Bon à savoir
              </Tx>
              <Tx size={12} lh={16}>
                • Réservation en ligne, paiement sur place.
              </Tx>
              <Tx size={12} lh={16}>
                • Annulation ou report en ligne jusqu'à {s.cancelMinHours} h avant le rendez-vous.
              </Tx>
              <Tx size={12} lh={16}>
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
