/**
 * Brouillon de l'onboarding professionnel (design PRO-F 03 → 06) : le salon n'est créé en base
 * qu'à l'étape 4 (adresse). Les images choisies à l'étape 3 restent en mémoire jusqu'au
 * téléversement (elles ne survivent pas à un rechargement : l'étape 3 redemande alors les images).
 */
import type { Market } from '@salondz/constants';

export interface ProDraft {
  market?: Market;
  name?: string;
  address?: string;
  wilayaCode?: number;
  zone?: string;
  homeService?: boolean;
  lat?: number | null;
  lng?: number | null;
}

const KEY = 'salondz:proDraft';
const files: { cover?: File; logo?: File } = {};

export function readProDraft(): ProDraft {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as ProDraft;
  } catch {
    return {};
  }
}

export function writeProDraft(patch: Partial<ProDraft>): ProDraft {
  const next = { ...readProDraft(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearProDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  delete files.cover;
  delete files.logo;
}

export const draftFiles = {
  get: () => files,
  set: (patch: { cover?: File | null; logo?: File | null }) => {
    if (patch.cover !== undefined) {
      if (patch.cover) files.cover = patch.cover;
      else delete files.cover;
    }
    if (patch.logo !== undefined) {
      if (patch.logo) files.logo = patch.logo;
      else delete files.logo;
    }
  },
};

/** Nombre d'étapes affiché dans l'en-tête (design : « Étape n sur 10 »). */
export const ONBOARDING_STEPS = 10;
