/**
 * Cartes marketplace : quels jours afficher dans la grille « Matin / Après-midi » (style Planity, simplifié).
 * - Le salon est ouvert aujourd'hui et il reste des créneaux → aujourd'hui en premier.
 * - Sinon un statut clair (« Complet aujourd'hui », « Fermé aujourd'hui », « Fermé pour aujourd'hui » après
 *   l'heure de fermeture) et la grille commence au prochain jour ouvert. Les jours fermés ne sont jamais affichés.
 */
import { formatTimeDZ, toLocalDateKey } from './dates';

export interface PeriodDayLike {
  date: string;
  open: boolean;
  closesAt: string | null;
  matin: string | null;
  apresMidi: string | null;
}

export const PERIOD_COLUMNS = 3;

export function planPeriodDays<T extends PeriodDayLike>(
  days: readonly T[],
  today: string = toLocalDateKey(),
  nowHM: string = formatTimeDZ(new Date()),
): { status: string | null; days: T[] } {
  const todayRow = days.find((d) => d.date === today);
  let status: string | null = null;
  let from = days.filter((d) => d.open);
  if (todayRow && !todayRow.matin && !todayRow.apresMidi) {
    if (!todayRow.open) status = "Fermé aujourd'hui";
    else if (todayRow.closesAt && nowHM >= todayRow.closesAt) status = "Fermé pour aujourd'hui";
    else status = "Complet aujourd'hui";
    from = from.filter((d) => d.date !== today);
  }
  return { status, days: from.slice(0, PERIOD_COLUMNS) };
}
