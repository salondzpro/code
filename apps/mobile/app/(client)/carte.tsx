/**
 * C-H 04 — Résultats sur la carte : bulles de prix (prix de départ), cercle du rayon,
 * feuille basse avec la carte du salon sélectionné. Carte schématique (projection locale) :
 * le fond de tuiles natif viendra avec react-native-maps dans un build de développement.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocateFixed, Search, SlidersHorizontal } from 'lucide-react-native';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, formatDA, type CategoryId } from '@salondz/constants';
import type { SalonSummary } from '@salondz/types';
import { useLocationPrefs } from '@/lib/prefs';
import { formatKm } from '@/lib/format';
import { I, IconButton, Img, P, Pill, Tx } from '@/ui';
import { PillRow } from '@/ui/Pills';
import { RatingPill, SlotPills } from '@/ui/SalonListCard';
import { GridBg } from '@/ui/GridBg';
import { C, R, SHADOW } from '@/theme/design';

const ALGIERS = { lat: 36.7538, lng: 3.0588 };
type Pin = SalonSummary & { lat?: number | null; lng?: number | null };

export default function MapView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ category?: string }>();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const [category, setCategory] = useState(params.category ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

  const query = useSalonSearch({ gender: market, category: category ? (category as CategoryId) : undefined, city: prefs.city ?? undefined, wilaya: prefs.city ? undefined : prefs.wilaya, lat: prefs.lat ?? undefined, lng: prefs.lng ?? undefined, radiusKm: prefs.lat != null ? prefs.radiusKm : undefined, limit: 50 });
  const items = useMemo(() => ((query.data?.items ?? []) as Pin[]).filter((s) => s.lat != null && s.lng != null), [query.data]);
  const current = items.find((s) => s.id === selected) ?? items[0] ?? null;

  // Projection locale : centre = position (ou barycentre des résultats), échelle = rayon.
  const origin = center ?? (prefs.lat != null ? { lat: prefs.lat, lng: prefs.lng! } : items.length ? { lat: items.reduce((a, s) => a + s.lat!, 0) / items.length, lng: items.reduce((a, s) => a + s.lng!, 0) / items.length } : ALGIERS);
  const spanKm = Math.max(prefs.lat != null ? prefs.radiusKm * 1.3 : 3, ...items.map((s) => Math.hypot((s.lat! - origin.lat) * 111, (s.lng! - origin.lng) * 111 * Math.cos((origin.lat * Math.PI) / 180))) ) * 1.15;
  const pxPerKm = Math.min(width, height * 0.62) / 2 / spanKm;
  const mapH = height - 92 - insets.bottom;
  const toXY = (lat: number, lng: number) => ({ x: width / 2 + (lng - origin.lng) * 111 * Math.cos((origin.lat * Math.PI) / 180) * pxPerKm, y: mapH / 2 - (lat - origin.lat) * 111 * pxPerKm });
  const radiusPx = prefs.lat != null ? prefs.radiusKm * pxPerKm : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#EAECEE' }}>
      <View style={{ height: mapH, overflow: 'hidden' }} accessibilityLabel="Carte des salons">
        <GridBg step={110} stepY={80} />
        {prefs.lat != null && (
          <>
            <View style={{ position: 'absolute', left: width / 2 - radiusPx, top: mapH / 2 - radiusPx, width: radiusPx * 2, height: radiusPx * 2, borderRadius: radiusPx, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.disabled, backgroundColor: 'rgba(17,18,20,0.04)' }} />
            <View style={{ position: 'absolute', left: width / 2 - 9, top: mapH / 2 - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: C.ink, borderWidth: 4, borderColor: '#fff' }} />
          </>
        )}
        {items.map((s) => {
          const { x, y } = toXY(s.lat!, s.lng!);
          const on = s.id === current?.id;
          return (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.name} onPress={() => setSelected(s.id)} style={{ position: 'absolute', left: x, top: y, transform: [{ translateX: -60 }, { translateY: -48 }], width: 120, alignItems: 'center', zIndex: on ? 2 : 1 }}>
              <View style={[{ backgroundColor: on ? C.ink : C.surface, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 }, SHADOW.card]}>
                <Tx size={16} weight={600} lh={16} color={on ? '#fff' : C.text} numberOfLines={1}>
                  {s.minPriceDa != null ? formatDA(s.minPriceDa) : s.name}
                </Tx>
              </View>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? C.ink : '#fff', borderWidth: 2, borderColor: on ? C.ink : C.line, marginTop: 4 }} />
            </Pressable>
          );
        })}
      </View>

      {/* Barre de recherche + filtres */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 16, gap: 12, paddingHorizontal: 20 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/recherche')} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.cardSm, paddingVertical: 15, paddingHorizontal: 16 }, SHADOW.card]}>
            <I icon={Search} size={22} color={C.subtle} />
            <Tx size={16} lh={20} color={C.subtle} numberOfLines={1} style={{ flex: 1 }}>
              {MARKET_LABELS_FR[market]} · {prefs.label}
            </Tx>
          </Pressable>
          <IconButton lg accessibilityLabel="Filtres" onPress={() => router.push('/localisation')} style={SHADOW.card}>
            <I icon={SlidersHorizontal} size={20} />
          </IconButton>
        </View>
        <PillRow>
          <Pill lg on={!category} onPress={() => setCategory('')} style={SHADOW.card}>
            Sans préférence
          </Pill>
          {categoriesForMarket(market).map((c) => (
            <Pill key={c.id} lg on={category === c.id} onPress={() => setCategory(category === c.id ? '' : c.id)} style={SHADOW.card}>
              {c.labelFr}
            </Pill>
          ))}
        </PillRow>
      </View>

      <IconButton lg accessibilityLabel="Recentrer" onPress={() => setCenter(null)} style={[{ position: 'absolute', right: 20, bottom: 300 + insets.bottom }, SHADOW.card]}>
        <I icon={LocateFixed} size={20} />
      </IconButton>

      {/* Feuille : salon sélectionné */}
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 16 + insets.bottom, gap: 14 }, SHADOW.sheet]}>
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 4 }} />
        {current ? (
          <Pressable accessibilityRole="link" accessibilityLabel={current.name} onPress={() => router.push(`/s/${current.slug}` as never)} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.ink, borderRadius: R.card, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              <Img src={current.logoUrl ?? current.coverUrl} radius={16} style={{ width: 96, height: 96 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <Tx size={21} weight={700} ls={-0.4} lh={25} style={{ flex: 1 }}>
                    {current.name}
                  </Tx>
                  {current.ratingCount > 0 && <RatingPill avg={current.ratingAvg} />}
                </View>
                <Tx size={16} color={C.muted} lh={22} style={{ marginTop: 4 }}>
                  {[current.zone ?? current.city, formatKm(current.distanceKm), current.isOpenNow ? 'ouvert' : null].filter(Boolean).join(' · ')}
                </Tx>
                <Tx size={15} color={C.subtle} lh={21} style={{ marginTop: 2 }}>
                  {current.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ')}
                </Tx>
              </View>
            </View>
            <SlotPills slots={current.nextSlots} />
          </Pressable>
        ) : (
          <P center>{query.isPending ? 'Chargement…' : 'Aucun salon dans cette zone.'}</P>
        )}
        {items.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            {items.slice(0, 6).map((s) => (
              <Pressable key={s.id} accessibilityLabel={s.name} onPress={() => setSelected(s.id)} style={{ height: 6, width: s.id === current?.id ? 24 : 6, borderRadius: 3, backgroundColor: s.id === current?.id ? C.ink : C.line }} />
            ))}
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: 'center', paddingVertical: 4 }}>
          <Tx size={15} weight={500} color={C.muted}>
            Retour à la liste
          </Tx>
        </Pressable>
      </View>
    </View>
  );
}
