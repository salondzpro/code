/** Regroupement du catalogue par groupe libre (créé par le pro) — partagé web/mobile, client et pro. */
export const FORMULA_RE = /^formule/i;
export const DEFAULT_GROUP = 'À la carte';

export interface ServiceGroup<T> {
  name: string;
  services: T[];
}

/**
 * Groupes dans l'ordre de première apparition (ordre du catalogue) ; les prestations sans groupe vont
 * dans « Formule » (nom commençant par « Formule ») ou « À la carte », placés en dernier.
 */
export function groupServices<T extends { name: string; groupName?: string | null }>(services: T[]): ServiceGroup<T>[] {
  const named = new Map<string, T[]>();
  const formulas: T[] = [];
  const rest: T[] = [];
  for (const s of services) {
    const g = s.groupName?.trim();
    if (g) named.set(g, [...(named.get(g) ?? []), s]);
    else if (FORMULA_RE.test(s.name)) formulas.push(s);
    else rest.push(s);
  }
  const out: ServiceGroup<T>[] = [...named.entries()].map(([name, list]) => ({ name, services: list }));
  if (formulas.length) out.push({ name: 'Formule', services: formulas });
  if (rest.length) out.push({ name: DEFAULT_GROUP, services: rest });
  return out;
}
