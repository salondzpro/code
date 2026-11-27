/**
 * Petite carte OpenStreetMap (Leaflet) : un point et le cercle de son rayon — page Localisation et
 * page d'un salon. Leaflet (≈ 460 ko) est chargé À LA DEMANDE (27 nov. 2026) : importé ici
 * directement, il partait dans le premier chargement de TOUS les visiteurs, carte affichée ou non.
 */
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { POSITION, RAYON } from '@/lib/mapColors';
import { t } from '@/i18n';

type LeafletModule = typeof Leaflet;
let charge: Promise<LeafletModule> | null = null;
const leaflet = () =>
  (charge ??= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => ((m as { default?: LeafletModule }).default ?? m) as LeafletModule));

export function MiniMap({ lat, lng, radiusKm, label, className = '' }: { lat: number; lng: number; radiusKm: number; label?: string; className?: string }) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const [L, setL] = useState<LeafletModule | null>(null);
  useEffect(() => {
    let vivant = true;
    void leaflet().then((m) => vivant && setL(() => m)).catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (!L || !el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([lat, lng], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-tiles' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!L || !m || !g) return;
    g.clearLayers();
    const circle = L.circle([lat, lng], { radius: radiusKm * 1000, ...RAYON, interactive: false }).addTo(g);
    L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 4, fillColor: POSITION, fillOpacity: 1 }).addTo(g);
    m.fitBounds(circle.getBounds(), { padding: [12, 12], animate: false });
  }, [L, lat, lng, radiusKm]);

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-fill ${className}`}>
      <style>{`.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}.leaflet-container{background:#e9e9ef}`}</style>
      <div ref={el} className="absolute inset-0" aria-label={t("Carte de la zone")} />
      {label && <span className="pointer-events-none absolute bottom-3 start-4 z-[400] rounded-full bg-surface px-3 py-1.5 text-[0.857rem] font-semibold shadow-card">{label}</span>}
    </div>
  );
}
