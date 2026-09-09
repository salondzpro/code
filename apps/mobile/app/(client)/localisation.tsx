/**
 * C-H 02 — Localisation et rayon : position actuelle, rayon (1/2/5/10 km), quartiers proches.
 * C-H 03 — Position non reconnue : réglages du téléphone ou choix manuel d'un quartier.
 *
 * Recherche interactive par lieu : dès la saisie, on propose les quartiers et villes où il y a des
 * professionnels (toutes wilayas), les wilayas elles-mêmes, et des adresses géocodées (OpenStreetMap)
 * qui deviennent un point + rayon. Le nombre de résultats se met à jour en direct.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Building2, Check, Clock, MapPin, Navigation, Settings, Smartphone } from 'lucide-react-native';
import { useMe, useSalonCities, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, WILAYAS, geocodeDZ, reverseGeocode, wilayaName, type GeoPlace } from '@salondz/constants';
import { RADIUS_OPTIONS, pushRecentPlace, useLocationPrefs, useRecentPlaces, type RecentPlace } from '@/lib/prefs';
import { useDebounced } from '@/lib/useDebounced';
import { formatKm } from '@/lib/format';
import { Badge, BottomSheet, Button, Card, Grid, H1, I, InfoBox, ListCard, P, Pill, Row, SearchBox, SectionLabel, Slot, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { GridBg } from '@/ui/GridBg';
import { C, R, SHADOW } from '@/theme/design';

type GeoState = 'idle' | 'asking' | 'granted' | 'denied';
type Choice = { kind: 'city'; city: string; wilaya: number; label: string } | { kind: 'wilaya'; wilaya: number; label: string } | { kind: 'point'; lat: number; lng: number; label: string } | { kind: 'gps' };

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function Localisation() {
  const router = useRouter();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const recent = useRecentPlaces();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const [geo, setGeo] = useState<GeoState>(prefs.lat != null ? 'granted' : 'idle');
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(prefs.lat != null && !prefs.city ? { lat: prefs.lat, lng: prefs.lng!, accuracy: 0 } : null);
  const [radius, setRadius] = useState(prefs.radiusKm);
  const [choice, setChoice] = useState<Choice>(() =>
    prefs.lat != null && prefs.label !== 'Ma position' && prefs.city == null && prefs.label !== wilayaName(prefs.wilaya)
      ? { kind: 'point', lat: prefs.lat, lng: prefs.lng!, label: prefs.label }
      : prefs.lat != null
        ? { kind: 'gps' }
        : prefs.city
          ? { kind: 'city', city: prefs.city, wilaya: prefs.wilaya, label: prefs.label }
          : { kind: 'wilaya', wilaya: prefs.wilaya, label: wilayaName(prefs.wilaya) },
  );
  const [addresses, setAddresses] = useState<GeoPlace[]>([]);
  /** Libellé de la position réelle (géocodage inverse), jamais le quartier le plus proche ayant des salons. */
  const [posLabel, setPosLabel] = useState<{ label: string; inDZ: boolean } | null>(prefs.lat != null && !prefs.city && prefs.label !== 'Ma position' && prefs.label !== wilayaName(prefs.wilaya) ? { label: prefs.label, inDZ: true } : null);

  const cities = useSalonCities({ wilaya: dq ? undefined : prefs.wilaya, gender: market, lat: pos?.lat, lng: pos?.lng, q: dq || undefined });
  const wilayaHits = useMemo(() => (dq.length < 2 ? [] : WILAYAS.filter((w) => normalize(w.name).includes(normalize(dq))).slice(0, 4)), [dq]);

  useEffect(() => {
    if (dq.length < 3) return setAddresses([]);
    const ctrl = new AbortController();
    geocodeDZ(dq, ctrl.signal)
      .then(setAddresses)
      .catch(() => setAddresses([]));
    return () => ctrl.abort();
  }, [dq]);

  // Libellé de la position réelle, recalculé à chaque nouvelle position (même celle mémorisée).
  useEffect(() => {
    if (!pos) return;
    const ctrl = new AbortController();
    void reverseGeocode(pos.lat, pos.lng, ctrl.signal).then((r) => r && setPosLabel(r));
    return () => ctrl.abort();
  }, [pos?.lat, pos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = choice.kind === 'point' ? choice : choice.kind === 'gps' && pos ? pos : null;
  const preview = useSalonSearch({
    gender: market,
    city: choice.kind === 'city' ? choice.city : undefined,
    wilaya: choice.kind === 'city' || choice.kind === 'wilaya' ? choice.wilaya : undefined,
    lat: point?.lat,
    lng: point?.lng,
    radiusKm: point ? radius : undefined,
    limit: 1,
  });

  const locate = async () => {
    setGeo('asking');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setGeo('denied');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = Number(p.coords.latitude.toFixed(4));
      const lng = Number(p.coords.longitude.toFixed(4));
      setPos({ lat, lng, accuracy: Math.round(p.coords.accuracy ?? 0) });
      setGeo('granted');
      setChoice({ kind: 'gps' });
    } catch {
      setGeo('denied');
    }
  };

  useEffect(() => {
    if (geo === 'idle' && prefs.lat == null && !prefs.city) void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearest = cities.data?.items[0] ?? null;
  const label = choice.kind === 'gps' ? (posLabel?.label ?? 'Ma position') : choice.label;
  const farAway = choice.kind === 'gps' && posLabel !== null && !posLabel.inDZ;
  const count = preview.data?.total ?? 0;
  const withRadius = choice.kind === 'gps' || choice.kind === 'point';
  const searching = dq.length >= 2;
  const places = cities.data?.items ?? [];

  const apply = () => {
    const next =
      choice.kind === 'city'
        ? { city: choice.city, wilaya: choice.wilaya, lat: null, lng: null, label: choice.label }
        : choice.kind === 'wilaya'
          ? { city: null, wilaya: choice.wilaya, lat: null, lng: null, label: choice.label }
          : choice.kind === 'point'
            ? { city: null, lat: choice.lat, lng: choice.lng, label: choice.label }
            : { city: null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, label };
    setPrefs({ ...next, radiusKm: radius });
    const wilaya = choice.kind === 'city' || choice.kind === 'wilaya' ? choice.wilaya : prefs.wilaya;
    if (choice.kind !== 'gps') pushRecentPlace({ label: next.label, city: next.city, wilaya, lat: next.lat, lng: next.lng });
    if (router.canGoBack()) router.back();
    else router.replace('/(client)/(tabs)');
  };

  const pickRecent = (r: RecentPlace) => {
    setChoice(r.lat != null && r.lng != null ? { kind: 'point', lat: r.lat, lng: r.lng, label: r.label } : r.city ? { kind: 'city', city: r.city, wilaya: r.wilaya, label: r.label } : { kind: 'wilaya', wilaya: r.wilaya, label: r.label });
    setQ('');
  };

  const chooseManually = () => setChoice({ kind: 'wilaya', wilaya: prefs.wilaya, label: wilayaName(prefs.wilaya) });

  if (geo === 'denied' && choice.kind === 'gps' && prefs.lat == null) {
    // C-H 03 — Position non reconnue
    return (
      <Screen gap={13}>
        <TopBar close right={MARKET_LABELS_FR[market]} />
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 26 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={MapPin} size={29} color={C.muted} />
          </View>
          <Badge tone="cn" md dot={false}>
            Position indisponible
          </Badge>
          <H1 center>Localisation désactivée</H1>
          <P center>Nous ne pouvons pas trouver les professionnels proches de vous. Autorisez la localisation dans les réglages de votre téléphone, ou choisissez un quartier manuellement.</P>
        </View>
        <Card row gap={13}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={Smartphone} size={16} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={10.5} weight={600} lh={14.5}>
              Réglages du téléphone
            </Tx>
            <Tx size={11.5} color={C.muted} lh={16}>
              Salon DZ · Position · Jamais
            </Tx>
          </View>
          <Badge tone="cn" dot={false}>
            Refusé
          </Badge>
        </Card>
        <Card row gap={13} onPress={chooseManually} accessibilityLabel="Choisir un quartier">
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={MapPin} size={16} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={10.5} weight={600} lh={14.5}>
              Choisir un quartier
            </Tx>
            <Tx size={11.5} color={C.muted} lh={16}>
              Sans activer la localisation
            </Tx>
          </View>
        </Card>
        <InfoBox>Le bouton ouvre la fiche Salon DZ dans les réglages du téléphone, à la ligne « Position ».</InfoBox>
        <Button onPress={() => void Linking.openSettings().catch(() => locate())}>
          <I icon={Settings} size={14.5} color="#fff" />
          <Tx size={10.5} weight={600} color="#fff" ls={-0.2}>
            Ouvrir les réglages
          </Tx>
        </Button>
        <Button variant="g" onPress={chooseManually}>
          Choisir un quartier
        </Button>
      </Screen>
    );
  }

  const placeRow = (c: (typeof places)[number], muted: boolean) => {
    const on = choice.kind === 'city' && choice.city === c.city && choice.wilaya === c.wilayaCode;
    const lbl = c.parentCity ? `${c.city}, ${c.parentCity}` : c.city;
    return (
      <Row key={`c-${c.city}-${c.wilayaCode}`} chevron={false} right={on ? <I icon={Check} size={16} /> : undefined} onPress={() => setChoice({ kind: 'city', city: c.city, wilaya: c.wilayaCode, label: lbl })} accessibilityLabel={lbl}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <I icon={MapPin} size={16} color={C.subtle} />
          <View style={{ flex: 1 }}>
            <Tx size={13} weight={600} lh={17} color={on || !muted ? C.text : C.muted}>
              {lbl}
            </Tx>
            <P>
              {c.salonCount} professionnel{c.salonCount > 1 ? 's' : ''} · {wilayaName(c.wilayaCode)}
              {formatKm(c.distanceKm) ? ` · ${formatKm(c.distanceKm)}` : ''}
            </P>
          </View>
        </View>
      </Row>
    );
  };

  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Tx size={14.5} weight={700} ls={-0.4} lh={18.5}>
                {preview.isFetching ? '…' : `${count} résultat${count > 1 ? 's' : ''}`}
              </Tx>
              <P>
                {label} · {withRadius ? `${radius} km` : choice.kind === 'wilaya' ? 'toute la wilaya' : 'quartier'}
              </P>
            </View>
            <Button pill onPress={apply} style={{ paddingHorizontal: 23, paddingVertical: 11 }}>
              Appliquer
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar close right={MARKET_LABELS_FR[market]} />
      <H1>Localisation</H1>
      <SearchBox value={q} onChange={setQ} placeholder="Quartier, ville, wilaya ou adresse" />

      {!searching && recent.length > 0 && (
        <PillRow>
          {recent.map((r) => (
            <Pill key={r.label} lg on={choice.kind !== 'gps' && choice.label === r.label} onPress={() => pickRecent(r)}>
              <I icon={Clock} size={12} color={choice.kind !== 'gps' && choice.label === r.label ? C.onInk : C.subtle} />
              <Tx size={10.5} weight={500} lh={14} color={choice.kind !== 'gps' && choice.label === r.label ? C.onInk : C.text}>
                {r.label}
              </Tx>
            </Pill>
          ))}
        </PillRow>
      )}

      {searching ? (
        <ListCard>
          {wilayaHits.map((w) => {
            const on = choice.kind === 'wilaya' && choice.wilaya === w.code;
            return (
              <Row key={`w-${w.code}`} chevron={false} right={on ? <I icon={Check} size={16} /> : undefined} onPress={() => setChoice({ kind: 'wilaya', wilaya: w.code, label: w.name })} accessibilityLabel={`${w.name} · wilaya`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <I icon={Building2} size={16} color={C.subtle} />
                  <View style={{ flex: 1 }}>
                    <Tx size={13} weight={600} lh={17}>
                      {w.name}
                    </Tx>
                    <P>Wilaya {String(w.code).padStart(2, '0')} · toute la wilaya</P>
                  </View>
                </View>
              </Row>
            );
          })}
          {places.map((c) => placeRow(c, false))}
          {addresses.map((a) => {
            const on = choice.kind === 'point' && choice.lat === a.lat && choice.lng === a.lng;
            return (
              <Row key={`a-${a.lat}-${a.lng}`} chevron={false} right={on ? <I icon={Check} size={16} /> : undefined} onPress={() => setChoice({ kind: 'point', lat: a.lat, lng: a.lng, label: a.label })} accessibilityLabel={a.label}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <I icon={Navigation} size={16} color={C.subtle} />
                  <View style={{ flex: 1 }}>
                    <Tx size={13} weight={600} lh={17}>
                      {a.label}
                    </Tx>
                    <P>{a.detail || 'Adresse'} · rayon autour de ce point</P>
                  </View>
                </View>
              </Row>
            );
          })}
          {wilayaHits.length === 0 && places.length === 0 && addresses.length === 0 && (
            <View style={{ paddingVertical: 10 }}>
              <P>{cities.isFetching ? 'Recherche…' : 'Aucun lieu trouvé. Essayez une ville ou une wilaya.'}</P>
            </View>
          )}
        </ListCard>
      ) : (
        <>
          <Card row gap={13} sel={choice.kind === 'gps'} onPress={() => (pos ? setChoice({ kind: 'gps' }) : void locate())} accessibilityLabel="Utiliser ma position actuelle">
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <I icon={MapPin} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={12} weight={600} lh={16}>
                Utiliser ma position actuelle
              </Tx>
              <P>{geo === 'asking' ? 'Recherche de votre position…' : pos ? `${posLabel?.label ?? 'Position trouvée'}${pos.accuracy ? ` · précision ${pos.accuracy} m` : ''}` : 'Autorisez la localisation'}</P>
            </View>
            {choice.kind === 'gps' && pos && <I icon={Check} size={18} />}
          </Card>

          <View style={{ height: 130, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: C.fill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <GridBg step={90} />
            <View style={{ position: 'absolute', width: 154, height: 98, borderRadius: 49, borderWidth: 1, borderStyle: 'dashed', borderColor: C.disabled, backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <View style={[{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, SHADOW.fab]}>
              <I icon={MapPin} size={18} color="#fff" />
            </View>
            <View style={[{ position: 'absolute', left: 20, bottom: 13, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 13, paddingVertical: 6 }, SHADOW.card]}>
              <Tx size={10.5} weight={600} lh={14}>
                {withRadius ? `Rayon de ${radius} km` : label}
              </Tx>
            </View>
          </View>

          {withRadius && (
            <>
              <SectionLabel>Rayon</SectionLabel>
              <Grid cols={4}>
                {RADIUS_OPTIONS.map((r) => (
                  <Slot key={r} on={radius === r} onPress={() => setRadius(r)}>
                    <Tx size={12} weight={500} lh={16} color={radius === r ? C.onInk : C.text} mono>
                      {r} km
                    </Tx>
                  </Slot>
                ))}
              </Grid>
            </>
          )}

          {farAway && <P>Vous êtes hors d'Algérie : les professionnels les plus proches sont à {formatKm(nearest?.distanceKm) ?? 'plus de 100 km'}. Choisissez un quartier ci-dessous pour préparer une réservation.</P>}
          <SectionLabel>{pos ? 'Quartiers les plus proches' : `Quartiers · ${wilayaName(prefs.wilaya)}`}</SectionLabel>
          <ListCard>
            {places.length === 0 && (
              <View style={{ paddingVertical: 10 }}>
                <P>{cities.isPending ? 'Chargement…' : 'Aucun quartier ici pour l’instant. Cherchez une autre ville ci-dessus.'}</P>
              </View>
            )}
            {places.map((c) => placeRow(c, true))}
          </ListCard>
        </>
      )}
    </Screen>
  );
}
