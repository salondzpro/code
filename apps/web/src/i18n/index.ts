/**
 * Traduction de l'interface : français (source), arabe, anglais.
 *
 * Les clés sont les PHRASES FRANÇAISES elles-mêmes : `t('Prendre rendez-vous')`. Le code
 * reste lisible, aucune clé abstraite à inventer, et une phrase absente du dictionnaire
 * s'affiche en français plutôt qu'en identifiant technique. Les variables s'écrivent
 * `{nom}` : `t('{n} rendez-vous', { n })`.
 *
 * `t` est une fonction ordinaire (pas un hook) pour servir aussi dans les constantes et les
 * fonctions utilitaires ; au changement de langue, l'arbre React est remonté (`key` sur la
 * racine) et tout se relit dans la nouvelle langue. L'arabe passe la page en `dir="rtl"`.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { CATEGORIES, setFormatLocale, setTranslator } from '@salondz/constants';
import { ar } from './ar';
import { en } from './en';

export type Locale = 'fr' | 'ar' | 'en';
export const LOCALES: { value: Locale; label: string; dir: 'ltr' | 'rtl'; intl: string }[] = [
  { value: 'fr', label: 'Français', dir: 'ltr', intl: 'fr-DZ' },
  { value: 'ar', label: 'العربية', dir: 'rtl', intl: 'ar-DZ-u-nu-latn' },
  { value: 'en', label: 'English', dir: 'ltr', intl: 'en-GB' },
];
const KEY = 'salondz:locale';
const DICTS: Record<Locale, Record<string, string>> = { fr: {}, ar, en };
// Les catégories ont déjà leur arabe dans le référentiel partagé : on ne le recopie pas.
for (const c of CATEGORIES) if (!ar[c.labelFr]) ar[c.labelFr] = c.labelAr;

function detect(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'fr' || saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* stockage indisponible */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'fr').toLowerCase();
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('en')) return 'en';
  return 'fr';
}

let current: Locale = detect();
const listeners = new Set<() => void>();

function apply(l: Locale) {
  const def = LOCALES.find((x) => x.value === l)!;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = def.dir;
  }
  setFormatLocale(def.intl);
}
apply(current);
setTranslator((fr, vars) => t(fr, vars));

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale): void {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
  apply(l);
  listeners.forEach((fn) => fn());
}

/**
 * Changement de langue demandé par l'utilisateur : mémorisé, puis la page est rechargée.
 * Les libellés calculés au chargement des modules (statuts, options) se relisent ainsi
 * dans la nouvelle langue ; c'est un geste rare, le rechargement ne gêne pas.
 */
export function switchLocale(l: Locale): void {
  if (l === current) return;
  setLocale(l);
  if (typeof window !== 'undefined') window.location.reload();
}

export function isRtl(): boolean {
  return current === 'ar';
}

/** Traduit une phrase française dans la langue courante, avec variables `{nom}`. */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let out = DICTS[current][fr] ?? fr;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Langue courante et son réglage, réactifs. */
export function useLocale(): [Locale, (l: Locale) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLocale,
    getLocale,
  );
  const set = useCallback((l: Locale) => setLocale(l), []);
  return [value, set];
}
