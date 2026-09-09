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
