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

/** Numéro de jour "7" d'une clé date. */
export function dayNumber(dateKey: string): string {
  return String(Number(dateKey.slice(8, 10)));
}
