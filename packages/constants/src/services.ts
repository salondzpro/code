/**
 * Classement du catalogue par catégorie — partagé web/mobile, client et pro.
 * Une prestation est rangée dans la catégorie créée par le pro (`groupName`), sinon dans la catégorie
 * Salon DZ choisie (`categoryId`), sinon dans « Formule » (nom commençant par « Formule ») ou « Sans catégorie ».
 */
import { categoryLabel } from './categories';

export const FORMULA_RE = /^formule\b/i;
/** Prestations sans catégorie : groupe affiché en dernier, jamais stocké en base. */
export const DEFAULT_GROUP = 'Sans catégorie';

export interface ServiceGroup<T> {
  name: string;
  services: T[];
}

/** Libellé de catégorie d'une prestation (null si aucune). */
export function serviceCategoryName(s: { name: string; groupName?: string | null; categoryId?: string | null }): string | null {
  const g = s.groupName?.trim();
  if (g) return g;
  if (s.categoryId) return categoryLabel(s.categoryId);
  return null;
}

/** Groupes dans l'ordre de première apparition (ordre du catalogue) ; Formule et Sans catégorie en dernier. */
export function groupServices<T extends { name: string; groupName?: string | null; categoryId?: string | null }>(services: T[]): ServiceGroup<T>[] {
  const named = new Map<string, T[]>();
  const formulas: T[] = [];
  const rest: T[] = [];
  for (const s of services) {
    const g = serviceCategoryName(s);
    if (g) named.set(g, [...(named.get(g) ?? []), s]);
    else if (FORMULA_RE.test(s.name)) formulas.push(s);
    else rest.push(s);
  }
  const out: ServiceGroup<T>[] = [...named.entries()].map(([name, list]) => ({ name, services: list }));
  if (formulas.length) out.push({ name: 'Formule', services: formulas });
  if (rest.length) out.push({ name: DEFAULT_GROUP, services: rest });
  return out;
}
