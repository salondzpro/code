/**
 * Choix d'une position sur une vraie carte (OpenStreetMap) : l'épingle reste au centre, on déplace la
 * carte dessous ; « Ma position » recentre sur le GPS du téléphone. À chaque arrêt, la position est
 * renvoyée avec un libellé lisible (« Hydra, Alger ») obtenu par géocodage inverse.
 * Utilisé par l'adresse du salon (inscription pro et réglages).
 *
 * 28 oct. 2026 :
 *   - `zone` : la carte se cadre sur la wilaya choisie (sauf si la position connue y est déjà) ;
 *   - chaque position dit d'où elle vient (`source`) : le doigt, le GPS, ou un déplacement fait par
 *     le programme (cadrage, adresse choisie). L'écran d'adresse s'en sert pour ne pas prendre le
 *     centre d'une wilaya pour l'emplacement du salon ;
 *   - `confirmed` : l'épingle passe au vert une fois l'emplacement confirmé.
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hand, LocateFixed, Minus, Plus } from 'lucide-react';
import { reverseGeocode, type GeoBBox } from '@salondz/constants';
import { positionPrecise } from '@/lib/position';
import { I } from '@/components/ui';
import { t } from '@/i18n';

export interface LatLng {
  lat: number;
  lng: number;
}
export type PlaceSource = 'user' | 'gps' | 'program';
export type ReversePlace = NonNullable<Awaited<ReturnType<typeof reverseGeocode>>>;

const ALGIERS: LatLng = { lat: 36.7538, lng: 3.0588 };
const inBox = (p: LatLng, b: GeoBBox) => p.lng >= b[0] && p.lat >= b[1] && p.lng <= b[2] && p.lat <= b[3];

export function PlacePicker({
  value,
  onChange,
  autoLocate,
  zone,
  confirmed,
  className = '',
}: {
  value: LatLng | null;
  /** Position choisie, son libellé quand il est connu (quartier, ville), et d'où elle vient. */
  onChange: (pos: LatLng, place: ReversePlace | null, source: PlaceSource) => void;
  /** Au premier affichage sans position connue : demander le GPS tout de suite. */
  autoLocate?: boolean;
  /** Rectangle de la wilaya choisie : la carte s'y cadre quand il change. */
  zone?: GeoBBox | null;
  /** Emplacement confirmé : l'épingle passe au vert. */
  confirmed?: boolean;
  className?: string;
}) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [label, setLabel] = useState<string | null>(null);
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied'>('idle');
  const [touched, setTouched] = useState(!!value);
  /** Origine du PROCHAIN arrêt de la carte : posée juste avant un déplacement programmé. */
  const origine = useRef<PlaceSource>('user');
  /** Le relevé s'arrête avec le composant : sinon le GPS resterait allumé après la sortie. */
  const arret = useRef<(() => void) | null>(null);
  useEffect(() => () => arret.current?.(), []);

  const moveTo = (fn: (m: L.Map) => void, source: PlaceSource) => {
    const map = mapRef.current;
    if (!map) return;
    origine.current = source;
    fn(map);
  };

  // Carte créée une fois ; chaque arrêt de déplacement = nouvelle position.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const start = value ?? ALGIERS;
    const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lng], value ? 17 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    let ctrl: AbortController | null = null;
    // Un geste du doigt : la position qui suit est celle de la personne, pas du programme.
    map.on('dragstart zoomstart', (e) => {
      if ((e as L.LeafletEvent & { originalEvent?: Event }).originalEvent || e.type === 'dragstart') origine.current = 'user';
    });
    map.on('dragstart', () => setTouched(true));
    map.on('moveend', () => {
      const c = map.getCenter();
      const pos = { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) };
      const source = origine.current;
      origine.current = 'user';
      ctrl?.abort();
      ctrl = new AbortController();
      onChangeRef.current(pos, null, source);
      void reverseGeocode(pos.lat, pos.lng, ctrl.signal).then((r) => {
        if (!r) return;
        setLabel(r.label);
        onChangeRef.current(pos, r, source);
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
    if (Math.abs(c.lat - value.lat) > 1e-5 || Math.abs(c.lng - value.lng) > 1e-5)
      moveTo((m) => m.setView([value.lat, value.lng], Math.max(m.getZoom(), 17), { animate: true }), 'program');
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wilaya choisie : on cadre sur elle, sauf si l'épingle y est déjà (on ne perd pas un emplacement).
  useEffect(() => {
    if (!zone || !mapRef.current) return;
    if (value && inBox(value, zone)) return;
    moveTo((m) => m.fitBounds([[zone[1], zone[0]], [zone[3], zone[2]]], { animate: true, padding: [12, 12] }), 'program');
  }, [zone?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoLocate && !value) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Position réelle, affinée (`lib/position.ts`). Un professionnel place ici la devanture de son
   * salon : une position réseau à trois rues de là lui ferait poser son épingle au mauvais endroit,
   * et ses clients chercheraient une boutique qui n'y est pas.
   */
  const locate = () => {
    setGeo('asking');
    arret.current?.();
    arret.current = positionPrecise(
      (m) => {
        setGeo('idle');
        setTouched(true);
        moveTo((map) => map.setView([m.lat, m.lng], 18, { animate: true }), 'gps');
      },
      () => setGeo('denied'),
      { precisionM: 30 },
    );
  };

  const zoom = (d: number) => moveTo((m) => m.setZoom(m.getZoom() + d), 'user');

  return (
    <div className={`ppk ${confirmed ? 'ok' : ''} ${className}`}>
      <style>{`.leaflet-container{background:#eaecee;font-family:inherit}`}</style>
      <div ref={mapEl} className="absolute inset-0" aria-label={t('Carte')} />
      {/* Épingle fixe au centre : la carte bouge dessous. La pointe touche le point exact. */}
      <span className="ppk-pin" aria-hidden>
        <svg viewBox="0 0 32 42" width="34" height="44">
          <path d="M16 41s13-14.2 13-24A13 13 0 0 0 3 17c0 9.8 13 24 13 24z" />
          <circle cx="16" cy="16.5" r="5" />
        </svg>
      </span>
      <span className="ppk-dot" aria-hidden />
      {!touched && (
        <span className="ppk-hint">
          <I icon={Hand} size={15} /> {t('Glissez la carte pour placer l’épingle')}
        </span>
      )}
      <div className="ppk-zoom">
        <button type="button" onClick={() => zoom(1)} aria-label={t('Zoomer')}>
          <I icon={Plus} size={18} />
        </button>
        <button type="button" onClick={() => zoom(-1)} aria-label={t('Dézoomer')}>
          <I icon={Minus} size={18} />
        </button>
      </div>
      <button type="button" className="ppk-gps" onClick={locate} disabled={geo === 'asking'}>
        <I icon={LocateFixed} size={16} /> {geo === 'asking' ? t('Recherche…') : t('Ma position')}
      </button>
      {(label || geo === 'denied') && (
        <span className={`ppk-label ${geo === 'denied' ? 'err' : ''}`}>{geo === 'denied' ? t('Localisation refusée') : label}</span>
      )}
    </div>
  );
}
