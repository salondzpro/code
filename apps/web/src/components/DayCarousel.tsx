/**
 * Agenda mobile-first : le contenu du jour glisse librement avec le doigt (carrousel à trois panneaux :
 * veille, jour, lendemain, avec accroche au panneau) et une bande de jours défilable horizontalement.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { DAY_LABELS_SHORT_FR, addDaysToKey, dayOfWeekFromKey, toLocalDateKey } from '@salondz/constants';
import { dayNumber, monthLabel } from './DaySelector';

/** Bande de jours défilable (± 3 semaines autour du jour choisi), jour sélectionné centré. */
export function DayScroller({ selected, onSelect, disabledDays }: { selected: string; onSelect: (dateKey: string) => void; disabledDays?: readonly number[] }) {
  const today = toLocalDateKey();
  const ref = useRef<HTMLDivElement | null>(null);
  const anchor = useRef(selected);
  // La liste est ancrée sur le premier jour choisi et s'étend de −21 à +42 jours ; on la recentre si on sort de la fenêtre.
  if (selected < addDaysToKey(anchor.current, -14) || selected > addDaysToKey(anchor.current, 35)) anchor.current = selected;
  const days: string[] = [];
  for (let i = -21; i <= 42; i++) days.push(addDaysToKey(anchor.current, i));

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  let lastMonth = '';
  return (
    <div ref={ref} className="pills -mx-5 !gap-1 px-5" role="listbox" aria-label="Choisir un jour" style={{ scrollSnapType: 'x proximity' }}>
      {days.map((d) => {
        const dow = dayOfWeekFromKey(d);
        const out = !!disabledDays?.includes(dow);
        const on = d === selected;
        const month = d.slice(0, 7);
        const showMonth = month !== lastMonth;
        lastMonth = month;
        return (
          <button
            key={d}
            type="button"
            role="option"
            aria-selected={on}
            data-day={d}
            onClick={() => onSelect(d)}
            className={`flex w-[3.25rem] flex-none flex-col items-center gap-1 rounded-[0.875rem] py-2 ${on ? 'bg-ink text-white' : out ? 'text-disabled' : 'text-text'}`}
            style={{ scrollSnapAlign: 'center' }}
            aria-label={`${DAY_LABELS_SHORT_FR[dow]} ${dayNumber(d)}`}
          >
            <span className={`text-[0.625rem] uppercase tracking-wide ${on ? 'text-white/70' : 'text-subtle'}`}>{showMonth ? monthLabel(d).split(' ')[0]?.slice(0, 4) : DAY_LABELS_SHORT_FR[dow]}</span>
            <span className={`text-[1rem] font-semibold ${d === today && !on ? 'underline decoration-2 underline-offset-4' : ''}`}>{dayNumber(d)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Trois panneaux (veille / jour / lendemain) : on glisse librement, l'accroche retombe sur un panneau, puis le
 * jour change et le carrousel se recale silencieusement au centre. `render(day)` dessine un panneau.
 */
export function DayCarousel({ date, onChange, render }: { date: string; onChange: (dateKey: string) => void; render: (dateKey: string) => ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settling = useRef<number | null>(null);
  const days = [addDaysToKey(date, -1), date, addDaysToKey(date, 1)];

  const recenter = (behavior: ScrollBehavior = 'auto') => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.clientWidth, behavior });
  };
  useLayoutEffect(() => recenter(), [date]);

  const onScroll = () => {
    if (settling.current) window.clearTimeout(settling.current);
    // Fin de glissement : le panneau le plus proche gagne (« scrollend » n'est pas encore partout).
    settling.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el || el.clientWidth === 0) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (index === 1) return;
      onChange(days[index]!);
    }, 90);
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="-mx-5 flex overflow-x-auto"
      style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
      aria-label="Glisser pour changer de jour"
    >
      {days.map((d) => (
        <div key={d} className="w-full flex-none px-5" style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }} aria-hidden={d !== date}>
          {render(d)}
        </div>
      ))}
    </div>
  );
}
