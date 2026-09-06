/**
 * Bande de 7 jours (dimanche → samedi) et navigation de mois, reprises du design
 * (.dsel / .dcel + en-tête « AOÛT 2026 ‹ › »).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, toLocalDateKey, weekKeys } from '@salondz/constants';
import { I, IconButton } from './ui';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function monthLabel(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  return `${MONTHS_FR[(m ?? 1) - 1]} ${y}`;
}

export function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(8, 10)));
}

/** « Dim 23 · Lun 24 … » — jours hors plage ou fermés en gris clair. */
export function DayStrip({
  weekOf,
  selected,
  onSelect,
  minDate,
  maxDate,
  disabledDays,
}: {
  weekOf: string;
  selected: string;
  onSelect: (dateKey: string) => void;
  minDate?: string | null;
  maxDate?: string | null;
  disabledDays?: readonly number[];
}) {
  const days = weekKeys(weekOf);
  return (
    <div className="dsel" role="listbox" aria-label="Choisir un jour">
      {days.map((d) => {
        const dow = dayOfWeekFromKey(d);
        const out = (!!minDate && d < minDate) || (!!maxDate && d > maxDate) || !!disabledDays?.includes(dow);
        const on = d === selected;
        return (
          <button key={d} type="button" role="option" aria-selected={on} disabled={out} onClick={() => onSelect(d)} className={`dcel${on ? ' on' : ''}${out ? ' mut' : ''}`}>
            <span>{DAY_LABELS_SHORT_FR[dow]}</span>
            <b>{dayNumber(d)}</b>
          </button>
        );
      })}
    </div>
  );
}

/** En-tête « AOÛT 2026 » + boutons ronds ‹ › (semaine précédente / suivante). */
export function MonthNav({ weekOf, onWeekChange, minDate, maxDate }: { weekOf: string; onWeekChange: (weekOf: string) => void; minDate?: string | null; maxDate?: string | null }) {
  const days = weekKeys(weekOf);
  const first = days[0]!;
  const last = days[6]!;
  const canPrev = !minDate || first > minDate;
  const canNext = !maxDate || last < maxDate;
  return (
    <div className="flex items-center justify-between">
      <span className="h3">{monthLabel(weekOf)}</span>
      <div className="flex gap-2">
        <IconButton aria-label="Semaine précédente" disabled={!canPrev} style={{ opacity: canPrev ? 1 : 0.35 }} onClick={() => onWeekChange(addDaysToKey(first, -7))}>
          <I icon={ChevronLeft} size={18} />
        </IconButton>
        <IconButton aria-label="Semaine suivante" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.35 }} onClick={() => onWeekChange(addDaysToKey(first, 7))}>
          <I icon={ChevronRight} size={18} />
        </IconButton>
      </div>
    </div>
  );
}

export const today = () => toLocalDateKey();
