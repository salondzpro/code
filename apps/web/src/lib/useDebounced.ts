import { useEffect, useState } from 'react';

/** Valeur retardée (recherche interactive : on n'interroge l'API qu'une fois la saisie stabilisée). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
