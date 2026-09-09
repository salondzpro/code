/**
 * Horaires par jour avec une ou plusieurs pauses (ex. vendredi 12:00–14:00, ou 11:00–11:30 puis 13:00–14:00)
 * — partagé web/mobile. En base, une journée avec N pauses = N + 1 plages ; ici une ligne par jour.
 */
import { WEEK_DAYS, DEFAULT_OPENING_HOURS, type DayOfWeek } from './dates';

export interface DayRange {
  dayOfWeek: DayOfWeek;
  start: string;
  end: string;
}

export interface DayBreak {
  from: string;
  to: string;
}

export interface DayHoursRow {
  dayOfWeek: DayOfWeek;
  open: boolean;
  opensAt: string;
  closesAt: string;
  /** Pauses dans la journée (fermetures entre `from` et `to`), dans l'ordre. */
  breaks: DayBreak[];
}

/** Nombre maximal de pauses par jour (plages en base = pauses + 1). */
export const MAX_BREAKS_PER_DAY = 4;

/** Lignes d'édition à partir des plages en base (0 à N plages par jour). */
export function rowsFromRanges(ranges: DayRange[], fallback?: DayRange[]): DayHoursRow[] {
  return WEEK_DAYS.map((d) => {
    const own = ranges.filter((r) => r.dayOfWeek === d).sort((a, b) => a.start.localeCompare(b.start));
    const fb = (fallback ?? []).filter((r) => r.dayOfWeek === d).sort((a, b) => a.start.localeCompare(b.start));
    const def = DEFAULT_OPENING_HOURS[d]!;
    const src = own.length ? own : fb;
    if (src.length === 0) return { dayOfWeek: d, open: false, opensAt: def.opensAt, closesAt: def.closesAt, breaks: [] };
    const breaks: DayBreak[] = [];
    for (let i = 1; i < src.length; i++) breaks.push({ from: src[i - 1]!.end, to: src[i]!.start });
    return {
      dayOfWeek: d,
      open: own.length > 0 || (fallback ? false : true),
      opensAt: src[0]!.start,
      closesAt: src[src.length - 1]!.end,
      breaks,
    };
  });
}

/** Pauses valides et triées d'une ligne (dans la journée, sans chevauchement). */
function validBreaks(r: DayHoursRow): DayBreak[] {
  const sorted = [...r.breaks].filter((b) => b.from < b.to && b.from > r.opensAt && b.to < r.closesAt).sort((a, b) => a.from.localeCompare(b.from));
  const out: DayBreak[] = [];
  for (const b of sorted) {
    const prev = out[out.length - 1];
    if (prev && b.from < prev.to) continue;
    out.push(b);
  }
  return out;
}

/** Plages à enregistrer (jours ouverts uniquement) : la journée découpée autour de ses pauses. */
export function rangesFromRows(rows: DayHoursRow[]): DayRange[] {
  return rows
    .filter((r) => r.open)
    .flatMap((r) => {
      const out: DayRange[] = [];
      let cursor = r.opensAt;
      for (const b of validBreaks(r)) {
        out.push({ dayOfWeek: r.dayOfWeek, start: cursor, end: b.from });
        cursor = b.to;
      }
      out.push({ dayOfWeek: r.dayOfWeek, start: cursor, end: r.closesAt });
      return out;
    });
}

/** Message d'erreur de la ligne, ou null. */
export function rowError(r: DayHoursRow): string | null {
  if (!r.open) return null;
  if (r.opensAt >= r.closesAt) return "L'heure d'ouverture doit précéder la fermeture.";
  const sorted = [...r.breaks].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]!;
    if (b.from >= b.to) return 'Le début de la pause doit précéder sa fin.';
    if (b.from <= r.opensAt || b.to >= r.closesAt) return "Chaque pause doit être comprise entre l'ouverture et la fermeture.";
    const prev = sorted[i - 1];
    if (prev && b.from < prev.to) return 'Deux pauses se chevauchent.';
  }
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

/** Pause proposée par défaut à l'ajout : après la dernière pause, sinon 12:00–13:00 dans la journée. */
export function nextBreakSuggestion(r: DayHoursRow): DayBreak {
  const last = [...r.breaks].sort((a, b) => a.from.localeCompare(b.from)).pop();
  if (!last) return r.opensAt < '12:00' && r.closesAt > '13:00' ? { from: '12:00', to: '13:00' } : { from: r.opensAt, to: r.closesAt };
  const [h, m] = last.to.split(':').map(Number);
  const from = `${String(Math.min(23, (h ?? 0) + 2)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
  const to = `${String(Math.min(23, (h ?? 0) + 2)).padStart(2, '0')}:${String(Math.min(59, (m ?? 0) + 30)).padStart(2, '0')}`;
  return { from, to };
}
