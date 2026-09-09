/**
 * Préférences locales du client (design « Localisation et rayon », « Trier ») :
 * position/quartier, rayon, tri, recherches récentes. Stockées dans le navigateur.
 */
import { useCallback, useSyncExternalStore } from 'react';

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
  /** Filtres rapides de la marketplace (puces « Aujourd'hui », « Note 4,5+ », « Ouvert »). */
  availableToday: boolean;
  ratingMin: number | null;
  openNow: boolean;
}

/** Lieu choisi récemment (quartier, ville, wilaya ou adresse géocodée). */
export interface RecentPlace {
  label: string;
  city: string | null;
  wilaya: number;
  lat: number | null;
  lng: number | null;
}

const KEY = 'salondz:location';
const RECENT_KEY = 'salondz:recentSearches';
const DEFAULTS: LocationPrefs = { city: null, wilaya: 16, lat: null, lng: null, radiusKm: 5, label: 'Alger', sort: 'relevance', availableToday: false, ratingMin: null, openNow: false };
const PLACES_KEY = 'salondz:recentPlaces';

let cache: LocationPrefs | null = null;
const listeners = new Set<() => void>();

function read(): LocationPrefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocationPrefs>) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function writeLocationPrefs(patch: Partial<LocationPrefs>): LocationPrefs {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
  return cache;
}

export function useLocationPrefs(): [LocationPrefs, (patch: Partial<LocationPrefs>) => void] {
  const prefs = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
  const update = useCallback((patch: Partial<LocationPrefs>) => void writeLocationPrefs(patch), []);
  return [prefs, update];
}

export function readRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function pushRecentSearch(q: string): void {
  const v = q.trim();
  if (!v) return;
  const next = [v, ...readRecentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}

export function readRecentPlaces(): RecentPlace[] {
  try {
    return JSON.parse(localStorage.getItem(PLACES_KEY) ?? '[]') as RecentPlace[];
  } catch {
    return [];
  }
}
export function pushRecentPlace(p: RecentPlace): void {
  const next = [p, ...readRecentPlaces().filter((x) => x.label.toLowerCase() !== p.label.toLowerCase())].slice(0, 5);
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** « 0,8 km » */
export function formatKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** « ★ 4,9 » */
export function formatRating(avg: number): string {
  return avg.toFixed(1).replace('.', ',');
}
