/**
 * Position automatique à l'ouverture de l'application (client).
 *
 * La marketplace se filtre sur la position de l'appareil dès que le client ouvre l'application, sans
 * qu'il ait à toucher « Autour de moi ». Trois règles, et elles sont voulues :
 *
 *   • PREMIER PLAN SEULEMENT. La position est lue quand l'application est ouverte, jamais quand elle
 *     est fermée : pas de permission « en arrière-plan » (Google la soumet à une revue spéciale avec
 *     vidéo, Apple à une justification, et rien ici n'en a besoin) ;
 *   • DEMANDÉE AU BON MOMENT. Un court écran explique pourquoi avant la fenêtre du système, une seule
 *     fois. Un refus ne bloque rien : la personne choisit sa wilaya ou son quartier ;
 *   • JAMAIS CONTRE UN CHOIX. Quartier ou ville choisis à la main → `autoLocate` passe à false et la
 *     position n'y touche plus. Hors d'Algérie (diaspora, voyage), on ne filtre pas : « autour de
 *     vous » y serait une liste vide.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { hydratePrefs, readLocationPrefs, writeLocationPrefs } from './prefs';

/** Boîte englobante de l'Algérie (la même que celle du géocodage). */
const DZ = { minLat: 18.9, maxLat: 37.2, minLng: -8.7, maxLng: 12.0 };
const inAlgeria = (lat: number, lng: number) =>
  lat >= DZ.minLat && lat <= DZ.maxLat && lng >= DZ.minLng && lng <= DZ.maxLng;

/** Distance approchée en km (suffisante pour décider si la personne a bougé). */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * 111;
  const dLng = (bLng - aLng) * 111 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/** Une position, ou rien : le GPS peut être coupé ou lent, l'application ne doit jamais attendre après. */
async function readPosition(): Promise<{ lat: number; lng: number } | null> {
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  const fresh = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    new Promise<null>((ok) => setTimeout(() => ok(null), 8000)),
  ]);
  const p = fresh ?? last;
  if (!p) return null;
  return { lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)) };
}

/** Applique la position de l'appareil à la marketplace. `false` = rien de changé. */
async function applyCurrentPosition(): Promise<boolean> {
  const pos = await readPosition();
  if (!pos || !inAlgeria(pos.lat, pos.lng)) return false;
  const cur = readLocationPrefs();
  // Sous 300 m, on ne touche à rien : relancer la recherche pour si peu ferait sauter la liste.
  const moved = cur.lat == null || cur.lng == null || distanceKm(cur.lat, cur.lng, pos.lat, pos.lng) > 0.3;
  if (moved || cur.city) writeLocationPrefs({ lat: pos.lat, lng: pos.lng, city: null, label: 'Autour de vous' });
  return true;
}

/** Au retour au premier plan, on relit la position au plus une fois toutes les 10 minutes. */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * À monter sur la marketplace du client. Renvoie l'écran d'explication à montrer (ou non) et ses deux
 * réponses. Sur le web (Expo web, tests) rien ne se passe.
 */
export function useAutoLocation(): { prompt: boolean; accept: () => void; decline: () => void } {
  const [prompt, setPrompt] = useState(false);
  const lastRun = useRef(0);

  const refresh = useCallback(async () => {
    await hydratePrefs();
    if (readLocationPrefs().autoLocate === false) return;
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.granted) {
      lastRun.current = Date.now();
      await applyCurrentPosition();
    } else if (perm.canAskAgain && !readLocationPrefs().locationAsked) {
      setPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void refresh().catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastRun.current > REFRESH_MS) void refresh().catch(() => undefined);
    });
    return () => sub.remove();
  }, [refresh]);

  const accept = useCallback(() => {
    setPrompt(false);
    writeLocationPrefs({ locationAsked: true, autoLocate: true });
    void Location.requestForegroundPermissionsAsync()
      .then((perm) => (perm.granted ? applyCurrentPosition() : false))
      .catch(() => undefined);
  }, []);

  const decline = useCallback(() => {
    setPrompt(false);
    // Elle pourra toujours toucher « Autour de moi » : ce choix-là rallume la position automatique.
    writeLocationPrefs({ locationAsked: true, autoLocate: false });
  }, []);

  return { prompt, accept, decline };
}
