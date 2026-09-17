/**
 * Choix d'une position sur une vraie carte (OpenStreetMap) : l'épingle reste au centre, on déplace la
 * carte dessous ; « Ma position » recentre sur le GPS du téléphone. À chaque arrêt, la position est
 * renvoyée avec un libellé lisible (« Hydra, Alger ») obtenu par géocodage inverse.
 * Utilisé par l'adresse du salon (inscription pro et réglages).
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';
import { reverseGeocode } from '@salondz/constants';
import { I } from '@/components/ui';
import { t } from '@/i18n';

export interface LatLng {
  lat: number;
  lng: number;
}
const ALGIERS: LatLng = { lat: 36.7538, lng: 3.0588 };

export function PlacePicker({
  value,
  onChange,
  autoLocate,
  className = '',
}: {
  value: LatLng | null;
  /** Position choisie et, quand il est connu, son libellé (quartier, ville). */
  onChange: (pos: LatLng, place: { label: string; region: string | null; inDZ: boolean } | null) => void;
  /** Au premier affichage sans position connue : demander le GPS tout de suite. */
  autoLocate?: boolean;
  className?: string;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [label, setLabel] = useState<string | null>(null);
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied'>('idle');

  // Carte créée une fois ; chaque arrêt de déplacement = nouvelle position.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const start = value ?? ALGIERS;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], value ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    let ctrl: AbortController | null = null;
    map.on('moveend', () => {
      const c = map.getCenter();
      const pos = { lat: Number(c.lat.toFixed(5)), lng: Number(c.lng.toFixed(5)) };
      ctrl?.abort();
      ctrl = new AbortController();
      onChangeRef.current(pos, null);
      void reverseGeocode(pos.lat, pos.lng, ctrl.signal).then((r) => {
        if (!r) return;
        setLabel(r.label);
        onChangeRef.current(pos, r);
      });
    });
    mapRef.current = map;
    return () => {
      ctrl?.abort();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position imposée de l'extérieur (adresse choisie dans la recherche) : on recentre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - value.lat) > 1e-4 || Math.abs(c.lng - value.lng) > 1e-4) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoLocate && !value) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    if (!('geolocation' in navigator)) return setGeo('denied');
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo('idle');
        mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 17, { animate: true });
      },
      () => setGeo('denied'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className={`relative isolate z-0 h-[15rem] overflow-hidden rounded-[var(--radius-card)] border border-line bg-fill ${className}`}>
      <style>{`.leaflet-container{background:#eaecee;font-family:inherit}`}</style>
      <div ref={mapEl} className="absolute inset-0" aria-label={t("Carte")} />
      {/* Épingle fixe au centre : la carte bouge dessous. */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 z-[400] flex h-11 w-11 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full bg-ink text-white shadow-fab">
        <I icon={MapPin} size={22} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-1/2 z-[400] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white" />
      <button
        type="button"
        className="absolute bottom-3 end-3 z-[400] flex items-center gap-1.5 rounded-[var(--radius-btn)] bg-surface px-3 py-2 text-[0.857rem] font-semibold shadow-card"
        onClick={locate}
        disabled={geo === 'asking'}
      >
        <I icon={LocateFixed} size={16} /> {geo === 'asking' ? t('Recherche…') : t('Ma position')}
      </button>
      {(label || geo === 'denied') && (
        <span className={`absolute bottom-3 start-3 z-[400] max-w-[60%] truncate rounded-full px-3 py-1.5 text-[0.857rem] font-semibold shadow-card ${geo === 'denied' ? 'bg-danger/10 text-danger' : 'bg-surface'}`}>
          {geo === 'denied' ? t('Localisation refusée') : label}
        </span>
      )}
    </div>
  );
}
