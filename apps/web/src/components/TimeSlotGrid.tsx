import type { AvailabilitySlot } from '@salondz/types';
import { formatTimeDZ } from '@salondz/constants';

function periodOf(iso: string): 'Matin' | 'Après-midi' | 'Soir' {
  const h = Number(formatTimeDZ(iso).slice(0, 2));
  if (h < 12) return 'Matin';
  if (h < 17) return 'Après-midi';
  return 'Soir';
}

export function TimeSlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: AvailabilitySlot[];
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
}) {
  const groups = new Map<string, AvailabilitySlot[]>();
  for (const s of slots) {
    const p = periodOf(s.startsAt);
    groups.set(p, [...(groups.get(p) ?? []), s]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([period, list]) => (
        <section key={period}>
          <h4 className="mb-2 text-sm font-medium text-muted">{period}</h4>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {list.map((s) => {
              const active = s.startsAt === selected;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(s)}
                  className={active ? 'chip-active justify-center py-2' : 'chip justify-center py-2 hover:border-primary'}
                >
                  {formatTimeDZ(s.startsAt)}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
