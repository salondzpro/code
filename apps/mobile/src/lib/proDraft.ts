/**
 * Brouillon de l'onboarding professionnel (design PRO-F 03 → 06) : le salon n'est créé en base
 * qu'à l'étape 4 (adresse). Les images choisies à l'étape 3 restent en mémoire (URI locales)
 * jusqu'au téléversement.
 */
import { useSyncExternalStore } from 'react';
import type { Market } from '@salondz/constants';

export interface ProDraft {
  market?: Market;
  name?: string;
  address?: string;
  wilayaCode?: number;
  zone?: string;
  homeService?: boolean;
}
export interface LocalImage {
  uri: string;
  width?: number;
  height?: number;
}

let draft: ProDraft = {};
const files: { cover?: LocalImage; logo?: LocalImage } = {};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function readProDraft(): ProDraft {
  return draft;
}
export function writeProDraft(patch: Partial<ProDraft>): ProDraft {
  draft = { ...draft, ...patch };
  notify();
  return draft;
}
export function clearProDraft(): void {
  draft = {};
  delete files.cover;
  delete files.logo;
  notify();
}
export function useProDraft(): ProDraft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    readProDraft,
    readProDraft,
  );
}

export const draftFiles = {
  get: () => files,
  set: (patch: { cover?: LocalImage | null; logo?: LocalImage | null }) => {
    if (patch.cover !== undefined) {
      if (patch.cover) files.cover = patch.cover;
      else delete files.cover;
    }
    if (patch.logo !== undefined) {
      if (patch.logo) files.logo = patch.logo;
      else delete files.logo;
    }
    notify();
  },
};

/** Nombre d'étapes affiché dans l'en-tête (design : « Étape n sur 10 »). */
export const ONBOARDING_STEPS = 10;
export const stepPath = (n: number) => `/onboarding/${n}`;
