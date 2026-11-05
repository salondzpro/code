/**
 * Rappels manuels : ce qui est déjà parti et le message du salon. Gardés sur l'appareil.
 */
import { useSyncExternalStore } from 'react';
import { useProBookings } from '@salondz/api-client';
import { addDaysToKey, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { t } from '@/i18n';

const SENT_KEY = 'salondz:reminded';
const KEEP_MS = 3 * 86_400_000;
const listeners = new Set<() => void>();
let sent = load();

function load(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([, at]) => Date.now() - at < KEEP_MS));
  } catch {
    return {};
  }
}

export function markReminded(id: string): void {
  sent = { ...sent, [id]: Date.now() };
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  } catch {
    /* navigation privée : marqué pour cette visite seulement */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useReminded = () => useSyncExternalStore(subscribe, () => sent);

/** Rendez-vous à rappeler : confirmés, à venir, aujourd'hui et demain. */
export function useReminderBookings(enabled: boolean) {
  const today = toLocalDateKey();
  const list = useProBookings({ from: today, to: addDaysToKey(today, 1), limit: 200 }, enabled);
  const items = (list.data?.items ?? [])
    .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() > Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { list, items };
}

/** Pastille de l'onglet : ce qu'on peut encore envoyer aujourd'hui, la liste affichée par défaut. */
export function useRemindersToSend(enabled: boolean): number {
  const { items } = useReminderBookings(enabled);
  const done = useReminded();
  const today = toLocalDateKey();
  return items.filter((b) => b.clientPhone && !done[b.id] && toLocalDateKey(new Date(b.startsAt)) === today).length;
}

const messageKey = (salonId: string) => `salondz:reminder-message:${salonId}`;

export const defaultReminderMessage = () =>
  t('Salam {prenom} 😊 Petit rappel : votre rendez-vous {prestation} chez {salon} est {jour} à {heure}. À bientôt !');

export function readReminderMessage(salonId: string): string {
  try {
    return localStorage.getItem(messageKey(salonId)) || defaultReminderMessage();
  } catch {
    return defaultReminderMessage();
  }
}

export function saveReminderMessage(salonId: string, text: string): void {
  try {
    if (text.trim() && text !== defaultReminderMessage()) localStorage.setItem(messageKey(salonId), text);
    else localStorage.removeItem(messageKey(salonId));
  } catch {
    /* navigation privée */
  }
}

export function fillReminder(text: string, b: BookingWithStaff, salon: SalonOwnerView): string {
  const key = toLocalDateKey(new Date(b.startsAt));
  const today = toLocalDateKey();
  const day = key === today ? t('aujourd’hui') : key === addDaysToKey(today, 1) ? t('demain') : relativeDayLabelDZ(key).toLowerCase();
  const vars: Record<string, string> = {
    prenom: b.clientName.split(' ')[0] ?? b.clientName,
    prestation: b.serviceName,
    salon: salon.name,
    jour: day,
    heure: formatTimeDZ(b.startsAt),
  };
  return text.replace(/\{(prenom|prestation|salon|jour|heure)\}/g, (_, k: string) => vars[k]!);
}
