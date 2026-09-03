import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, toLocalDateKey, weekKeys } from '@salondz/constants';
import { dayNumber } from '@/lib/format';

/**
 * Bande de 7 jours, DIMANCHE en premier. `weekOf` = n'importe quelle date de la semaine.
 * `minDate` / `maxDate` désactivent les jours hors plage (ex. horizon de réservation).
 */
export function WeekStrip({
  weekOf,
  selected,
  onSelect,
  onWeekChange,
  minDate,
  maxDate,
  disabledDays,
}: {
  weekOf: string;
  selected: string;
  onSelect: (dateKey: string) => void;
  onWeekChange?: (weekOf: string) => void;
  minDate?: string;
  maxDate?: string;
  /** Jours de semaine (0=dim) affichés comme fermés. */
  disabledDays?: readonly number[];
}) {
  const days = weekKeys(weekOf);
  const today = toLocalDateKey();
  const first = days[0]!;
  const last = days[6]!;
  const monthLabel = new Intl.DateTimeFormat('fr-DZ', { month: 'long', year: 'numeric', timeZone: 'Africa/Algiers' }).format(new Date(`${selected}T12:00:00Z`));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost px-3 py-1" disabled={!onWeekChange || (!!minDate && first <= minDate)} onClick={() => onWeekChange?.(addDaysToKey(first, -7))} aria-label="Semaine précédente">
          ‹
        </button>
        <span className="text-sm font-medium capitalize">{monthLabel}</span>
        <button type="button" className="btn-ghost px-3 py-1" disabled={!onWeekChange || (!!maxDate && last >= maxDate)} onClick={() => onWeekChange?.(addDaysToKey(first, 7))} aria-label="Semaine suivante">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="listbox" aria-label="Choisir un jour">
        {days.map((d) => {
          const dow = dayOfWeekFromKey(d);
          const out = (!!minDate && d < minDate) || (!!maxDate && d > maxDate) || !!disabledDays?.includes(dow);
          const active = d === selected;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={active}
              disabled={out}
              onClick={() => onSelect(d)}
              className={`flex flex-col items-center rounded-xl border px-1 py-2 text-sm transition ${
                active ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface hover:bg-bg'
              } ${out ? 'opacity-40' : ''}`}
            >
              <span className="text-xs uppercase">{DAY_LABELS_SHORT_FR[dow]}</span>
              <span className={`text-lg font-semibold ${d === today && !active ? 'text-primary' : ''}`}>{dayNumber(d)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
