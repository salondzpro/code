/**
 * Préférences locales du client (design « Localisation et rayon », « Trier ») :
 * position/quartier, rayon, tri, recherches récentes. Mémoire + AsyncStorage.
 */
import { useCallback, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SortKey = 'relevance' | 'rating' | 'price_asc' | 'price_desc';
export const SORT_OPTIONS: { value: SortKey; label: string; hint: string }[] = [
  { value: 'relevance', label: 'Sans préférence', hint: 'Pertinence et disponibilité' },
  { value: 'rating', label: 'Mieux notés', hint: 'Note la plus élevée en premier' },
  { value: 'price_asc', label: 'Moins cher', hint: 'Prix de départ croissant' },
  { value: 'price_desc', label: 'Plus cher', hint: 'Prix de départ décroissant' },
];
export const RADIUS_OPTIONS = [1, 2, 5, 10] as const;

export interface LocationPrefs {
  /** Quartier/ville choisi (filtre `city`). */
  city: string | null;
  /** Wilaya du quartier (16 = Alger par défaut). */
  wilaya: number;
  /** Position de l'appareil si autorisée. */
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  /** Libellé affiché (« Alger-Centre », « Hydra, Alger »). */
  label: string;
  sort: SortKey;
}

const KEY = 'salondz:location';
const RECENT_KEY = 'salondz:recentSearches';
const DEFAULTS: LocationPrefs = { city: null, wilaya: 16, lat: null, lng: null, radiusKm: 5, label: 'Alger', sort: 'relevance' };

let prefs: LocationPrefs = DEFAULTS;
let recent: string[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** À appeler une fois au démarrage : relit les préférences persistées. */
export async function hydratePrefs(): Promise<void> {
  try {
    const [p, r] = await Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(RECENT_KEY)]);
    if (p) prefs = { ...DEFAULTS, ...(JSON.parse(p) as Partial<LocationPrefs>) };
    if (r) recent = JSON.parse(r) as string[];
    notify();
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
}

export function readLocationPrefs(): LocationPrefs {
  return prefs;
}
export function writeLocationPrefs(patch: Partial<LocationPrefs>): LocationPrefs {
  prefs = { ...prefs, ...patch };
  notify();
  void AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => undefined);
  return prefs;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function useLocationPrefs(): [LocationPrefs, (patch: Partial<LocationPrefs>) => void] {
  const value = useSyncExternalStore(subscribe, readLocationPrefs, readLocationPrefs);
  const update = useCallback((patch: Partial<LocationPrefs>) => void writeLocationPrefs(patch), []);
  return [value, update];
}

export function readRecentSearches(): string[] {
  return recent;
}
export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, readRecentSearches, readRecentSearches);
}
export function pushRecentSearch(q: string): void {
  const v = q.trim();
  if (!v) return;
  recent = [v, ...recent.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6);
  notify();
  void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent)).catch(() => undefined);
}
export function clearRecentSearches(): void {
  recent = [];
  notify();
  void AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
}
