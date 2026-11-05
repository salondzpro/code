/**
 * Les disponibilités d'une story, en plages « 09:00 – 12:30 » : les créneaux qui se suivent sont
 * regroupés, et la fin est celle de la dernière prestation possible. Partagé par la carte de l'accueil
 * et le studio.
 */
import { useMemo } from 'react';
import { useAvailability } from '@salondz/api-client';
import { addDaysToKey, formatLocale, formatTimeDZ, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Vendredi 6 novembre ». */
export const fullStoryDate = (key: string) =>
  capitalize(
    new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
  );

export type StoryPart = { start: number; end: number };

const rangeLabel = (p: StoryPart) => `${minutesToTime(p.start)} – ${minutesToTime(p.end)}`;

/** Découpe les plages à chaque heure pleine : ce sont les heures qu'on coche sur l'accueil. */
export function hoursOf(parts: StoryPart[]): StoryPart[] {
  const out: StoryPart[] = [];
  for (const p of parts) {
    for (let start = p.start; start < p.end; ) {
      const end = Math.min(p.end, (Math.floor(start / 60) + 1) * 60);
      out.push({ start, end });
      start = end;
    }
  }
  return out;
}

/** Les heures qui se suivent redeviennent une seule plage. */
export function rangesOf(hours: StoryPart[]): string[] {
  const out: StoryPart[] = [];
  for (const h of hours) {
    const last = out[out.length - 1];
    if (last && last.end === h.start) last.end = h.end;
    else out.push({ ...h });
  }
  return out.map(rangeLabel);
}

/** `range` limite aux heures d'un créneau de l'agenda, en minutes. Sans `serviceId`, la prestation la plus courte. */
export function useStorySlots(salon: SalonOwnerView, date: string, range?: { from: number; to: number }, serviceId?: string) {
  const shortest = [...salon.services.filter((s) => s.isActive)].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const av = useAvailability(salon.id, { serviceId: serviceId ?? shortest?.id ?? '', date });
  const from = range?.from;
  const to = range?.to;

  const parts = useMemo(() => {
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
    return groups.map((g): StoryPart => ({ start: g.start, end: end(g) }));
  }, [av.data, from, to]);

  const slots = useMemo(() => parts.map(rangeLabel), [parts]);
  return { parts, slots, ready: !shortest || av.isSuccess || av.isError };
}

/** Le jour proposé : aujourd'hui s'il reste des disponibilités, sinon demain. */
export function useStoryDefaultDay(salon: SalonOwnerView) {
  const today = toLocalDateKey();
  const todayFree = useStorySlots(salon, today);
  const noneToday = todayFree.ready && !todayFree.slots.length;
  const date = noneToday ? addDaysToKey(today, 1) : today;
  const { parts } = useStorySlots(salon, date);
  return { date, noneToday, hours: hoursOf(parts) };
}
