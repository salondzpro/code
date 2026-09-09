/**
 * Horaires par jour avec pause facultative (ex. vendredi 12:00–14:00) — partagé web/mobile.
 * En base, une journée avec pause = deux plages ; ici une ligne par jour, plus lisible à éditer.
 */
import { WEEK_DAYS, DEFAULT_OPENING_HOURS, type DayOfWeek } from './dates';

export interface DayRange {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
}

export interface DayHoursRow {
  dayOfWeek: DayOfWeek;
  open: boolean;
  opensAt: string;
  closesAt: string;
  /** Pause dans la journée (fermeture entre `breakFrom` et `breakTo`). */
  hasBreak: boolean;
  breakFrom: string;
  breakTo: string;
}

/** Lignes d'édition à partir des plages en base (0, 1 ou 2 plages par jour). */
export function rowsFromRanges(ranges: DayRange[], fallback?: DayRange[]): DayHoursRow[] {
  return WEEK_DAYS.map((d) => {
    const own = ranges.filter((r) => r.dayOfWeek === d).sort((a, b) => a.start.localeCompare(b.start));
    const fb = (fallback ?? []).filter((r) => r.dayOfWeek === d).sort((a, b) => a.start.localeCompare(b.start));
    const def = DEFAULT_OPENING_HOURS[d]!;
    const src = own.length ? own : fb;
    if (src.length === 0) return { dayOfWeek: d, open: false, opensAt: def.opensAt, closesAt: def.closesAt, hasBreak: false, breakFrom: '12:00', breakTo: '14:00' };
    const first = src[0]!;
    const last = src[src.length - 1]!;
    return {
      dayOfWeek: d,
      open: own.length > 0 || (fallback ? false : true),
      opensAt: first.start,
      closesAt: last.end,
      hasBreak: src.length > 1,
      breakFrom: src.length > 1 ? first.end : '12:00',
      breakTo: src.length > 1 ? src[1]!.start : '14:00',
    };
  });
}

/** Plages à enregistrer (jours ouverts uniquement) : 1 plage, ou 2 autour de la pause. */
export function rangesFromRows(rows: DayHoursRow[]): DayRange[] {
  return rows
    .filter((r) => r.open)
    .flatMap((r) =>
      r.hasBreak && r.breakFrom > r.opensAt && r.breakTo < r.closesAt && r.breakFrom < r.breakTo
        ? [
            { dayOfWeek: r.dayOfWeek, start: r.opensAt, end: r.breakFrom },
            { dayOfWeek: r.dayOfWeek, start: r.breakTo, end: r.closesAt },
          ]
        : [{ dayOfWeek: r.dayOfWeek, start: r.opensAt, end: r.closesAt }],
    );
}

/** Message d'erreur de la ligne, ou null. */
export function rowError(r: DayHoursRow): string | null {
  if (!r.open) return null;
  if (r.opensAt >= r.closesAt) return "L'heure d'ouverture doit précéder la fermeture.";
  if (r.hasBreak && (r.breakFrom >= r.breakTo || r.breakFrom <= r.opensAt || r.breakTo >= r.closesAt)) return 'La pause doit être comprise entre l’ouverture et la fermeture.';
  return null;
}

/** « 09:00–12:00 · 14:00–19:00 » ou « 09:00–19:00 » ou « Fermé ». */
export function formatDayRanges(ranges: { start: string; end: string }[], closed = 'Fermé'): string {
  if (ranges.length === 0) return closed;
  return [...ranges]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((r) => `${r.start}–${r.end}`)
    .join(' · ');
}
