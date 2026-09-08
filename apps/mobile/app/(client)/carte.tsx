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
import { RatingPill, NextSlots } from '@/ui/SalonListCard';
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
            <View style={{ position: 'absolute', left: width / 2 - 9, top: mapH / 2 - 9, width: 15, height: 15, borderRadius: 7, backgroundColor: C.ink, borderWidth: 4, borderColor: '#fff' }} />
          </>
        )}
        {items.map((s) => {
          const { x, y } = toXY(s.lat!, s.lng!);
          const on = s.id === current?.id;
          return (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.name} onPress={() => setSelected(s.id)} style={{ position: 'absolute', left: x, top: y, transform: [{ translateX: -60 }, { translateY: -48 }], width: 98, alignItems: 'center', zIndex: on ? 2 : 1 }}>
              <View style={[{ backgroundColor: on ? C.ink : C.surface, borderRadius: R.pill, paddingHorizontal: 11, paddingVertical: 6 }, SHADOW.card]}>
                <Tx size={10.5} weight={600} lh={12} color={on ? '#fff' : C.text} numberOfLines={1}>
                  {s.minPriceDa != null ? formatDA(s.minPriceDa) : s.name}
                </Tx>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? C.ink : '#fff', borderWidth: 2, borderColor: on ? C.ink : C.line, marginTop: 3 }} />
            </Pressable>
          );
        })}
      </View>

      {/* Barre de recherche + filtres */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 16, gap: 10, paddingHorizontal: 16 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/recherche')} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: R.cardSm, paddingVertical: 12, paddingHorizontal: 13 }, SHADOW.card]}>
            <I icon={Search} size={18} color={C.subtle} />
            <Tx size={10.5} lh={14} color={C.subtle} numberOfLines={1} style={{ flex: 1 }}>
              {MARKET_LABELS_FR[market]} · {prefs.label}
            </Tx>
          </Pressable>
          <IconButton lg accessibilityLabel="Filtres" onPress={() => router.push('/localisation')} style={SHADOW.card}>
            <I icon={SlidersHorizontal} size={16} />
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

      <IconButton lg accessibilityLabel="Recentrer" onPress={() => setCenter(null)} style={[{ position: 'absolute', right: 16, bottom: 244 + insets.bottom }, SHADOW.card]}>
        <I icon={LocateFixed} size={16} />
      </IconButton>

      {/* Feuille : salon sélectionné */}
      <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingTop: 10, paddingHorizontal: 16, paddingBottom: 13 + insets.bottom, gap: 11 }, SHADOW.sheet]}>
        <View style={{ width: 31, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 3 }} />
        {current ? (
          <Pressable accessibilityRole="link" accessibilityLabel={current.name} onPress={() => router.push(`/s/${current.slug}` as never)} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.ink, borderRadius: R.card, padding: 13, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
              <Img src={current.logoUrl ?? current.coverUrl} radius={13} style={{ width: 78, height: 78 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <Tx size={14} weight={700} ls={-0.4} lh={17} style={{ flex: 1 }}>
                    {current.name}
                  </Tx>
                  {current.ratingCount > 0 && <RatingPill avg={current.ratingAvg} />}
                </View>
                <Tx size={10.5} color={C.muted} lh={15.5} style={{ marginTop: 3 }}>
                  {[current.zone ?? current.city, formatKm(current.distanceKm), current.isOpenNow ? 'ouvert' : null].filter(Boolean).join(' · ')}
                </Tx>
                <Tx size={12} color={C.subtle} lh={17} style={{ marginTop: 2 }}>
                  {current.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ')}
                </Tx>
              </View>
            </View>
            <NextSlots salon={current} />
          </Pressable>
        ) : (
          <P center>{query.isPending ? 'Chargement…' : 'Aucun salon dans cette zone.'}</P>
        )}
        {items.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
            {items.slice(0, 6).map((s) => (
              <Pressable key={s.id} accessibilityLabel={s.name} onPress={() => setSelected(s.id)} style={{ height: 5, width: s.id === current?.id ? 24 : 6, borderRadius: 2, backgroundColor: s.id === current?.id ? C.ink : C.line }} />
            ))}
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ alignSelf: 'center', paddingVertical: 3 }}>
          <Tx size={12} weight={500} color={C.muted}>
            Retour à la liste
          </Tx>
        </Pressable>
      </View>
    </View>
  );
}
