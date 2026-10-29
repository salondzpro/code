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
import { Locate, LocateFixed, LocateOff } from 'lucide-react';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { formatDA, reverseGeocode, spreadOverlaps, type CategoryId } from '@salondz/constants';
import { formatKm, useLocationPrefs } from '@/lib/clientPrefs';
import { arrondir, positionPrecise } from '@/lib/position';
import { useAutoLocate } from '@/lib/useAutoLocate';
import { enCoque, ouvrirReglagesApplication } from '@/lib/pushSettings';
import { BottomNav } from '@/components/AppFrame';
import { I, Img } from '@/components/ui';
import { SearchField, SearchTools } from '@/components/SearchTools';
import { RatingPill, NextSlots } from '@/components/SalonListCard';
import type { SalonSummary } from '@salondz/types';
import { t } from '@/i18n';

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

const escHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function MapView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  // La carte n'est pas sous `ClientLayout` : la détection d'ouverture s'y monte aussi.
  useAutoLocate();
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
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  /** Position de l'appareil, suivie en continu : point bleu + halo de précision. */
  const [mePos, setMePos] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  /**
   * ÉTAT DE LA POSITION (29 oct. 2026), une seule source pour le point bleu et le bouton :
   *   - `pending` : on ne sait pas encore (première mesure en cours, ou permission pas encore demandée) ;
   *   - `on` : une mesure est là — le point bleu est posé sur elle ;
   *   - `denied` : refusée — aucun point, le bouton dit comment la rallumer ;
   *   - `unavailable` : pas de capteur, ou aucune mesure obtenue (intérieur, délai dépassé).
   */
  const [geo, setGeo] = useState<'pending' | 'on' | 'denied' | 'unavailable'>(() =>
    'geolocation' in navigator ? 'pending' : 'unavailable',
  );
  /** Message affiché près du bouton de position (jamais un toast : il est là où l'on a touché). */
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  /** Relance du suivi : retour au premier plan, permission rendue. */
  const [watchNonce, setWatchNonce] = useState(0);
  const programmatic = useRef(false);
  /** La personne a pris la carte en main : on ne la recentre plus sous son doigt. */
  const touchee = useRef(false);
  /** Le recentrage d'ouverture n'a lieu qu'une fois, à la première mesure. */
  const recentre = useRef(false);
  /** Arrêt du relevé précis déclenché par le bouton de position. */
  const arretPosition = useRef<(() => void) | null>(null);
  useEffect(() => () => arretPosition.current?.(), []);

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
      sort: prefs.sort,
      availableToday: prefs.availableToday || undefined,
      ratingMin: prefs.ratingMin ?? undefined,
      limit: 50,
    },
    !tooWide,
  );
  // « Ouvert maintenant » se filtre ici comme dans la liste : la touche Filtres annonce ce
  // filtre, une carte qui l'ignorerait montrerait des bulles que le compteur ne compte pas.
  const items = useMemo(
    () =>
      spreadOverlaps(
        (
          (query.data?.items ?? []) as (SalonSummary & {
            lat?: number | null;
            lng?: number | null;
          })[]
        ).filter(
          (s): s is SalonSummary & { lat: number; lng: number } =>
            s.lat != null && s.lng != null && (!prefs.openNow || s.isOpenNow),
        ),
      ),
    [query.data, prefs.openNow],
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
    // Plus de pastille noire au centre de la zone (29 oct. 2026) : elle suivait le centre de
    // l'écran à chaque zoom — on la prenait pour SA position, qui « bougeait » avec le zoom. La
    // zone se lit à son cercle ; la position, au seul point bleu, posé sur la mesure GPS.
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
    /**
     * Le point « vous êtes ici » a SON PROPRE CALQUE, au-dessus des tracés.
     *
     * Sans cela il disparaissait : la zone de recherche est redessinée à chaque déplacement, et
     * comme Leaflet empile ses tracés dans l'ordre de création, la pastille NOIRE du centre de la
     * zone se replaçait par-dessus le point bleu. Dès qu'on utilisait sa position — où les deux
     * points se superposent exactement — on ne voyait plus qu'un gros point noir.
     * 450 : au-dessus des tracés (400), en dessous des bulles de prix (600), qui doivent rester
     * lisibles et cliquables.
     */
    map.createPane('moi');
    const calqueMoi = map.getPane('moi');
    if (calqueMoi) {
      calqueMoi.style.zIndex = '450';
      calqueMoi.style.pointerEvents = 'none';
    }
    meLayerRef.current = L.layerGroup().addTo(map);
    // Une prise en main par la personne coupe tout recentrage automatique : un déplacement de carte
    // sous le doigt de quelqu'un qui explore un quartier est odieux.
    map.on('dragstart', () => {
      touchee.current = true;
    });
    // Zone par zone : chaque déplacement (même programmé) relance la recherche sur la zone visible, après 500 ms de calme.
    map.on('moveend', () => {
      // Déplacement PROGRAMMÉ (recentrage sur la personne, ajustement sur les résultats) : la zone
      // est déjà posée, avec le rayon choisi. La recalculer d'après l'écran l'écrasait — on
      // demandait 10 km, la carte se plaçait au zoom 14, et la recherche retombait à « 2,9 km ».
      if (programmatic.current) {
        programmatic.current = false;
        return;
      }
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

  /**
   * Position en TEMPS RÉEL : `watchPosition` pousse chaque nouvelle mesure, donc le point
   * bleu suit le déplacement sans qu'on redemande quoi que ce soit. La carte, elle, ne
   * bouge pas : recentrer sous le doigt de quelqu'un qui explore un quartier est odieux.
   * Refus ou absence de capteur : aucun point, et rien d'autre ne change.
   */
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    let premiere = true;
    // Sans mesure au bout de 25 s (intérieur, GPS froid) : « introuvable », pas « en attente » sans fin.
    const delai = window.setTimeout(() => setGeo((g) => (g === 'pending' ? 'unavailable' : g)), 25_000);
    const id = navigator.geolocation.watchPosition(
      (p) => {
        window.clearTimeout(delai);
        setMePos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? 0 });
        setGeo('on');
        if (premiere) setGeoMsg(null);
        premiere = false;
      },
      // Une mesure qui échoue n'EFFACE PAS la précédente : en ville, un relevé sur trois expire, et
      // le point bleu se mettait à clignoter puis à disparaître alors qu'on savait très bien où
      // l'on était. Seul un refus de permission fait vraiment tomber le point.
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          window.clearTimeout(delai);
          setMePos(null);
          setGeo('denied');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => {
      window.clearTimeout(delai);
      navigator.geolocation.clearWatch(id);
    };
  }, [watchNonce]);

  /**
   * Le suivi NE SURVIT PAS toujours à l'arrière-plan (onglet gelé, application mise de côté) : au
   * retour, on le relance — sinon le point bleu restait là où l'on était une heure plus tôt. Et
   * quand le navigateur sait dire l'état de la permission, on suit ses changements : rendue dans
   * les réglages, le point revient sans recharger ; retirée, il disparaît.
   */
  useEffect(() => {
    const auRetour = () => document.visibilityState === 'visible' && setWatchNonce((n) => n + 1);
    document.addEventListener('visibilitychange', auRetour);
    let statut: PermissionStatus | null = null;
    const suivre = () => {
      if (!statut) return;
      if (statut.state === 'denied') {
        setMePos(null);
        setGeo('denied');
      } else setWatchNonce((n) => n + 1);
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((st) => {
        statut = st;
        if (st.state === 'denied') setGeo('denied');
        st.addEventListener('change', suivre);
      })
      .catch(() => undefined);
    return () => {
      document.removeEventListener('visibilitychange', auRetour);
      statut?.removeEventListener('change', suivre);
    };
  }, []);

  /**
   * OUVERTURE : on se place là où est la personne.
   *
   * La carte démarrait sur Alger dès qu'aucun lieu n'avait encore été choisi — donc quelqu'un à
   * Akbou ouvrait la carte sur une ville à 200 km, son point bleu hors de l'écran, et devait
   * trouver le bouton de position pour voir son propre quartier. On recentre UNE fois, à la
   * première mesure, et jamais si un lieu a été choisi ou si la carte a déjà été prise en main.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mePos || recentre.current) return;
    // Un lieu choisi, ou une carte déjà prise en main, l'emportent sur le capteur. On ne pose pas
    // le drapeau dans ce cas : il dit « la carte est sur la personne », et il sert à savoir si
    // l'ajustement sur les résultats a encore le droit de la déplacer.
    if (touchee.current || prefs.lat != null || prefs.city) return;
    recentre.current = true;
    // On pose AUSSI la zone de recherche, et pas seulement la vue. Sans lieu connu, la recherche
    // retombe sur la wilaya d'Alger, et l'ajustement automatique sur les résultats ramenait la
    // carte à Alger une seconde après l'avoir centrée sur la personne. Cherchant autour d'elle,
    // les résultats sont les siens — et il n'y a plus rien à ramener ailleurs.
    const a = { lat: Number(mePos.lat.toFixed(4)), lng: Number(mePos.lng.toFixed(4)), radiusKm: prefs.radiusKm };
    setArea(a);
    programmatic.current = true;
    map.setView([a.lat, a.lng], 14, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mePos]);

  /**
   * LE LIEU CHANGE AILLEURS (29 oct. 2026) : détection automatique à l'ouverture (`useAutoLocate`),
   * ville choisie dans la recherche. La carte ne lisait le lieu qu'à sa création : le champ disait
   * « Akbou » pendant que la carte restait sur Alger, le point bleu hors de l'écran. On suit donc
   * chaque NOUVEAU lieu — sauf s'il est déjà celui de la zone (le bouton de position pose les deux).
   */
  const lieuVu = useRef<string | null>(prefs.lat != null ? `${prefs.lat},${prefs.lng}` : null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prefs.lat == null || prefs.lng == null) return;
    const cle = `${prefs.lat},${prefs.lng}`;
    if (cle === lieuVu.current) return;
    lieuVu.current = cle;
    if (area && Math.abs(area.lat - prefs.lat) < 0.0005 && Math.abs(area.lng - prefs.lng) < 0.0005) return;
    recentre.current = true;
    setArea({ lat: prefs.lat, lng: prefs.lng, radiusKm: prefs.radiusKm });
    setSelected(null);
    programmatic.current = true;
    map.setView([prefs.lat, prefs.lng], 14, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.lat, prefs.lng]);

  useEffect(() => {
    const layer = meLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // LIEU CHOISI À LA MAIN (une ville, une adresse) : une épingle FIXE, nommée, qui ne se confond
    // pas avec le point bleu. Elle ne s'affiche pas quand elle tombe sur la position elle-même.
    const lieu = prefs.lat != null && prefs.lng != null ? { lat: prefs.lat, lng: prefs.lng } : null;
    const lieuSurMoi = !!lieu && !!mePos && Math.abs(lieu.lat - mePos.lat) < 0.001 && Math.abs(lieu.lng - mePos.lng) < 0.001;
    if (lieu && !lieuSurMoi && prefs.label && prefs.label !== t('Ma position')) {
      L.marker([lieu.lat, lieu.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="map-place"><span class="map-place-d"></span>${escHtml(prefs.label)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
        pane: 'moi',
        keyboard: false,
      }).addTo(layer);
    }
    if (!mePos) return;
    // Halo = précision réelle du relevé, borné : par mauvaise réception il couvrirait la ville.
    if (mePos.acc > 0)
      L.circle([mePos.lat, mePos.lng], {
        radius: Math.min(mePos.acc, 150),
        stroke: false,
        fillColor: '#1a73e8',
        fillOpacity: 0.12,
        interactive: false,
        pane: 'moi',
      }).addTo(layer);
    L.circleMarker([mePos.lat, mePos.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1a73e8',
      fillOpacity: 1,
      interactive: false,
      pane: 'moi',
    }).addTo(layer);
  }, [mePos, prefs.lat, prefs.lng, prefs.label]);

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
        // Le nom vient d'un professionnel : toujours échappé avant d'entrer dans du HTML.
        html: `<button type="button" class="map-bubble${on ? ' on' : ''}" aria-label="${escHtml(s.name)}">${s.minPriceDa != null ? formatDA(s.minPriceDa) : escHtml(s.name)}</button>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([s.drawLat, s.drawLng], { icon, zIndexOffset: on ? 1000 : 0 })
        .on('click', () => setSelected(s.id))
        .addTo(layer);
    }
    // Ajustement sur les résultats : seulement tant qu'on n'a pas placé la carte sur la personne.
    // `area` ne suffit pas à l'empêcher — il est posé dans le même tour de rendu que le recentrage,
    // et les résultats de la démonstration arrivent en 80 ms, avant que React n'ait rendu.
    if (bounds.length > 1 && !area && !recentre.current) {
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
    if (el && idx >= 0 && Math.round(Math.abs(el.scrollLeft) / el.clientWidth) !== idx)
      el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  }, [selected, current, items]);

  // Glissement des fiches → salon sélectionné
  const onCardsScroll = () => {
    if (cardSettle.current) window.clearTimeout(cardSettle.current);
    cardSettle.current = window.setTimeout(() => {
      const el = cardsRef.current;
      if (!el || !el.clientWidth) return;
      const s = items[Math.round(Math.abs(el.scrollLeft) / el.clientWidth)];
      if (s && s.id !== current?.id) setSelected(s.id);
    }, 90);
  };

  /** Recentre sur soi et cherche autour : le point bleu dit déjà où l'on est. */
  const locate = () => {
    setGeoMsg(null);
    if (!('geolocation' in navigator)) {
      setGeoMsg(t('Cet appareil ne donne pas sa position. Choisissez une ville dans la recherche.'));
      return;
    }
    // Refusée : une demande ne s'afficherait plus. Dans l'application, on ouvre ses réglages ;
    // ailleurs, on dit où aller. La carte reste utilisable avec une ville choisie.
    if (geo === 'denied') {
      if (enCoque()) void ouvrirReglagesApplication();
      setGeoMsg(
        enCoque()
          ? t('Position désactivée pour Salon DZ : autorisez « Position » dans l’écran qui s’ouvre, puis revenez.')
          : t('Position bloquée pour ce site : autorisez-la avec l’icône à gauche de l’adresse, puis rechargez la page.'),
      );
      return;
    }
    const goTo = (lat: number, lng: number) => {
      const a = { lat: arrondir(lat), lng: arrondir(lng), radiusKm: prefs.radiusKm };
      setArea(a);
      setPrefs({ lat: a.lat, lng: a.lng, city: null, label: t("Ma position") });
      void reverseGeocode(a.lat, a.lng).then((r) => r && setPrefs({ label: r.label }));
      setSelected(null);
      setLocating(false);
      programmatic.current = true;
      mapRef.current?.setView([a.lat, a.lng], 14, { animate: true });
    };
    // Le suivi continu tient déjà une mesure fraîche : s'en resservir évite d'attendre
    // plusieurs secondes un relevé que l'on a sous les yeux.
    if (mePos) {
      goTo(mePos.lat, mePos.lng);
      return;
    }
    setLocating(true);
    // Vrai GPS, sans relevé en cache, affiné au fil des mesures : la position réseau d'Android
    // tombe couramment à plusieurs kilomètres en Algérie, et un cache de cinq minutes pouvait
    // ramener l'endroit où l'on était avant de partir.
    arretPosition.current?.();
    arretPosition.current = positionPrecise(
      (m) => goTo(m.lat, m.lng),
      () => {
        setLocating(false);
        // Sans mesure, on ne bouge PAS la carte : la ramener ailleurs sans rien dire laissait croire
        // que l'on avait été localisé. On le dit, là où l'on a touché.
        setGeoMsg(t('Position introuvable pour l’instant (intérieur, signal faible). Réessayez, ou choisissez une ville.'));
      },
    );
  };

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id && id !== category) next.set('category', id);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  // Compté sur les bulles réellement posées, filtre « ouvert » compris.
  const total = prefs.openNow ? items.length : (query.data?.total ?? 0);
  const noun = market === 'men' ? 'barbier' : 'salon';

  return (
    <div className="relative h-app">
      <style>{`.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}
.map-bubble{width:max-content;transform:translate(-50%,-100%);margin-top:-8px;background:#fff;color:#17181a;border:0;border-radius:999px;padding:0.5rem 0.875rem;font:600 1rem/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);position:relative;cursor:pointer}
.map-bubble.on{background:#111214;color:#fff}
.map-bubble::after{content:'';position:absolute;left:50%;bottom:-9px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #e6e7e9;transform:translateX(-50%)}
.map-bubble.on::after{background:#111214;border-color:#111214}
.leaflet-container{background:#eaecee;font-family:inherit}
.map-place{display:inline-flex;align-items:center;gap:6px;width:max-content;transform:translate(-11px,-50%);padding:3px 8px 3px 3px;border-radius:999px;background:#fff;border:1px solid #e6e7e9;font:600 12px/1.2 Inter,system-ui,sans-serif;color:#17181a;white-space:nowrap}
.map-place-d{width:10px;height:10px;border-radius:50%;background:#111214;border:2px solid #fff;outline:1px solid #111214}
[dir=rtl] .map-place{transform:translate(calc(-100% + 11px),-50%);padding:3px 3px 3px 8px}`}</style>
      <div ref={mapEl} className="absolute inset-0" aria-label={t("Carte des salons")} />

      {/* Recherche et outils : les mêmes trois touches que la liste, la deuxième ramenant
          à la liste. Le tri est absent : sur une carte, il n'y a pas de premier résultat. */}
      <div className="pointer-events-none absolute start-0 end-0 top-0 z-[400] flex flex-col gap-2 px-5 pt-3">
        <SearchField
          shadow
          className="pointer-events-auto"
          market={market}
          q=""
          place={area && area.lat !== prefs.lat ? 'zone de la carte' : prefs.label}
          radiusKm={area?.radiusKm ?? prefs.radiusKm}
          wilaya={prefs.wilaya}
          // Chercher un nom depuis la carte ramène à la liste : c'est là que les noms se lisent.
          onQuery={(v) => navigate(v ? `/?q=${encodeURIComponent(v)}` : '/')}
        />
        <SearchTools
          className="pointer-events-auto sh"
          market={market}
          category={category}
          onCategory={setCategory}
          view="map"
          onView={() => navigate(`/${category ? `?category=${category}` : ''}`)}
        />
        <div className="pointer-events-auto flex items-center justify-center gap-2">
          <span
            className="rounded-full bg-surface px-3 py-1.5 text-[0.857rem] font-medium text-muted shadow-card"
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

      {/* Bouton de position : son icône dit l'état — suivie (point plein), refusée (barrée), en attente. */}
      <div className="absolute bottom-[15.5rem] end-5 z-[400] flex flex-col items-end gap-2">
        {geoMsg && (
          <p
            className="max-w-[min(17rem,calc(100vw-2.5rem))] rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-[0.857rem] leading-snug text-text"
            role="status"
          >
            {geoMsg}
          </p>
        )}
        <button
          type="button"
          className={`ib lg ${geo === 'denied' ? 'text-muted' : geo === 'on' ? 'text-[#1a73e8]' : ''}`}
          aria-label={geo === 'denied' ? t('Position désactivée') : t('Ma position')}
          onClick={locate}
          disabled={locating}
        >
          <I
            icon={geo === 'denied' ? LocateOff : geo === 'on' ? LocateFixed : Locate}
            size={20}
            className={locating ? 'animate-pulse' : ''}
          />
        </button>
      </div>

      {/* Feuille : fiches glissables (une par salon), synchronisées avec les bulles */}
      <div className="sheet !bottom-[4.75rem] !z-[400] !gap-2 !pb-3 !pt-2">
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
            aria-label={t("Glisser pour voir les autres salons")}
          >
            {items.map((s) => (
              <div
                key={s.id}
                className="w-full flex-none px-5"
                style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
              >
                {/* Fiche volontairement basse : sur une carte, ce qu'on veut voir d'abord,
                    c'est le plan. Le nom, le lieu et le prochain créneau suffisent à choisir ;
                    les prestations et les prix se lisent sur la fiche du salon. */}
                <Link
                  to={`/s/${s.slug}`}
                  className={`crd !gap-2 !p-3 ${s.id === current?.id ? 'sel' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Img
                      src={s.logoUrl ?? s.coverUrl}
                      className="h-[3.25rem] w-[3.25rem] flex-none !rounded-[var(--radius-card-sm)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[1.143rem] font-bold leading-tight tracking-[-0.4px]">
                          {s.name}
                        </span>
                        {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
                      </div>
                      <span className="mt-0.5 block truncate text-[0.857rem] text-muted">
                        {[s.zone ?? s.city, formatKm(s.distanceKm), s.isOpenNow ? 'ouvert' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                  <NextSlots salon={s} compact />
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
