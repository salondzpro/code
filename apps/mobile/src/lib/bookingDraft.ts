/**
 * Brouillon de réservation (design C-F 08 → 11) : prestations choisies, créneau, coordonnées.
 * Conservé par salon en mémoire pour survivre à une connexion intermédiaire.
 */
import { useSyncExternalStore } from 'react';

export interface BookingDraft {
  slug: string;
  serviceIds: string[];
  date?: string;
  startsAt?: string;
  name?: string;
  phone?: string;
  notes?: string;
  whatsapp?: boolean;
}

const drafts = new Map<string, BookingDraft>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function readDraft(slug: string): BookingDraft {
  return drafts.get(slug) ?? { slug, serviceIds: [] };
}
export function writeDraft(slug: string, patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...readDraft(slug), ...patch, slug };
  drafts.set(slug, next);
  notify();
  return next;
}
export function clearDraft(slug: string): void {
  drafts.delete(slug);
  notify();
}
export function useDraft(slug: string): BookingDraft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => readDraft(slug),
    () => readDraft(slug),
  );
}
