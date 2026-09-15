/**
 * Point d'accroche de la traduction pour les constantes et utilitaires partagés : ce paquet
 * ne connaît pas les dictionnaires (ils vivent dans l'application), mais ses libellés
 * (« Aujourd'hui », « dans {n} min ») doivent suivre la langue choisie. L'application pose
 * son traducteur ici ; sans lui, le français est rendu tel quel, variables remplacées.
 */
export type Translate = (fr: string, vars?: Record<string, string | number>) => string;

function interpolate(fr: string, vars?: Record<string, string | number>): string {
  let out = fr;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

let translate: Translate = interpolate;
/** Locale Intl des dates et nombres (« fr-DZ », « ar-DZ-u-nu-latn », « en-GB »). */
let formatLocaleValue = 'fr-DZ';

export function setTranslator(fn: Translate): void {
  translate = fn;
}
export function tr(fr: string, vars?: Record<string, string | number>): string {
  return translate(fr, vars);
}
export function setFormatLocale(locale: string): void {
  formatLocaleValue = locale;
}
export function formatLocale(): string {
  return formatLocaleValue;
}
