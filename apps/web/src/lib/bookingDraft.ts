/**
 * Brouillon de réservation (design C-F 08 → 11) : prestations choisies, créneau, coordonnées.
 * Conservé par salon dans sessionStorage pour survivre à une connexion intermédiaire.
 */
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

const key = (slug: string) => `salondz:booking:${slug}`;

export function readDraft(slug: string): BookingDraft {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (raw) return JSON.parse(raw) as BookingDraft;
  } catch {
    /* ignore */
  }
  return { slug, serviceIds: [] };
}

export function writeDraft(slug: string, patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...readDraft(slug), ...patch, slug };
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearDraft(slug: string): void {
  try {
    sessionStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}

/** « 45′ » / « 1 h 15 » pour les récapitulatifs compacts du design. */
export function shortDuration(min: number): string {
  if (min < 60) return `${min}′`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
