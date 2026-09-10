/** Préférences de l'espace pro conservées dans l'onglet : membre filtré sur l'accueil et l'agenda. */
import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'salondz:pro:staffFilter';
let cache: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (cache !== undefined) return cache;
  try {
    cache = sessionStorage.getItem(KEY) || null;
  } catch {
    cache = null;
  }
  return cache;
}

/** `null` = toute l'équipe. */
export function useStaffFilter(): [string | null, (id: string | null) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
  const set = useCallback((id: string | null) => {
    cache = id;
    try {
      if (id) sessionStorage.setItem(KEY, id);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return [value, set];
}

/**
 * Agenda : afficher aussi les rendez-vous annulés (en pointillés, avec qui a annulé). Masqués par défaut :
 * l'agenda montre le planning réel ; on les affiche à la demande. Choix conservé sur l'appareil.
 */
const CANCELLED_KEY = 'salondz:pro:showCancelled';
let cancelledCache: boolean | undefined;
const cancelledListeners = new Set<() => void>();
function readShowCancelled(): boolean {
  if (cancelledCache !== undefined) return cancelledCache;
  try {
    cancelledCache = localStorage.getItem(CANCELLED_KEY) === '1';
  } catch {
    cancelledCache = false;
  }
  return cancelledCache;
}
export function useShowCancelled(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      cancelledListeners.add(cb);
      return () => cancelledListeners.delete(cb);
    },
    readShowCancelled,
    readShowCancelled,
  );
  const set = useCallback((v: boolean) => {
    cancelledCache = v;
    try {
      localStorage.setItem(CANCELLED_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    cancelledListeners.forEach((l) => l());
  }, []);
  return [value, set];
}
