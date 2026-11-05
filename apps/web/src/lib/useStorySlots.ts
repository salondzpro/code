/**
 * Les disponibilités d'une story, en plages « 09:00 – 12:30 » : les créneaux qui se suivent sont
 * regroupés, et la fin est celle de la dernière prestation possible. Partagé par la carte de l'accueil
 * et le studio.
 */
import { useMemo } from 'react';
import { useAvailability } from '@salondz/api-client';
import { formatLocale, formatTimeDZ, minutesToTime, timeToMinutes } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Vendredi 6 novembre ». */
export const fullStoryDate = (key: string) =>
  capitalize(
    new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
  );

/** `range` limite aux heures d'un créneau de l'agenda, en minutes. */
export function useStorySlots(salon: SalonOwnerView, date: string, range?: { from: number; to: number }) {
  const shortest = [...salon.services.filter((s) => s.isActive)].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const av = useAvailability(salon.id, { serviceId: shortest?.id ?? '', date });
  const from = range?.from;
  const to = range?.to;

  const slots = useMemo(() => {
    const step = av.data?.slotIntervalMinutes || 15;
    const duration = av.data?.durationMinutes || step;
    const groups: { start: number; last: number }[] = [];
    for (const s of av.data?.slots ?? []) {
      if (new Date(s.startsAt).getTime() <= Date.now()) continue;
      const m = timeToMinutes(formatTimeDZ(s.startsAt));
      if (from !== undefined && to !== undefined && (m < from || m >= to)) continue;
      const g = groups[groups.length - 1];
      if (g && m - g.last <= step) g.last = m;
      else groups.push({ start: m, last: m });
    }
    // Depuis un créneau de l'agenda, la plage ne déborde pas de ce créneau.
    const end = (g: { last: number }) => (to !== undefined ? Math.min(g.last + duration, to) : g.last + duration);
    return groups.map((g) => `${minutesToTime(g.start)} – ${minutesToTime(end(g))}`);
  }, [av.data, from, to]);

  return { slots, ready: !shortest || av.isSuccess || av.isError };
}
