/**
 * Brouillon de réservation (design C-F 08 → 11) : prestations choisies, créneau, coordonnées.
 * Conservé par salon sur l'appareil : on choisit son créneau sans compte, et le lien de confirmation
 * d'une inscription s'ouvre souvent dans un nouvel onglet, où `sessionStorage` serait vide.
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
  /** Rendez-vous pris pour quelqu'un d'autre : son nom et son numéro identifient la personne. */
  forOther?: boolean;
  otherName?: string;
  otherPhone?: string;
  savedAt?: number;
}

/** Au-delà, le créneau choisi n'a plus de raison d'être repris. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

const key = (slug: string) => `salondz:booking:${slug}`;

export function readDraft(slug: string): BookingDraft {
  try {
    const raw = localStorage.getItem(key(slug));
    if (raw) {
      const draft = JSON.parse(raw) as BookingDraft;
      if (Date.now() - (draft.savedAt ?? 0) < MAX_AGE_MS) return draft;
      localStorage.removeItem(key(slug));
    }
  } catch {
    /* ignore */
  }
  return { slug, serviceIds: [] };
}

export function writeDraft(slug: string, patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...readDraft(slug), ...patch, slug, savedAt: Date.now() };
  try {
    localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearDraft(slug: string): void {
  try {
    localStorage.removeItem(key(slug));
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
