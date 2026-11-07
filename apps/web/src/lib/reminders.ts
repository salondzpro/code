/**
 * Rappels manuels : ce qui est parti, par quel moyen et à quelle heure, et le message du salon. Un rappel
 * n'est compté qu'une fois confirmé par le pro. Gardés sur l'appareil.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useProBookings } from '@salondz/api-client';
import { addDaysToKey, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { t } from '@/i18n';

export type ReminderChannel = 'whatsapp' | 'sms' | 'call';
export type Reminded = { at: number; via: ReminderChannel | null };
type Pending = { id: string; name: string; via: ReminderChannel; at: number };

const SENT_KEY = 'salondz:reminded';
const PENDING_KEY = 'salondz:reminder-pending';
const KEEP_MS = 3 * 86_400_000;
const PENDING_MS = 3600_000;
const listeners = new Set<() => void>();
let sent = load();
let pending = loadPending();

function load(): Record<string, Reminded> {
  try {
    const all = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number | Reminded>;
    const list = Object.entries(all).map(([id, v]): [string, Reminded] => [id, typeof v === 'number' ? { at: v, via: null } : v]);
    return Object.fromEntries(list.filter(([, v]) => Date.now() - v.at < KEEP_MS));
  } catch {
    return {};
  }
}

function loadPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null;
    return p && Date.now() - p.at < PENDING_MS ? p : null;
  } catch {
    return null;
  }
}

function keep(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* navigation privée : gardé pour cette visite seulement */
  }
}

/** Le geste est fait, pas encore le rappel : `ReminderConfirm` demandera au retour. */
export function startReminder(b: { id: string; clientName: string }, via: ReminderChannel): void {
  pending = { id: b.id, name: b.clientName.split(' ')[0] ?? b.clientName, via, at: Date.now() };
  keep(PENDING_KEY, pending);
  listeners.forEach((l) => l());
}

export function answerReminder(done: boolean): void {
  if (done && pending) {
    sent = { ...sent, [pending.id]: { at: pending.at, via: pending.via } };
    keep(SENT_KEY, sent);
  }
  pending = null;
  keep(PENDING_KEY, null);
  listeners.forEach((l) => l());
}

/** « Prévenu par WhatsApp à 14:32 ». */
export function remindedLabel(r: Reminded): string {
  const h = formatTimeDZ(new Date(r.at).toISOString());
  if (r.via === 'whatsapp') return t('Prévenu par WhatsApp à {h}', { h });
  if (r.via === 'sms') return t('Prévenu par SMS à {h}', { h });
  if (r.via === 'call') return t('Prévenu par appel à {h}', { h });
  return t('Prévenu à {h}', { h });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useReminded = () => useSyncExternalStore(subscribe, () => sent);

/**
 * Rendez-vous dont la question « Envoyé ? » est posée SUR PLACE (carte du prochain rendez-vous de
 * l'accueil) : `ReminderConfirm` ne la repose pas dans une fenêtre. Compté, pour qu'un écran qui se
 * démonte ne retire pas la marque d'un autre.
 */
const inline = new Map<string, number>();
export function useAskInline(id: string | null): void {
  useEffect(() => {
    if (!id) return;
    inline.set(id, (inline.get(id) ?? 0) + 1);
    return () => {
      const n = (inline.get(id) ?? 1) - 1;
      if (n > 0) inline.set(id, n);
      else inline.delete(id);
    };
  }, [id]);
}
export const askedInline = (id: string) => (inline.get(id) ?? 0) > 0;
export const usePendingReminder = () => useSyncExternalStore(subscribe, () => pending);

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
