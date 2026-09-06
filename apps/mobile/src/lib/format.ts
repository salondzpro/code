export {
  formatDA,
  formatPriceRange,
  formatFromPrice,
  formatTimeDZ,
  formatDateShortDZ,
  formatDateLongDZ,
  formatDZPhone,
  wilayaName,
  categoryLabel,
  toLocalDateKey,
  addDaysToKey,
  weekKeys,
  dayOfWeekFromKey,
  localDateTimeToISO,
  BOOKING_STATUS_LABELS_FR,
  GENDER_TARGET_LABELS_FR,
  DAY_LABELS_FR,
  DAY_LABELS_SHORT_FR,
  WEEK_DAYS,
} from '@salondz/constants';

/** "45 min" / "1 h 30" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** « 45′ » / « 1 h 15 » pour les récapitulatifs compacts du design. */
export function shortDuration(min: number): string {
  if (min < 60) return `${min}′`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Numéro de jour "7" d'une clé date. */
export function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(8, 10)));
}

/** « 0,8 km » */
export function formatKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

/** « 4,9 » */
export function formatRating(avg: number): string {
  return avg.toFixed(1).replace('.', ',');
}

export const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function monthLabel(dateKey: string): string {
  const [y, m] = dateKey.split('-').map(Number);
  return `${MONTHS_FR[(m ?? 1) - 1]} ${y}`;
}
