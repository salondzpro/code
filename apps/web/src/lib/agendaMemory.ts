/**
 * Où l'on en était dans l'agenda. L'écran est démonté dès qu'on ouvre un formulaire : sans cette
 * mémoire, revenir ramenait à aujourd'hui, en haut de page. Gardée le temps de la session de travail.
 */
export type AgendaView = 'day' | 'week' | 'month';

interface Memory {
  date: string;
  view: AgendaView;
  scrollY: number;
  at: number;
}

const MAX_AGE_MS = 30 * 60 * 1000;
let memory: Memory | null = null;
let flash: { id: string; date: string; staffId: string | null } | null = null;

export function readAgendaMemory(): Memory | null {
  return memory && Date.now() - memory.at < MAX_AGE_MS ? memory : null;
}

export function saveAgendaMemory(patch: Partial<Omit<Memory, 'at'>>): void {
  memory = { date: '', view: 'day', scrollY: 0, ...memory, ...patch, at: Date.now() };
}

/** Rendez-vous tout juste ajouté : l'agenda le fera clignoter s'il est sur le jour affiché. */
export function flashInAgenda(id: string, date: string, staffId: string | null): void {
  flash = { id, date, staffId };
}

export function takeAgendaFlash() {
  const f = flash;
  flash = null;
  return f;
}
