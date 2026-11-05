/**
 * Le fichier de « Ma vidéo », préparé en arrière-plan dès l'accueil et gardé sur le téléphone. Le pro qui
 * ouvre sa vidéo la trouve donc prête : télécharger et partager marchent tout de suite. La clé porte le
 * jour, car la vidéo montre la date et les heures libres.
 */
import { useSyncExternalStore } from 'react';
import { BIO_VIDEO_MS, BIO_VIDEO_SIZE, drawBioFrame, type BioVideoData } from './bioVideo';
import { encodeVideo } from './videoEncode';

type State = { key: string; blob: Blob | null; progress: number; failed: boolean };

const DB = 'salondz-video';
const STORE = 'files';
const LATEST = 'latest';
const IDLE: State = { key: '', blob: null, progress: 0, failed: false };
let state = IDLE;
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

function open(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function readSaved(key: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((ok) => {
    const r = db.transaction(STORE).objectStore(STORE).get(LATEST);
    r.onsuccess = () => {
      const saved = r.result as { key: string; blob: Blob } | undefined;
      ok(saved?.key === key ? saved.blob : null);
    };
    r.onerror = () => ok(null);
  });
}

async function save(key: string, blob: Blob) {
  const db = await open();
  db.transaction(STORE, 'readwrite').objectStore(STORE).put({ key, blob }, LATEST);
}

export const loadVideoFonts = () =>
  Promise.all(['700 60px Outfit', '500 16px Inter', 'italic 400 70px "Instrument Serif"'].map((f) => document.fonts.load(f).catch(() => undefined)));

/** Une seule fabrication à la fois, et jamais deux fois la même. */
export function prepareVideo(key: string, load: () => Promise<BioVideoData>) {
  if (state.key === key) return;
  state = { ...IDLE, key };
  listeners.forEach((l) => l());
  void (async () => {
    const saved = await readSaved(key).catch(() => null);
    if (state.key !== key) return;
    if (saved) {
      set({ blob: saved, progress: 1 });
      return;
    }
    const [data] = await Promise.all([load(), loadVideoFonts()]);
    const blob = await encodeVideo(
      BIO_VIDEO_SIZE,
      BIO_VIDEO_MS,
      (g, ms) => drawBioFrame(g, ms, data),
      (progress) => state.key === key && set({ progress }),
      () => state.key !== key,
    ).catch(() => null);
    if (state.key !== key) return;
    if (!blob) {
      set({ failed: true });
      return;
    }
    set({ blob, progress: 1 });
    await save(key, blob).catch(() => undefined);
  })().catch(() => state.key === key && set({ failed: true }));
}

/** Pour le dernier recours : un fichier obtenu par l'enregistrement de la lecture. */
export const provideVideo = (key: string, blob: Blob) => state.key === key && set({ blob, progress: 1, failed: false });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useVideoFile = () => useSyncExternalStore(subscribe, () => state);
