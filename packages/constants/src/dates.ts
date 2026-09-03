/** Fuseau horaire unique : Algérie (UTC+1, sans heure d'été). */
export const TIMEZONE = 'Africa/Algiers' as const;
export const UTC_OFFSET_MINUTES = 60 as const;

/** La semaine commence le DIMANCHE en Algérie (0 = dimanche … 6 = samedi). */
export const WEEK_STARTS_ON = 0 as const;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Ordre d'affichage des jours, dimanche en premier. */
export const WEEK_DAYS: readonly DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export const DAY_LABELS_FR: Record<DayOfWeek, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};
export const DAY_LABELS_SHORT_FR: Record<DayOfWeek, string> = {
  0: 'Dim',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
};
export const DAY_LABELS_AR: Record<DayOfWeek, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

/** Week-end algérien : vendredi (+ samedi pour beaucoup de commerces). */
export const WEEKEND_DAYS: readonly DayOfWeek[] = [5, 6];

/** Horaires par défaut proposés à la création d'un salon (fermé le vendredi). */
export const DEFAULT_OPENING_HOURS: ReadonlyArray<{
  dayOfWeek: DayOfWeek;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}> = [
  { dayOfWeek: 0, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { dayOfWeek: 1, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { dayOfWeek: 2, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { dayOfWeek: 3, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { dayOfWeek: 4, opensAt: '09:00', closesAt: '19:00', isClosed: false },
  { dayOfWeek: 5, opensAt: '09:00', closesAt: '19:00', isClosed: true },
  { dayOfWeek: 6, opensAt: '09:00', closesAt: '19:00', isClosed: false },
];

/** Formatage "HH:mm" en heure locale algérienne à partir d'une date ISO. */
export function formatTimeDZ(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('fr-DZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  }).format(d);
}

/** "dim. 7 sept." en heure locale algérienne. */
export function formatDateShortDZ(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('fr-DZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TIMEZONE,
  }).format(d);
}

/** "dimanche 7 septembre 2026" */
export function formatDateLongDZ(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('fr-DZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(d);
}

/** "YYYY-MM-DD" de la date locale algérienne. */
export function toLocalDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Construit un instant ISO (UTC) depuis une date locale DZ "YYYY-MM-DD" + "HH:mm". */
export function localDateTimeToISO(dateKey: string, timeHM: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeHM.split(':').map(Number);
  const utcMs = Date.UTC(y!, m! - 1, d!, hh!, mm!) - UTC_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

/** Jour de semaine (0=dimanche) d'une clé "YYYY-MM-DD" interprétée en local DZ. */
export function dayOfWeekFromKey(dateKey: string): DayOfWeek {
  const [y, m, d] = dateKey.split('-').map(Number);
  // UTC+1 sans DST : midi UTC est bien le même jour local.
  return new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay() as DayOfWeek;
}

/** Ajoute n jours à une clé "YYYY-MM-DD". */
export function addDaysToKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + n, 12));
  return dt.toISOString().slice(0, 10);
}

/** Début de semaine (dimanche) pour une clé de date. */
export function startOfWeekKey(dateKey: string): string {
  const dow = dayOfWeekFromKey(dateKey);
  return addDaysToKey(dateKey, -((dow - WEEK_STARTS_ON + 7) % 7));
}

/** Les 7 clés de la semaine contenant dateKey, dimanche en premier. */
export function weekKeys(dateKey: string): string[] {
  const start = startOfWeekKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/** Minutes depuis minuit pour "HH:mm". */
export function timeToMinutes(timeHM: string): number {
  const [h, m] = timeHM.split(':').map(Number);
  return h! * 60 + m!;
}

/** "HH:mm" depuis des minutes depuis minuit. */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
