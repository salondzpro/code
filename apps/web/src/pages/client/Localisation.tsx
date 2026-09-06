/**
 * C-H 02 — Localisation et rayon : position actuelle, rayon (1/2/5/10 km), quartiers proches.
 * C-H 03 — Position non reconnue : réglages du téléphone ou choix manuel d'un quartier.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, MapPin, Settings, Smartphone } from 'lucide-react';
import { useMe, useSalonCities, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR } from '@salondz/constants';
import { RADIUS_OPTIONS, formatKm, useLocationPrefs } from '@/lib/clientPrefs';
import { BottomSheet, Button, Card, I, InfoBox, Pill, SearchBox, SectionLabel, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';

type GeoState = 'idle' | 'asking' | 'granted' | 'denied';

export function Localisation() {
  const navigate = useNavigate();
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

  const locate = () => {
    if (!('geolocation' in navigator)) return setGeo('denied');
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)), accuracy: Math.round(p.coords.accuracy) });
        setGeo('granted');
        setUseGps(true);
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  useEffect(() => {
    if (geo === 'idle' && prefs.lat == null) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearest = cities.data?.items[0]?.city ?? null;
  const label = useGps ? (nearest ?? 'Ma position') : (city ?? prefs.label);
  const count = preview.data?.total ?? 0;

  const apply = () => {
    setPrefs({ city: useGps ? null : city, lat: useGps ? (pos?.lat ?? null) : null, lng: useGps ? (pos?.lng ?? null) : null, radiusKm: radius, label });
    navigate(-1);
  };

  if (geo === 'denied' && !city && prefs.lat == null) {
    // C-H 03 — Position non reconnue
    return (
      <Screen className="min-h-dvh" gap={16}>
        <TopBar close right={MARKET_LABELS_FR[market]} />
        <div className="flex flex-col items-center gap-3 pt-8 text-center">
          <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-fill text-muted">
            <I icon={MapPin} size={36} />
          </div>
          <span className="badge b-cn md">Position indisponible</span>
          <h1 className="h1">Localisation désactivée</h1>
          <p className="p">Nous ne pouvons pas trouver les professionnels proches de vous. Autorisez la localisation dans les réglages de votre téléphone, ou choisissez un quartier manuellement.</p>
        </div>
        <Card className="!flex-row items-center gap-4">
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-fill">
            <I icon={Smartphone} size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">Réglages du téléphone</span>
            <span className="p block text-[14px]">Salon DZ · Position · Jamais</span>
          </span>
          <span className="badge b-cn">Refusé</span>
        </Card>
        <Card as="button" className="!flex-row items-center gap-4" onClick={() => setGeo('idle')}>
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-fill">
            <I icon={MapPin} size={20} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[17px] font-semibold">Choisir un quartier</span>
            <span className="p block text-[14px]">Sans activer la localisation</span>
          </span>
        </Card>
        <InfoBox>Le bouton ouvre la fiche Salon DZ dans les réglages du téléphone, à la ligne « Position ».</InfoBox>
        <Button onClick={locate}>
          <I icon={Settings} size={18} /> Ouvrir les réglages
        </Button>
        <Button variant="g" onClick={() => setGeo('idle')}>
          Choisir un quartier
        </Button>
      </Screen>
    );
  }

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar close right={MARKET_LABELS_FR[market]} />
      <h1 className="h1">Localisation</h1>
      <SearchBox value={q} onChange={setQ} placeholder="Quartier, ville ou adresse" />

      <Card as="button" sel={useGps} className="!flex-row items-center gap-4" onClick={() => (pos ? setUseGps(true) : locate())}>
        <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-ink text-white">
          <I icon={MapPin} size={22} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[19px] font-semibold">Utiliser ma position actuelle</span>
          <span className="p block">{geo === 'asking' ? 'Recherche de votre position…' : pos ? `${nearest ?? 'Position trouvée'}${pos.accuracy ? ` · précision ${pos.accuracy} m` : ''}` : 'Autorisez la localisation'}</span>
        </span>
        {useGps && pos && <I icon={Check} size={22} />}
      </Card>

      {/* Aperçu stylisé de la zone (design) */}
      <div className="relative h-[160px] overflow-hidden rounded-[20px] border border-line bg-fill">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(#e6e7e9 2px, transparent 2px), linear-gradient(90deg, #e6e7e9 2px, transparent 2px)', backgroundSize: '90px 70px' }} />
        <div className="absolute left-1/2 top-1/2 h-[120px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-disabled bg-white/50" />
        <span className="absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white shadow-fab">
          <I icon={MapPin} size={22} />
        </span>
        <span className="absolute bottom-4 left-6 rounded-full bg-surface px-4 py-2 text-[16px] font-semibold shadow-card">Rayon de {radius} km</span>
      </div>

      <SectionLabel>Rayon</SectionLabel>
      <div className="g4">
        {RADIUS_OPTIONS.map((r) => (
          <button key={r} type="button" className={`slot !text-[19px] ${radius === r ? 'on' : ''}`} onClick={() => setRadius(r)} aria-pressed={radius === r}>
            {r} km
          </button>
        ))}
      </div>

      <SectionLabel>Quartiers proches</SectionLabel>
      <Card className="!gap-0 !py-1">
        {(cities.data?.items ?? []).length === 0 && <p className="p py-3">{cities.isPending ? 'Chargement…' : 'Aucun quartier trouvé.'}</p>}
        {(cities.data?.items ?? []).map((c) => {
          const on = !useGps && city === c.city;
          return (
            <button
              key={c.city}
              type="button"
              className="li w-full text-left"
              onClick={() => {
                setCity(c.city);
                setUseGps(false);
              }}
            >
              <span className="flex items-center gap-3.5">
                <I icon={MapPin} size={20} className="text-subtle" />
                <span>
                  <span className={`block text-[20px] font-semibold ${on ? '' : 'text-muted'}`}>{c.city}</span>
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

      <BottomSheet>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[22px] font-bold tracking-[-0.4px]">
              {count} résultat{count > 1 ? 's' : ''}
            </div>
            <div className="p">
              {label} · {useGps ? `${radius} km` : 'quartier'}
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
