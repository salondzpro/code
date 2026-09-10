/**
 * Carte salon de la marketplace, à la Planity : grande photo de couverture (carrousel si plusieurs, cœur favori),
 * nom, « quartier (distance) », « ★ 4,9 (383 avis) », catégories, puis « Prochaines disponibilités » MATIN /
 * APRÈS-MIDI (chaque heure ouvre la réservation avec la date et l'heure déjà choisies) et « Plus d'informations ».
 * Même présentation pour tous les professionnels.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MapPin, Star } from 'lucide-react-native';
import { useFavorites, useToggleFavorite } from '@salondz/api-client';
import type { SalonSummary } from '@salondz/types';
import { addDaysToKey, categoryLabel, dayChipLabelDZ, toLocalDateKey } from '@salondz/constants';
import { formatKm, formatRating } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { C, R } from '@/theme/design';
import { I, Img, S, Tx } from './index';

/** Catégories affichées sur une carte avant « … ». */
const MAX_CARD_CATEGORIES = 3;

export function RatingPill({
  avg,
  count,
  style,
}: {
  avg: number;
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          alignSelf: 'flex-start',
          backgroundColor: C.fill,
          borderRadius: R.pill,
          paddingHorizontal: 10,
          paddingVertical: 5,
        },
        style,
      ]}
    >
      <Tx size={12} weight={600} lh={15.5}>
        ★ {formatRating(avg)}
      </Tx>
      {count != null && (
        <Tx size={12} color={C.muted} lh={15.5}>
          ({count})
        </Tx>
      )}
    </View>
  );
}

/** Ligne d'avis des cartes (Planity : « ☆ 4,9 (383 avis) ») ; sans avis : « Nouveau sur Salon DZ ». */
export function RatingLine({ avg, count }: { avg: number; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <I icon={Star} size={14} />
      {count > 0 ? (
        <>
          <Tx size={13} weight={700} lh={17}>
            {formatRating(avg)}
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            ({count} avis)
          </Tx>
        </>
      ) : (
        <Tx size={12} weight={500} color={C.muted} lh={16}>
          Nouveau sur Salon DZ
        </Tx>
      )}
    </View>
  );
}

export function SlotPills({
  slots,
  empty = "Complet aujourd'hui",
}: {
  slots: string[];
  empty?: string;
}) {
  if (slots.length === 0) return <S>{empty}</S>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {slots.map((t) => (
        <View
          key={t}
          style={{
            backgroundColor: C.fill,
            borderRadius: R.pill,
            paddingHorizontal: 13,
            paddingVertical: 8,
          }}
        >
          <Tx size={10.5} weight={500} lh={14} mono>
            {t}
          </Tx>
        </View>
      ))}
    </View>
  );
}

/** Libellé du jour des prochaines disponibilités : « Aujourd'hui », « Demain », sinon « Jeu. 10 ». */
export function nextDayLabel(date: string, today: string = toLocalDateKey()): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDaysToKey(today, 1)) return 'Demain';
  return dayChipLabelDZ(date);
}

/**
 * « Prochaines disponibilités » directement sur la carte (Planity, en plus compact) : pour le premier jour
 * disponible, une ligne MATIN et une ligne APRÈS-MIDI avec au plus 3 heures réellement libres chacune ; une
 * période vide n'est pas affichée. Chaque heure ouvre la réservation avec la date et l'heure déjà choisies.
 */
export function NextSlots({
  salon,
  empty = 'Aucune disponibilité cette semaine',
  more,
}: {
  salon: Pick<SalonSummary, 'slug' | 'nextAvailable'>;
  empty?: string;
  /** Élément affiché à droite de l'en-tête (ex. « Plus d'infos »). */
  more?: ReactNode;
}) {
  const router = useRouter();
  const next = salon.nextAvailable;
  const rows = next
    ? [
        {
          key: 'matin',
          label: 'MATIN',
          slots: next.morning ?? next.slots.filter((t) => t < '12:00').slice(0, 3),
        },
        {
          key: 'aprem',
          label: 'APRÈS-MIDI',
          slots: next.afternoon ?? next.slots.filter((t) => t >= '12:00').slice(0, 3),
        },
      ].filter((r) => r.slots.length > 0)
    : [];
  if (!next || rows.length === 0) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <S>{empty}</S>
        {more ?? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/s/${salon.slug}` as never)}
          >
            <Tx size={10.5} weight={600} color={C.muted} lh={14}>
              Voir le salon →
            </Tx>
          </Pressable>
        )}
      </View>
    );
  }
  const day = nextDayLabel(next.date);
  return (
    <View style={{ gap: 5 }} accessibilityLabel={`Prochaines disponibilités ${day}`}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Tx size={9.5} weight={700} ls={0.7} color={C.muted} lh={13}>
          PROCHAINES DISPONIBILITÉS{' '}
          <Tx size={9.5} weight={700} lh={13}>
            · {day}
          </Tx>
        </Tx>
        {more}
      </View>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Tx size={9.5} weight={700} ls={0.5} lh={13} style={{ width: 68 }}>
            {r.label}
          </Tx>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {r.slots.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityLabel={`Réserver ${day} ${r.label.toLowerCase()} à ${t}`}
                onPress={() =>
                  router.push({
                    pathname: `/s/${salon.slug}/prestations`,
                    params: { date: next.date, time: t },
                  } as never)
                }
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: C.ink,
                  borderRadius: R.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: pressed ? C.fill : C.surface,
                })}
              >
                <Tx size={12} weight={700} lh={15} mono>
                  {t}
                </Tx>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function SalonListCard({ salon, to }: { salon: SalonSummary; to?: string }) {
  const router = useRouter();
  const s = salon;
  const { session } = useAuth();
  const favs = useFavorites(!!session);
  const toggle = useToggleFavorite();
  const isFav = !!favs.data?.items.some((x) => x.id === s.id);
  const photos = s.photoUrls?.length ? s.photoUrls : s.coverUrl ? [s.coverUrl] : [];
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);
  const km = formatKm(s.distanceKm);
  const place = s.zone && s.zone !== s.city ? `${s.zone}, ${s.city}` : s.city;
  // Catégories seulement (pas de prix ni de prestations sur la carte) : 3 au plus, « … » s'il y en a d'autres.
  const cats =
    s.categoryIds
      .slice(0, MAX_CARD_CATEGORIES)
      .map((c) => categoryLabel(c))
      .join(' · ') + (s.categoryIds.length > MAX_CARD_CATEGORIES ? ' · …' : '');
  const href = to ?? `/s/${s.slug}`;
  const go = () => router.push(href as never);
  const base: ViewStyle = {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.card,
    overflow: 'hidden',
  };
  // Couverture à hauteur réduite (2:1) pour des cartes courtes.
  const height = width ? Math.round(width / 2) : 160;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={s.name}
      onPress={go}
      style={({ pressed }) => [base, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height, backgroundColor: C.line }}
      >
        {width > 0 && photos.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setIdx(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
            }
          >
            {photos.map((u) => (
              <Img key={u} src={u} radius={0} style={{ width, height }} />
            ))}
          </ScrollView>
        )}
        {photos.length > 1 && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 8,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            {photos.map((u, i) => (
              <View
                key={u}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          accessibilityState={{ selected: isFav }}
          disabled={toggle.isPending}
          onPress={() =>
            session
              ? toggle.mutate({ salonId: s.id, on: !isFav })
              : router.push({ pathname: '/connexion', params: { next: href } } as never)
          }
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Heart size={16} strokeWidth={1.6} color={C.text} fill={isFav ? C.text : 'none'} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 13, paddingTop: 10, paddingBottom: 12, gap: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Tx size={15.5} weight={700} ls={-0.5} lh={19} numberOfLines={1} style={{ flex: 1 }}>
            {s.name}
          </Tx>
          <RatingLine avg={s.ratingAvg} count={s.ratingCount} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
            <I icon={MapPin} size={13} color={C.muted} />
            <Tx size={11.5} color={C.muted} lh={15} numberOfLines={1}>
              {`${place}${km ? ` (${km})` : ''}`}
            </Tx>
          </View>
          {!!cats && (
            <Tx size={11.5} color={C.muted} lh={15} numberOfLines={1} style={{ flexShrink: 1 }}>
              {cats}
            </Tx>
          )}
        </View>
        <View style={{ marginTop: 4 }}>
          <NextSlots
            salon={s}
            more={
              <Pressable accessibilityRole="button" onPress={go}>
                <Tx size={10.5} weight={600} lh={14} style={{ textDecorationLine: 'underline' }}>
                  Plus d'infos
                </Tx>
              </Pressable>
            }
          />
        </View>
      </View>
    </Pressable>
  );
}
