/** Petite carte OpenStreetMap (Leaflet) : un point et le cercle de son rayon — page Localisation. */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function MiniMap({ lat, lng, radiusKm, label, className = '' }: { lat: number; lng: number; radiusKm: number; label?: string; className?: string }) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([lat, lng], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-tiles' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const circle = L.circle([lat, lng], { radius: radiusKm * 1000, color: '#c4c7ca', dashArray: '6 6', weight: 1.5, fillColor: '#111214', fillOpacity: 0.05 }).addTo(g);
    L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 4, fillColor: '#111214', fillOpacity: 1 }).addTo(g);
    m.fitBounds(circle.getBounds(), { padding: [12, 12], animate: false });
  }, [lat, lng, radiusKm]);

  return (
    <div className={`relative overflow-hidden rounded-[1.25rem] border border-line bg-fill ${className}`}>
      <style>{`.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}.leaflet-container{background:#eaecee}`}</style>
      <div ref={el} className="absolute inset-0" aria-label="Carte de la zone" />
      {label && <span className="pointer-events-none absolute bottom-3 left-4 z-[400] rounded-full bg-surface px-3 py-1.5 text-[0.8125rem] font-semibold shadow-card">{label}</span>}
    </div>
  );
}
