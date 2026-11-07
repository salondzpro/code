/**
 * Story 1080 × 1920 fabriquée dans le navigateur : l'image fixe (PNG) ou la vidéo animée (MP4), toutes
 * deux dessinées par `drawStoryFrame` (`storyArt.ts`). Le bas reste libre : Instagram y pose ses boutons.
 */
import { isNativeApp, shareFileNative } from './nativeFile';
import { STORY_H, STORY_MS, STORY_STILL, STORY_W, drawStoryFrame, type StoryArt, type StoryModel } from './storyArt';
import { encodeVideo } from './videoEncode';
import { t } from '@/i18n';

export type { StoryModel } from './storyArt';
export type StoryChannel = 'instagram' | 'snapchat' | 'whatsapp';

const cache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

export interface StoryInput {
  model?: StoryModel;
  photo: string | null;
  logo?: string | null;
  dayLabel: string;
  /** « Vendredi 6 novembre », avec le jour. */
  dateLabel?: string;
  times: string[];
  salon: string;
  link: string;
}

async function fonts() {
  try {
    await Promise.all([document.fonts.load('600 96px Outfit'), document.fonts.load('500 40px Inter'), document.fonts.load('600 40px Inter')]);
  } catch {
    /* polices indisponibles : repli système */
  }
}

/** Charge la photo, le logo et les polices : ce qu'il faut pour dessiner la story à n'importe quel instant. */
export async function storyArtOf(o: StoryInput): Promise<StoryArt> {
  const [photo, logo] = await Promise.all([o.photo ? loadImage(o.photo) : null, o.logo ? loadImage(o.logo) : null, fonts()]);
  return {
    model: o.model ?? 'clair',
    photo,
    logo,
    salon: o.salon,
    dayLabel: o.dayLabel,
    dateLabel: o.dateLabel && o.dateLabel !== o.dayLabel ? o.dateLabel : null,
    times: o.times,
    link: o.link,
  };
}

/** L'image fixe (PNG 1080 × 1920) : la story une fois tout en place. */
export async function drawStory(o: StoryInput): Promise<Blob | null> {
  const art = await storyArtOf(o);
  const c = document.createElement('canvas');
  c.width = STORY_W;
  c.height = STORY_H;
  const g = c.getContext('2d');
  if (!g) return null;
  drawStoryFrame(g, art, STORY_STILL);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * La story ANIMÉE : un MP4 de 8 s en 720 × 1280 (taille que tous les encodeurs H.264 des téléphones
 * acceptent, et qu'Instagram affiche sans perte visible). `null` si le téléphone ne sait pas encoder :
 * l'appelant partage alors l'image fixe.
 */
export async function makeStoryVideo(o: StoryInput, onProgress: (ratio: number) => void = () => undefined, stopped: () => boolean = () => false): Promise<Blob | null> {
  const art = await storyArtOf(o);
  const k = 720 / STORY_W;
  return encodeVideo(
    { width: 720, height: 1280 },
    STORY_MS,
    (g, ms) => {
      g.save();
      g.scale(k, k);
      drawStoryFrame(g, art, ms);
      g.restore();
    },
    onProgress,
    stopped,
  ).catch(() => null);
}

/** Le téléphone sait-il fabriquer la vidéo ? (WebCodecs) */
export const canMakeStoryVideo = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

/** Enregistre l'image : téléchargement sur le site, feuille du système dans l'application. */
export async function saveImage(blob: Blob, name: string): Promise<void> {
  if (await isNativeApp()) {
    await shareFileNative(blob, name).catch(() => undefined);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const storyMessage = (day: string, times: string[], url: string, service?: string) => {
  const vars = { day: day.toLowerCase(), times: times.join(', ') };
  const text = service
    ? t('Salam 😊 Pour {service}, mes disponibilités {day} : {times}. Réservez ici 👉', { ...vars, service })
    : t('Salam 😊 Mes disponibilités {day} : {times}. Réservez ici 👉', vars);
  return `${text} ${url}`;
};

/** Une story ne porte pas de lien cliquable : le lien est copié pour le sticker Lien. */
export async function shareStory(o: { blob: Blob; name: string; channel: StoryChannel; link: string; message: string }): Promise<void> {
  const story = o.channel !== 'whatsapp';
  if (story) void navigator.clipboard?.writeText(o.link).catch(() => undefined);
  await shareImage(o.blob, o.name, story ? undefined : o.message);
}

/**
 * Partage l'image par la feuille du téléphone ; sinon la télécharge. Rend `true` si la feuille s'est
 * ouverte. Pour une story, pas de `text` : un texte joint à l'image empêche Instagram de proposer les
 * stories sur certains téléphones, et le lien est déjà dessiné sur l'image.
 */
export async function shareImage(blob: Blob, name: string, text?: string): Promise<boolean> {
  if (await isNativeApp()) {
    try {
      return await shareFileNative(blob, name);
    } catch {
      // La personne a refermé la feuille : rien à signaler.
      return true;
    }
  }
  const file = new File([blob], name, { type: blob.type || (name.endsWith('.mp4') ? 'video/mp4' : 'image/png') });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share(text ? { files: [file], text } : { files: [file] });
      return true;
    }
  } catch {
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return false;
}
