/**
 * C-H 02 — Localisation et rayon : position actuelle, rayon (1/2/5/10 km), quartiers proches.
 * C-H 03 — Position non reconnue : réglages du téléphone ou choix manuel d'un quartier.
 */
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Check, MapPin, Settings, Smartphone } from 'lucide-react-native';
import { useMe, useSalonCities, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR } from '@salondz/constants';
import { RADIUS_OPTIONS, useLocationPrefs } from '@/lib/prefs';
import { formatKm } from '@/lib/format';
import { Badge, BottomSheet, Button, Card, Grid, H1, I, InfoBox, ListCard, P, Row, SearchBox, SectionLabel, Slot, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { GridBg } from '@/ui/GridBg';
import { C, R, SHADOW } from '@/theme/design';

type GeoState = 'idle' | 'asking' | 'granted' | 'denied';

export default function Localisation() {
  const router = useRouter();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const [q, setQ] = useState('');
  const [geo, setGeo] = useState<GeoState>(prefs.lat != null ? 'granted' : 'idle');
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(prefs.lat != null ? { lat: prefs.lat, lng: prefs.lng!, accuracy: 0 } : null);
  const [city, setCity] = useState<string | null>(prefs.city);
  const [radius, setRadius] = useState(prefs.radiusKm);
  const [useGps, setUseGps] = useState(prefs.lat != null);

  const cities = useSalonCities({ wilaya: prefs.wilaya, gender: market, lat: pos?.lat, lng: pos?.lng, q: q || undefined });
  const preview = useSalonSearch({ gender: market, city: useGps ? undefined : (city ?? undefined), wilaya: prefs.wilaya, lat: useGps ? pos?.lat : undefined, lng: useGps ? pos?.lng : undefined, radiusKm: useGps ? radius : undefined, limit: 1 });

  const locate = async () => {
    setGeo('asking');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setGeo('denied');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPos({ lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)), accuracy: Math.round(p.coords.accuracy ?? 0) });
      setGeo('granted');
      setUseGps(true);
    } catch {
      setGeo('denied');
    }
  };

  useEffect(() => {
    if (geo === 'idle' && prefs.lat == null) void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearest = cities.data?.items[0]?.city ?? null;
  const label = useGps ? (nearest ?? 'Ma position') : (city ?? prefs.label);
  const count = preview.data?.total ?? 0;

  const apply = () => {
    setPrefs({ city: useGps ? null : city, lat: useGps ? (pos?.lat ?? null) : null, lng: useGps ? (pos?.lng ?? null) : null, radiusKm: radius, label });
    if (router.canGoBack()) router.back();
    else router.replace('/(client)/(tabs)');
  };

  if (geo === 'denied' && !city && prefs.lat == null) {
    // C-H 03 — Position non reconnue
    return (
      <Screen gap={16}>
        <TopBar close right={MARKET_LABELS_FR[market]} />
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 32 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={MapPin} size={36} color={C.muted} />
          </View>
          <Badge tone="cn" md dot={false}>
            Position indisponible
          </Badge>
          <H1 center>Localisation désactivée</H1>
          <P center>Nous ne pouvons pas trouver les professionnels proches de vous. Autorisez la localisation dans les réglages de votre téléphone, ou choisissez un quartier manuellement.</P>
        </View>
        <Card row gap={16}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={Smartphone} size={20} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={17} weight={600} lh={22}>
              Réglages du téléphone
            </Tx>
            <Tx size={14} color={C.muted} lh={20}>
              Salon DZ · Position · Jamais
            </Tx>
          </View>
          <Badge tone="cn" dot={false}>
            Refusé
          </Badge>
        </Card>
        <Card row gap={16} onPress={() => setGeo('idle')} accessibilityLabel="Choisir un quartier">
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={MapPin} size={20} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={17} weight={600} lh={22}>
              Choisir un quartier
            </Tx>
            <Tx size={14} color={C.muted} lh={20}>
              Sans activer la localisation
            </Tx>
          </View>
        </Card>
        <InfoBox>Le bouton ouvre la fiche Salon DZ dans les réglages du téléphone, à la ligne « Position ».</InfoBox>
        <Button onPress={() => void Linking.openSettings().catch(() => locate())}>
          <I icon={Settings} size={18} color="#fff" />
          <Tx size={16} weight={600} color="#fff" ls={-0.2}>
            Ouvrir les réglages
          </Tx>
        </Button>
        <Button variant="g" onPress={() => setGeo('idle')}>
          Choisir un quartier
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tx size={22} weight={700} ls={-0.4} lh={27}>
                {count} résultat{count > 1 ? 's' : ''}
              </Tx>
              <P>
                {label} · {useGps ? `${radius} km` : 'quartier'}
              </P>
            </View>
            <Button pill onPress={apply} style={{ paddingHorizontal: 28, paddingVertical: 14 }}>
              Appliquer
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar close right={MARKET_LABELS_FR[market]} />
      <H1>Localisation</H1>
      <SearchBox value={q} onChange={setQ} placeholder="Quartier, ville ou adresse" />

      <Card row gap={16} sel={useGps} onPress={() => (pos ? setUseGps(true) : void locate())} accessibilityLabel="Utiliser ma position actuelle">
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={MapPin} size={22} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={19} weight={600} lh={24}>
            Utiliser ma position actuelle
          </Tx>
          <P>{geo === 'asking' ? 'Recherche de votre position…' : pos ? `${nearest ?? 'Position trouvée'}${pos.accuracy ? ` · précision ${pos.accuracy} m` : ''}` : 'Autorisez la localisation'}</P>
        </View>
        {useGps && pos && <I icon={Check} size={22} />}
      </Card>

      {/* Aperçu stylisé de la zone (design) */}
      <View style={{ height: 160, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: C.fill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <GridBg step={90} />
        <View style={{ position: 'absolute', width: 190, height: 120, borderRadius: 60, borderWidth: 1, borderStyle: 'dashed', borderColor: C.disabled, backgroundColor: 'rgba(255,255,255,0.5)' }} />
        <View style={[{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, SHADOW.fab]}>
          <I icon={MapPin} size={22} color="#fff" />
        </View>
        <View style={[{ position: 'absolute', left: 24, bottom: 16, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 8 }, SHADOW.card]}>
          <Tx size={16} weight={600} lh={20}>
            Rayon de {radius} km
          </Tx>
        </View>
      </View>

      <SectionLabel>Rayon</SectionLabel>
      <Grid cols={4}>
        {RADIUS_OPTIONS.map((r) => (
          <Slot key={r} on={radius === r} onPress={() => setRadius(r)}>
            <Tx size={19} weight={500} lh={24} color={radius === r ? C.onInk : C.text} mono>
              {r} km
            </Tx>
          </Slot>
        ))}
      </Grid>

      <SectionLabel>Quartiers proches</SectionLabel>
      <ListCard>
        {(cities.data?.items ?? []).length === 0 && (
          <View style={{ paddingVertical: 12 }}>
            <P>{cities.isPending ? 'Chargement…' : 'Aucun quartier trouvé.'}</P>
          </View>
        )}
        {(cities.data?.items ?? []).map((c) => {
          const on = !useGps && city === c.city;
          return (
            <Row
              key={c.city}
              chevron={false}
              right={on ? <I icon={Check} size={20} /> : undefined}
              onPress={() => {
                setCity(c.city);
                setUseGps(false);
              }}
              accessibilityLabel={c.city}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <I icon={MapPin} size={20} color={C.subtle} />
                <View style={{ flex: 1 }}>
                  <Tx size={20} weight={600} lh={25} color={on ? C.text : C.muted}>
                    {c.city}
                  </Tx>
                  <P>
                    {c.salonCount} professionnel{c.salonCount > 1 ? 's' : ''}
                    {formatKm(c.distanceKm) ? ` · ${formatKm(c.distanceKm)}` : ''}
                  </P>
                </View>
              </View>
            </Row>
          );
        })}
      </ListCard>
    </Screen>
  );
}
