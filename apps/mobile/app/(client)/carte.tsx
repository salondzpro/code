/**
 * C-H 04 — Résultats sur la carte : fond OpenStreetMap réel (MapCanvas : WebView/iframe Leaflet, sans clé),
 * bulles de prix, cercle du rayon, feuille basse avec la carte du salon sélectionné.
 *
 * Interactive : déplacer la carte propose « Rechercher dans cette zone » (centre + rayon déduits de l'emprise),
 * le bouton de position utilise la géolocalisation, une bulle touchée sélectionne le salon (et inversement).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocateFixed, Search, SlidersHorizontal } from 'lucide-react-native';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, formatDA, reverseGeocode, type CategoryId } from '@salondz/constants';
import type { SalonSummary } from '@salondz/types';
import { useLocationPrefs } from '@/lib/prefs';
import { formatKm } from '@/lib/format';
import { Button, I, IconButton, Img, P, Pill, Tx } from '@/ui';
import { PillRow } from '@/ui/Pills';
import { RatingPill, NextSlots } from '@/ui/SalonListCard';
import { MapCanvas, type MapArea, type MapCanvasHandle, type MapState } from '@/ui/MapCanvas';
import { C, R, SHADOW } from '@/theme/design';

const ALGIERS = { lat: 36.7538, lng: 3.0588 };
type Pin = SalonSummary & { lat?: number | null; lng?: number | null };

export default function MapView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const [category, setCategory] = useState(params.category ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  /** Zone recherchée : celle des préférences, ou celle choisie en déplaçant la carte. */
  const [area, setArea] = useState<MapArea | null>(prefs.lat != null ? { lat: prefs.lat, lng: prefs.lng!, radiusKm: prefs.radiusKm } : null);
  const [pending, setPending] = useState<MapArea | null>(null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapCanvasHandle>(null);

  const query = useSalonSearch({
    gender: market,
    category: category ? (category as CategoryId) : undefined,
    city: area ? undefined : (prefs.city ?? undefined),
    wilaya: area || prefs.city ? undefined : prefs.wilaya,
    lat: area?.lat,
    lng: area?.lng,
    radiusKm: area?.radiusKm,
    availableToday: prefs.availableToday || undefined,
    ratingMin: prefs.ratingMin ?? undefined,
    limit: 50,
  });
  const items = useMemo(() => ((query.data?.items ?? []) as Pin[]).filter((s) => s.lat != null && s.lng != null), [query.data]);
  const current = items.find((s) => s.id === selected) ?? items[0] ?? null;

  const state = useMemo<MapState>(
    () => ({
      pins: items.map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng!, label: s.minPriceDa != null ? formatDA(s.minPriceDa) : s.name, on: s.id === current?.id })),
      area,
      fit: !area && !pending,
    }),
    [items, current?.id, area, pending],
  );

  const select = (id: string) => {
    setSelected(id);
    const s = items.find((x) => x.id === id);
    if (s) mapRef.current?.flyTo(s.lat!, s.lng!);
  };

  const searchHere = () => {
    if (!pending) return;
    setArea(pending);
    setPending(null);
    setSelected(null);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const a = { lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)), radiusKm: prefs.radiusKm };
      setArea(a);
      setPending(null);
      setSelected(null);
      setPrefs({ lat: a.lat, lng: a.lng, city: null, label: 'Ma position' });
      void reverseGeocode(a.lat, a.lng).then((r) => r && setPrefs({ label: r.label }));
      mapRef.current?.flyTo(a.lat, a.lng, 14);
    } catch {
      mapRef.current?.flyTo(area?.lat ?? ALGIERS.lat, area?.lng ?? ALGIERS.lng, 13);
    } finally {
      setLocating(false);
    }
  };

  const total = query.data?.total ?? 0;
  const noun = market === 'men' ? 'barbier' : 'salon';

  return (
    <View style={{ flex: 1, backgroundColor: '#EAECEE' }}>
      <MapCanvas ref={mapRef} state={state} onSelect={select} onMoveEnd={setPending} initialCenter={area ?? ALGIERS} style={{ flex: 1 }} />

      {/* Barre de recherche + filtres */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 16, gap: 10, paddingHorizontal: 16 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/recherche')} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: R.cardSm, paddingVertical: 12, paddingHorizontal: 13 }, SHADOW.card]}>
            <I icon={Search} size={18} color={C.subtle} />
            <Tx size={10.5} lh={14} color={C.subtle} numberOfLines={1} style={{ flex: 1 }}>
              {MARKET_LABELS_FR[market]} · {area && area.lat !== prefs.lat ? 'zone de la carte' : prefs.label}
            </Tx>
          </Pressable>
          <IconButton lg accessibilityLabel="Localisation et rayon" onPress={() => router.push('/localisation')} style={SHADOW.card}>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }} pointerEvents="box-none">
          <View style={[{ backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5 }, SHADOW.card]}>
            <Tx size={10} weight={500} color={C.muted} lh={13}>
              {query.isFetching ? 'Recherche…' : `${total} ${noun}${total > 1 ? 's' : ''} dans cette zone`}
            </Tx>
          </View>
          {pending && (
            <Button pill onPress={searchHere} style={[{ paddingHorizontal: 13, paddingVertical: 7 }, SHADOW.card]}>
              Rechercher dans cette zone
            </Button>
          )}
        </View>
      </View>

      <IconButton lg accessibilityLabel="Ma position" onPress={() => void locate()} disabled={locating} style={[{ position: 'absolute', right: 16, bottom: 200 + insets.bottom }, SHADOW.card]}>
        <I icon={LocateFixed} size={16} color={locating ? C.subtle : C.text} />
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
          <P center>{query.isPending ? 'Chargement…' : 'Aucun salon dans cette zone. Déplacez la carte puis « Rechercher dans cette zone ».'}</P>
        )}
        {items.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
            {items.slice(0, 8).map((s) => (
              <Pressable key={s.id} accessibilityLabel={s.name} onPress={() => select(s.id)} style={{ height: 5, width: s.id === current?.id ? 24 : 6, borderRadius: 2, backgroundColor: s.id === current?.id ? C.ink : C.line }} />
            ))}
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)'))} style={{ alignSelf: 'center', paddingVertical: 3 }}>
          <Tx size={12} weight={500} color={C.muted}>
            Retour à la liste
          </Tx>
        </Pressable>
      </View>
    </View>
  );
}
