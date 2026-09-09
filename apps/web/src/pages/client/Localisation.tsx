/**
 * C-H 02 — Localisation et rayon : position actuelle, rayon (1/2/5/10 km), quartiers proches.
 * C-H 03 — Position non reconnue : réglages du téléphone ou choix manuel d'un quartier.
 *
 * Recherche interactive par lieu : dès la saisie, on propose les quartiers et villes où il y a des
 * professionnels (toutes wilayas), les wilayas elles-mêmes, et des adresses géocodées (OpenStreetMap)
 * qui deviennent un point + rayon. Le nombre de résultats se met à jour en direct.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBack } from '@/lib/useBack';
import { Building2, Check, Clock, MapPin, Navigation, Settings, Smartphone } from 'lucide-react';
import { useMe, useSalonCities, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, WILAYAS, geocodeDZ, reverseGeocode, wilayaName, type GeoPlace } from '@salondz/constants';
import { RADIUS_OPTIONS, formatKm, pushRecentPlace, readRecentPlaces, useLocationPrefs, type RecentPlace } from '@/lib/clientPrefs';
import { useDebounced } from '@/lib/useDebounced';
import { BottomSheet, Button, Card, I, InfoBox, Pill, SearchBox, SectionLabel, TopBar } from '@/components/ui';
import { MiniMap } from '@/components/MiniMap';
import { Screen, SHEET_PAD } from '@/components/AppFrame';

type GeoState = 'idle' | 'asking' | 'granted' | 'denied';
/** Lieu sélectionné dans l'écran : quartier/ville (filtre `city`), wilaya entière, ou point géocodé (rayon). */
type Choice = { kind: 'city'; city: string; wilaya: number; label: string } | { kind: 'wilaya'; wilaya: number; label: string } | { kind: 'point'; lat: number; lng: number; label: string } | { kind: 'gps' };

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function Localisation() {
  const back = useBack('/');
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
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
  const [recent] = useState<RecentPlace[]>(readRecentPlaces);

  // Lieux (quartiers + villes) : autour de moi sans saisie, tout le pays dès qu'on tape.
  const cities = useSalonCities({ wilaya: dq ? undefined : prefs.wilaya, gender: market, lat: pos?.lat, lng: pos?.lng, q: dq || undefined });
  const wilayaHits = useMemo(() => (dq.length < 2 ? [] : WILAYAS.filter((w) => normalize(w.name).includes(normalize(dq))).slice(0, 4)), [dq]);

  // Adresses géocodées (OpenStreetMap) — silencieux en cas d'échec réseau.
  useEffect(() => {
    if (dq.length < 3) return setAddresses([]);
    const ctrl = new AbortController();
    geocodeDZ(dq, ctrl.signal)
      .then(setAddresses)
      .catch(() => setAddresses([]));
    return () => ctrl.abort();
  }, [dq]);

  // Aperçu du nombre de résultats pour le choix courant.
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

  const locate = () => {
    if (!('geolocation' in navigator)) return setGeo('denied');
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Number(p.coords.latitude.toFixed(4));
        const lng = Number(p.coords.longitude.toFixed(4));
        setPos({ lat, lng, accuracy: Math.round(p.coords.accuracy) });
        setGeo('granted');
        setChoice({ kind: 'gps' });
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  useEffect(() => {
    if (geo === 'idle' && prefs.lat == null && !prefs.city) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearest = cities.data?.items[0] ?? null;
  const label = choice.kind === 'gps' ? (posLabel?.label ?? 'Ma position') : choice.label;
  const farAway = choice.kind === 'gps' && posLabel !== null && !posLabel.inDZ;
  const count = preview.data?.total ?? 0;
  const withRadius = choice.kind === 'gps' || choice.kind === 'point';

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
    back();
  };

  const pickRecent = (r: RecentPlace) => {
    setChoice(r.lat != null && r.lng != null ? { kind: 'point', lat: r.lat, lng: r.lng, label: r.label } : r.city ? { kind: 'city', city: r.city, wilaya: r.wilaya, label: r.label } : { kind: 'wilaya', wilaya: r.wilaya, label: r.label });
    setQ('');
  };

  if (geo === 'denied' && choice.kind === 'gps' && prefs.lat == null) {
    // C-H 03 — Position non reconnue
    return (
      <Screen className="min-h-dvh" gap={16}>
        <TopBar close right={MARKET_LABELS_FR[market]} />
        <div className="flex flex-col items-center gap-3 pt-8 text-center">
          <div className="flex h-[6rem] w-[6rem] items-center justify-center rounded-full bg-fill text-muted">
            <I icon={MapPin} size={36} />
          </div>
          <span className="badge b-cn md">Position indisponible</span>
          <h1 className="h1">Localisation désactivée</h1>
          <p className="p">Nous ne pouvons pas trouver les professionnels proches de vous. Autorisez la localisation dans les réglages de votre téléphone, ou choisissez un quartier manuellement.</p>
        </div>
        <Card className="!flex-row items-center gap-4">
          <span className="flex h-[2.625rem] w-[2.625rem] flex-none items-center justify-center rounded-full bg-fill">
            <I icon={Smartphone} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.8125rem] font-semibold">Réglages du téléphone</span>
            <span className="p block text-[0.875rem]">Salon DZ · Position · Jamais</span>
          </span>
          <span className="badge b-cn">Refusé</span>
        </Card>
        <Card as="button" className="!flex-row items-center gap-4" onClick={() => setChoice({ kind: 'wilaya', wilaya: prefs.wilaya, label: wilayaName(prefs.wilaya) })}>
          <span className="flex h-[2.625rem] w-[2.625rem] flex-none items-center justify-center rounded-full bg-fill">
            <I icon={MapPin} size={20} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[0.8125rem] font-semibold">Choisir un quartier</span>
            <span className="p block text-[0.875rem]">Sans activer la localisation</span>
          </span>
        </Card>
        <InfoBox>Le bouton ouvre la fiche Salon DZ dans les réglages du téléphone, à la ligne « Position ».</InfoBox>
        <Button onClick={locate}>
          <I icon={Settings} size={18} /> Ouvrir les réglages
        </Button>
        <Button variant="g" onClick={() => setChoice({ kind: 'wilaya', wilaya: prefs.wilaya, label: wilayaName(prefs.wilaya) })}>
          Choisir un quartier
        </Button>
      </Screen>
    );
  }

  const searching = dq.length >= 2;
  const places = cities.data?.items ?? [];

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar close right={MARKET_LABELS_FR[market]} />
      <h1 className="h1">Localisation</h1>
      <SearchBox value={q} onChange={setQ} placeholder="Quartier, ville, wilaya ou adresse" />

      {/* Lieux récents */}
      {!searching && recent.length > 0 && (
        <div className="pills -mx-5 px-5">
          {recent.map((r) => (
            <Pill key={r.label} lg on={choice.kind !== 'gps' && choice.label === r.label} onClick={() => pickRecent(r)}>
              <I icon={Clock} size={14} className="text-subtle" /> {r.label}
            </Pill>
          ))}
        </div>
      )}

      {/* Résultats de la saisie : wilayas, quartiers/villes, adresses */}
      {searching ? (
        <Card className="!gap-0 !py-1" aria-live="polite">
          {wilayaHits.map((w) => {
            const on = choice.kind === 'wilaya' && choice.wilaya === w.code;
            return (
              <button key={`w-${w.code}`} type="button" className="li w-full text-left" onClick={() => setChoice({ kind: 'wilaya', wilaya: w.code, label: w.name })}>
                <span className="flex items-center gap-3.5">
                  <I icon={Building2} size={20} className="text-subtle" />
                  <span>
                    <span className="block text-[1rem] font-semibold">{w.name}</span>
                    <span className="p block">Wilaya {String(w.code).padStart(2, '0')} · toute la wilaya</span>
                  </span>
                </span>
                {on && <I icon={Check} size={20} />}
              </button>
            );
          })}
          {places.map((c) => {
            const on = choice.kind === 'city' && choice.city === c.city && choice.wilaya === c.wilayaCode;
            const label = c.parentCity ? `${c.city}, ${c.parentCity}` : c.city;
            return (
              <button key={`c-${c.city}-${c.wilayaCode}`} type="button" className="li w-full text-left" onClick={() => setChoice({ kind: 'city', city: c.city, wilaya: c.wilayaCode, label })}>
                <span className="flex items-center gap-3.5">
                  <I icon={MapPin} size={20} className="text-subtle" />
                  <span>
                    <span className="block text-[1rem] font-semibold">{label}</span>
                    <span className="p block">
                      {c.salonCount} professionnel{c.salonCount > 1 ? 's' : ''} · {wilayaName(c.wilayaCode)}
                      {formatKm(c.distanceKm) ? ` · ${formatKm(c.distanceKm)}` : ''}
                    </span>
                  </span>
                </span>
                {on && <I icon={Check} size={20} />}
              </button>
            );
          })}
          {addresses.map((a) => {
            const on = choice.kind === 'point' && choice.lat === a.lat && choice.lng === a.lng;
            return (
              <button key={`a-${a.lat}-${a.lng}`} type="button" className="li w-full text-left" onClick={() => setChoice({ kind: 'point', lat: a.lat, lng: a.lng, label: a.label })}>
                <span className="flex items-center gap-3.5">
                  <I icon={Navigation} size={20} className="text-subtle" />
                  <span>
                    <span className="block text-[1rem] font-semibold">{a.label}</span>
                    <span className="p block">{a.detail || 'Adresse'} · rayon autour de ce point</span>
                  </span>
                </span>
                {on && <I icon={Check} size={20} />}
              </button>
            );
          })}
          {wilayaHits.length === 0 && places.length === 0 && addresses.length === 0 && <p className="p py-3">{cities.isFetching ? 'Recherche…' : 'Aucun lieu trouvé. Essayez une ville ou une wilaya.'}</p>}
        </Card>
      ) : (
        <>
          <Card as="button" sel={choice.kind === 'gps'} className="!flex-row items-center gap-4" onClick={() => (pos ? setChoice({ kind: 'gps' }) : locate())}>
            <span className="flex h-[3.25rem] w-[3.25rem] flex-none items-center justify-center rounded-full bg-ink text-white">
              <I icon={MapPin} size={22} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[0.9375rem] font-semibold">Utiliser ma position actuelle</span>
              <span className="p block">{geo === 'asking' ? 'Recherche de votre position…' : pos ? `${posLabel?.label ?? 'Position trouvée'}${pos.accuracy ? ` · précision ${pos.accuracy} m` : ''}` : 'Autorisez la localisation'}</span>
            </span>
            {choice.kind === 'gps' && pos && <I icon={Check} size={22} />}
          </Card>

          {/* Vraie carte : position (ou point choisi) et cercle du rayon ; sinon le quartier / la wilaya */}
          {point ? (
            <MiniMap lat={point.lat} lng={point.lng} radiusKm={radius} label={`Rayon de ${radius} km`} className="h-[11rem]" />
          ) : (
            <div className="relative h-[6rem] overflow-hidden rounded-[1.25rem] border border-line bg-fill">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(#e6e7e9 2px, transparent 2px), linear-gradient(90deg, #e6e7e9 2px, transparent 2px)', backgroundSize: '90px 70px' }} />
              <span className="absolute bottom-3 left-4 rounded-full bg-surface px-3 py-1.5 text-[0.8125rem] font-semibold shadow-card">{label}</span>
            </div>
          )}

          {withRadius && (
            <>
              <SectionLabel>Rayon</SectionLabel>
              <div className="g4">
                {RADIUS_OPTIONS.map((r) => (
                  <button key={r} type="button" className={`slot !text-[0.9375rem] ${radius === r ? 'on' : ''}`} onClick={() => setRadius(r)} aria-pressed={radius === r}>
                    {r} km
                  </button>
                ))}
              </div>
            </>
          )}

          {farAway && <p className="p">Vous êtes hors d'Algérie : les professionnels les plus proches sont à {formatKm(nearest?.distanceKm) ?? 'plus de 100 km'}. Choisissez un quartier ci-dessous pour préparer une réservation.</p>}
          <SectionLabel>{pos ? 'Quartiers les plus proches' : `Quartiers · ${wilayaName(prefs.wilaya)}`}</SectionLabel>
          <Card className="!gap-0 !py-1">
            {places.length === 0 && <p className="p py-3">{cities.isPending ? 'Chargement…' : 'Aucun quartier ici pour l’instant. Cherchez une autre ville ci-dessus.'}</p>}
            {places.map((c) => {
              const on = choice.kind === 'city' && choice.city === c.city && choice.wilaya === c.wilayaCode;
              const label = c.parentCity ? `${c.city}, ${c.parentCity}` : c.city;
              return (
                <button key={`${c.city}-${c.wilayaCode}`} type="button" className="li w-full text-left" onClick={() => setChoice({ kind: 'city', city: c.city, wilaya: c.wilayaCode, label })}>
                  <span className="flex items-center gap-3.5">
                    <I icon={MapPin} size={20} className="text-subtle" />
                    <span>
                      <span className={`block text-[1rem] font-semibold ${on ? '' : 'text-muted'}`}>{label}</span>
                      <span className="p block">
                        {c.salonCount} professionnel{c.salonCount > 1 ? 's' : ''}
                        {formatKm(c.distanceKm) ? ` · ${formatKm(c.distanceKm)}` : ''}
                      </span>
                    </span>
                  </span>
                  {on && <I icon={Check} size={20} />}
                </button>
              );
            })}
          </Card>
        </>
      )}

      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[1.125rem] font-bold tracking-[-0.4px]" aria-live="polite">
              {preview.isFetching ? '…' : `${count} résultat${count > 1 ? 's' : ''}`}
            </div>
            <div className="p">
              {label} · {withRadius ? `${radius} km` : choice.kind === 'wilaya' ? 'toute la wilaya' : 'quartier'}
            </div>
          </div>
          <Button auto className="!rounded-full !px-7 !py-3.5" onClick={apply}>
            Appliquer
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}
