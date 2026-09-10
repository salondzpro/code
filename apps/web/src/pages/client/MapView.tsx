/**
 * C-H 04 — Résultats sur la carte : bulles de prix (prix de départ), cercle du rayon,
 * feuille basse avec la carte du salon sélectionné. Fond de carte gris clair (OpenStreetMap).
 *
 * Interactive : déplacer la carte propose « Rechercher dans cette zone » (centre + rayon déduits de
 * l'emprise visible), le bouton de position utilise la géolocalisation réelle, une bulle touchée
 * sélectionne le salon (et inversement), le compteur suit les résultats de la zone.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search, SlidersHorizontal } from 'lucide-react';
import { useMe, useSalonSearch } from '@salondz/api-client';
import {
  MARKET_LABELS_FR,
  categoriesForMarket,
  formatDA,
  reverseGeocode,
  spreadOverlaps,
  type CategoryId,
} from '@salondz/constants';
import { formatKm, useLocationPrefs } from '@/lib/clientPrefs';
import { BottomNav } from '@/components/AppFrame';
import { I, IconButton, Img, Pill } from '@/components/ui';
import { RatingPill, NextSlots } from '@/components/SalonListCard';
import type { SalonSummary } from '@salondz/types';

const ALGIERS: [number, number] = [36.7538, 3.0588];
type Area = { lat: number; lng: number; radiusKm: number };
/** Au-delà de ce rayon (carte trop dézoomée), on n'interroge pas le serveur : « Zoomez pour voir les professionnels ». */
const MAX_ZONE_KM = 20;

/** Rayon (km) couvrant l'emprise visible : moitié de la plus petite dimension, borné 1–50 km. */
function areaOf(map: L.Map): Area {
  const b = map.getBounds();
  const c = b.getCenter();
  const h =
    b.getNorthEast().distanceTo(L.latLng(b.getSouthWest().lat, b.getNorthEast().lng)) / 1000;
  const w =
    b.getNorthEast().distanceTo(L.latLng(b.getNorthEast().lat, b.getSouthWest().lng)) / 1000;
  return {
    lat: Number(c.lat.toFixed(4)),
    lng: Number(c.lng.toFixed(4)),
    radiusKm: Math.min(MAX_ZONE_KM + 1, Math.max(1, Number((Math.min(h, w) / 2).toFixed(1)))),
  };
}

export function MapView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const category = params.get('category') ?? '';
  const [selected, setSelected] = useState<string | null>(null);
  /** Zone recherchée : celle des préférences, ou celle choisie en déplaçant la carte. */
  const [area, setArea] = useState<Area | null>(
    prefs.lat != null ? { lat: prefs.lat, lng: prefs.lng!, radiusKm: prefs.radiusKm } : null,
  );
  const moveTimer = useRef<number | null>(null);
  const [locating, setLocating] = useState(false);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const programmatic = useRef(false);

  const tooWide = !!area && area.radiusKm > MAX_ZONE_KM;
  const query = useSalonSearch(
    {
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
    },
    !tooWide,
  );
  const items = useMemo(
    () =>
      spreadOverlaps(
        (
          (query.data?.items ?? []) as (SalonSummary & {
            lat?: number | null;
            lng?: number | null;
          })[]
        ).filter(
          (s): s is SalonSummary & { lat: number; lng: number } => s.lat != null && s.lng != null,
        ),
      ),
    [query.data],
  );
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const cardSettle = useRef<number | null>(null);
  const current = items.find((s) => s.id === selected) ?? items[0] ?? null;

  const drawArea = useCallback((a: Area | null) => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!a) return;
    L.circle([a.lat, a.lng], {
      radius: a.radiusKm * 1000,
      color: '#c4c7ca',
      dashArray: '6 6',
      weight: 1.5,
      fillColor: '#111214',
      fillOpacity: 0.04,
    }).addTo(layer);
    L.circleMarker([a.lat, a.lng], {
      radius: 9,
      color: '#fff',
      weight: 4,
      fillColor: '#111214',
      fillOpacity: 1,
    }).addTo(layer);
  }, []);

  // Carte (créée une fois)
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] = area ? [area.lat, area.lng] : ALGIERS;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView(
      center,
      13,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      className: 'map-tiles',
    }).addTo(map);
    areaLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // Zone par zone : chaque déplacement (même programmé) relance la recherche sur la zone visible, après 500 ms de calme.
    map.on('moveend', () => {
      programmatic.current = false;
      if (moveTimer.current) window.clearTimeout(moveTimer.current);
      moveTimer.current = window.setTimeout(() => {
        setArea(areaOf(map));
        setSelected(null);
      }, 500);
    });
    mapRef.current = map;
    drawArea(area);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => drawArea(area), [area, drawArea]);

  // Bulles de prix
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];
    for (const s of items) {
      bounds.push([s.drawLat, s.drawLng]);
      const on = s.id === (current?.id ?? null);
      const icon = L.divIcon({
        className: '',
        html: `<button type="button" class="map-bubble${on ? ' on' : ''}" aria-label="${s.name.replace(/"/g, '&quot;')}">${s.minPriceDa != null ? formatDA(s.minPriceDa) : s.name}</button>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([s.drawLat, s.drawLng], { icon, zIndexOffset: on ? 1000 : 0 })
        .on('click', () => setSelected(s.id))
        .addTo(layer);
    }
    if (bounds.length > 1 && !area) {
      programmatic.current = true;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [items, current?.id, area]);

  // Sélection (bulle ou fiche) → recentre doucement sur la bulle et fait défiler la fiche correspondante
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;
    if (selected && !map.getBounds().pad(-0.2).contains([current.drawLat, current.drawLng])) {
      programmatic.current = true;
      map.panTo([current.drawLat, current.drawLng], { animate: true });
    }
    const el = cardsRef.current;
    const idx = items.findIndex((s) => s.id === current.id);
    if (el && idx >= 0 && Math.round(el.scrollLeft / el.clientWidth) !== idx)
      el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  }, [selected, current, items]);

  // Glissement des fiches → salon sélectionné
  const onCardsScroll = () => {
    if (cardSettle.current) window.clearTimeout(cardSettle.current);
    cardSettle.current = window.setTimeout(() => {
      const el = cardsRef.current;
      if (!el || !el.clientWidth) return;
      const s = items[Math.round(el.scrollLeft / el.clientWidth)];
      if (s && s.id !== current?.id) setSelected(s.id);
    }, 90);
  };

  const locate = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const a = {
          lat: Number(p.coords.latitude.toFixed(4)),
          lng: Number(p.coords.longitude.toFixed(4)),
          radiusKm: prefs.radiusKm,
        };
        setArea(a);
        setPrefs({ lat: a.lat, lng: a.lng, city: null, label: 'Ma position' });
        void reverseGeocode(a.lat, a.lng).then((r) => r && setPrefs({ label: r.label }));
        setSelected(null);
        setLocating(false);
        programmatic.current = true;
        mapRef.current?.setView([a.lat, a.lng], 14, { animate: true });
      },
      () => {
        setLocating(false);
        programmatic.current = true;
        mapRef.current?.setView(area ? [area.lat, area.lng] : ALGIERS, 13, { animate: true });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id && id !== category) next.set('category', id);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  const total = query.data?.total ?? 0;
  const noun = market === 'men' ? 'barbier' : 'salon';

  return (
    <div className="relative min-h-dvh">
      <style>{`.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}
.map-bubble{width:max-content;transform:translate(-50%,-100%);margin-top:-8px;background:#fff;color:#17181a;border:0;border-radius:999px;padding:0.5rem 0.875rem;font:600 1rem/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);position:relative;cursor:pointer}
.map-bubble.on{background:#111214;color:#fff}
.map-bubble::after{content:'';position:absolute;left:50%;bottom:-9px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #e6e7e9;transform:translateX(-50%)}
.map-bubble.on::after{background:#111214;border-color:#111214}
.leaflet-container{background:#eaecee;font-family:inherit}`}</style>
      <div ref={mapEl} className="absolute inset-0" aria-label="Carte des salons" />

      {/* Barre de recherche + filtres */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[400] flex flex-col gap-3 px-5 pt-4">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <Link to="/recherche" className="search flex-1 !bg-surface !shadow-card">
            <I icon={Search} size={22} />
            <span className="flex-1 truncate text-subtle">
              {MARKET_LABELS_FR[market]} ·{' '}
              {area && area.lat !== prefs.lat ? 'zone de la carte' : prefs.label}
            </span>
          </Link>
          <IconButton
            lg
            className="!shadow-card"
            aria-label="Localisation et rayon"
            onClick={() => navigate('/localisation')}
          >
            <I icon={SlidersHorizontal} size={20} />
          </IconButton>
        </div>
        <div className="pills pointer-events-auto">
          <Pill lg on={!category} onClick={() => setCategory('')} className="!shadow-card">
            Sans préférence
          </Pill>
          {categoriesForMarket(market).map((c) => (
            <Pill
              key={c.id}
              lg
              on={category === c.id}
              onClick={() => setCategory(c.id)}
              className="!shadow-card"
            >
              {c.labelFr}
            </Pill>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center justify-center gap-2">
          <span
            className="rounded-full bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-muted shadow-card"
            aria-live="polite"
          >
            {tooWide
              ? 'Zoomez pour voir les professionnels'
              : query.isFetching
                ? 'Recherche…'
                : `${total} ${noun}${total > 1 ? 's' : ''} dans cette zone`}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="ib lg absolute bottom-[15.5rem] right-5 z-[400] !shadow-card"
        aria-label="Ma position"
        onClick={locate}
        disabled={locating}
      >
        <I icon={LocateFixed} size={20} className={locating ? 'animate-pulse' : ''} />
      </button>

      {/* Feuille : fiches glissables (une par salon), synchronisées avec les bulles */}
      <div className="sheet !bottom-[4.75rem] !z-[400] !pb-4">
        {items.length === 0 ? (
          <p className="p py-2 text-center">
            {tooWide
              ? 'Zoomez sur un quartier pour voir les professionnels.'
              : query.isPending
                ? 'Chargement…'
                : 'Aucun salon dans cette zone. Déplacez la carte : la recherche suit la zone visible.'}
          </p>
        ) : (
          <div
            ref={cardsRef}
            onScroll={onCardsScroll}
            className="-mx-5 flex overflow-x-auto"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
            aria-label="Glisser pour voir les autres salons"
          >
            {items.map((s) => (
              <div
                key={s.id}
                className="w-full flex-none px-5"
                style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
              >
                <Link
                  to={`/s/${s.slug}`}
                  className={`crd !gap-3 ${s.id === current?.id ? 'sel' : ''}`}
                >
                  <div className="flex items-start gap-3.5">
                    <Img
                      src={s.logoUrl ?? s.coverUrl}
                      className="h-[6rem] w-[6rem] flex-none !rounded-[1rem]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[1.0625rem] font-bold leading-tight tracking-[-0.4px]">
                          {s.name}
                        </span>
                        {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
                      </div>
                      <span className="mt-1 block text-[0.8125rem] text-muted">
                        {[s.zone ?? s.city, formatKm(s.distanceKm), s.isOpenNow ? 'ouvert' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="mt-0.5 block text-[0.9375rem] text-subtle">
                        {s.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <NextSlots salon={s} />
                </Link>
              </div>
            ))}
          </div>
        )}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="s">
              {(items.findIndex((s) => s.id === current?.id) ?? 0) + 1} / {items.length}
            </span>
            {items.slice(0, 8).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                className={`h-1.5 rounded-full ${s.id === current?.id ? 'w-6 bg-ink' : 'w-1.5 bg-line'}`}
                aria-label={s.name}
              />
            ))}
          </div>
        )}
      </div>
      <BottomNav kind="client" />
    </div>
  );
}
