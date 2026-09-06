/**
 * C-H 04 — Résultats sur la carte : bulles de prix (prix de départ), cercle du rayon,
 * feuille basse avec la carte du salon sélectionné. Fond de carte gris clair (CARTO Positron).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Search, SlidersHorizontal } from 'lucide-react';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, formatDA, type CategoryId } from '@salondz/constants';
import { formatKm, useLocationPrefs } from '@/lib/clientPrefs';
import { BottomNav } from '@/components/AppFrame';
import { I, IconButton, Img, Pill } from '@/components/ui';
import { RatingPill, SlotPills } from '@/components/SalonListCard';
import type { SalonSummary } from '@salondz/types';

const ALGIERS: [number, number] = [36.7538, 3.0588];

export function MapView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const category = params.get('category') ?? '';
  const [selected, setSelected] = useState<string | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const query = useSalonSearch({ gender: market, category: category ? (category as CategoryId) : undefined, city: prefs.city ?? undefined, wilaya: prefs.city ? undefined : prefs.wilaya, lat: prefs.lat ?? undefined, lng: prefs.lng ?? undefined, radiusKm: prefs.lat != null ? prefs.radiusKm : undefined, limit: 50 });
  const items = useMemo(() => (query.data?.items ?? []) as (SalonSummary & { lat?: number | null; lng?: number | null })[], [query.data]);
  const current = items.find((s) => s.id === selected) ?? items[0] ?? null;

  // Carte
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] = prefs.lat != null ? [prefs.lat, prefs.lng!] : ALGIERS;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView(center, 13);
    // Tuiles OpenStreetMap (gratuites, sans clé) passées en gris clair pour retrouver le fond neutre du design.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19, className: 'map-tiles' }).addTo(map);
    if (prefs.lat != null) {
      L.circle(center, { radius: prefs.radiusKm * 1000, color: '#c4c7ca', dashArray: '6 6', weight: 1.5, fillColor: '#111214', fillOpacity: 0.04 }).addTo(map);
      L.circleMarker(center, { radius: 9, color: '#fff', weight: 4, fillColor: '#111214', fillOpacity: 1 }).addTo(map);
    }
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [prefs.lat, prefs.lng, prefs.radiusKm]);

  // Bulles de prix
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];
    for (const s of items) {
      const lat = (s as { lat?: number | null }).lat;
      const lng = (s as { lng?: number | null }).lng;
      if (lat == null || lng == null) continue;
      bounds.push([lat, lng]);
      const on = s.id === (current?.id ?? null);
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-bubble${on ? ' on' : ''}">${s.minPriceDa != null ? formatDA(s.minPriceDa) : s.name}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([lat, lng], { icon }).on('click', () => setSelected(s.id)).addTo(layer);
    }
    if (bounds.length > 1 && !prefs.lat) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [items, current?.id, prefs.lat]);

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id && id !== category) next.set('category', id);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  return (
    <div className="relative min-h-dvh">
      <style>{`.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}
.map-bubble{width:max-content;transform:translate(-50%,-100%);margin-top:-8px;background:#fff;color:#17181a;border-radius:999px;padding:8px 14px;font:600 16px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);position:relative}
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
              {MARKET_LABELS_FR[market]} · {prefs.label}
            </span>
          </Link>
          <IconButton lg className="!shadow-card" aria-label="Filtres" onClick={() => navigate('/localisation')}>
            <I icon={SlidersHorizontal} size={20} />
          </IconButton>
        </div>
        <div className="pills pointer-events-auto">
          <Pill lg on={!category} onClick={() => setCategory('')} className="!shadow-card">
            Sans préférence
          </Pill>
          {categoriesForMarket(market).map((c) => (
            <Pill key={c.id} lg on={category === c.id} onClick={() => setCategory(c.id)} className="!shadow-card">
              {c.labelFr}
            </Pill>
          ))}
        </div>
      </div>

      <button type="button" className="ib lg absolute bottom-[300px] right-5 z-[400] !shadow-card" aria-label="Recentrer" onClick={() => mapRef.current?.setView(prefs.lat != null ? [prefs.lat, prefs.lng!] : ALGIERS, 13)}>
        <I icon={LocateFixed} size={20} />
      </button>

      {/* Feuille : salon sélectionné */}
      <div className="sheet !bottom-[92px] !z-[400] !pb-4">
        {current ? (
          <Link to={`/s/${current.slug}`} className="crd sel !gap-3">
            <div className="flex items-start gap-3.5">
              <Img src={current.logoUrl ?? current.coverUrl} className="h-[96px] w-[96px] flex-none !rounded-[16px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[21px] font-bold leading-tight tracking-[-0.4px]">{current.name}</span>
                  {current.ratingCount > 0 && <RatingPill avg={current.ratingAvg} />}
                </div>
                <span className="mt-1 block text-[16px] text-muted">
                  {[current.zone ?? current.city, formatKm(current.distanceKm), current.isOpenNow ? 'ouvert' : null].filter(Boolean).join(' · ')}
                </span>
                <span className="mt-0.5 block text-[15px] text-subtle">{current.topServices.map((t) => `${t.name} ${formatDA(t.priceDa)}`).join(' · ')}</span>
              </div>
            </div>
            <SlotPills slots={current.nextSlots} />
          </Link>
        ) : (
          <p className="p py-2 text-center">{query.isPending ? 'Chargement…' : 'Aucun salon dans cette zone.'}</p>
        )}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            {items.slice(0, 6).map((s) => (
              <button key={s.id} type="button" onClick={() => setSelected(s.id)} className={`h-1.5 rounded-full ${s.id === current?.id ? 'w-6 bg-ink' : 'w-1.5 bg-line'}`} aria-label={s.name} />
            ))}
          </div>
        )}
      </div>
      <BottomNav kind="client" />
    </div>
  );
}
