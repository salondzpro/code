/**
 * Image de story 1080 × 1920 dessinée dans le navigateur : la photo du salon, puis un panneau blanc avec
 * le jour, les heures et le lien. Le bas reste libre : Instagram y pose ses boutons.
 */
import { isNativeApp, shareFileNative } from './nativeFile';

const W = 1080;
const H = 1920;

export type StoryModel = 'photo' | 'violet' | 'clair';

const cache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string): Promise<HTMLImageElement | null> {
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

const INK = '#1e1b30';
const MUTED = '#636174';
const ACCENT = '#6c5ce7';
const SOFT = '#f0effe';
const PANEL_TOP = 800;
const PANEL_MIN_TOP = 400;
const MARGIN = 80;
/** Instagram pose ses boutons en haut et en bas : le texte reste entre ces deux lignes. */
const SAFE_TOP = 270;
const LINK_Y = H - 340;
const LINK_H = 136;

/** Taille la plus grande qui tient sur la largeur : un long nom de salon ne se tasse pas. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number, family = 'Outfit, Inter, sans-serif') {
  let px = size;
  g.font = `${weight} ${px}px ${family}`;
  while (px > 28 && g.measureText(text).width > max) {
    px -= 2;
    g.font = `${weight} ${px}px ${family}`;
  }
}

const columns = (n: number) => (n > 3 ? 2 : 1);
const rowsOf = (n: number) => Math.ceil(n / columns(n));

/** Toutes les plages, sans exception : plus il y en a, plus les pastilles s'affinent pour tenir. */
function pills(g: CanvasRenderingContext2D, times: string[], y: number, maxH: number, bg: string, fg: string, radius: number) {
  const cols = columns(times.length);
  const rows = rowsOf(times.length);
  const gap = 20;
  const w = (W - MARGIN * 2 - gap * (cols - 1)) / cols;
  const room = LINK_Y - 36 - y;
  const h = Math.min(maxH, (room - gap * (rows - 1)) / rows);
  const size = Math.round(h * 0.46);
  times.forEach((x, i) => {
    const px = MARGIN + (i % cols) * (w + gap);
    const py = y + Math.floor(i / cols) * (h + gap);
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(px, py, w, h, Math.min(radius, h / 2));
    g.fill();
    g.fillStyle = fg;
    g.textAlign = 'center';
    fit(g, x, 600, size, w - 32);
    g.fillText(x, px + w / 2, py + h / 2 + h * 0.16);
  });
  g.textAlign = 'left';
}

function linkBar(g: CanvasRenderingContext2D, link: string, bg: string, fg: string) {
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(MARGIN, LINK_Y, W - MARGIN * 2, LINK_H, 36);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = 'center';
  fit(g, link, 600, 44, W - MARGIN * 2 - 64);
  g.fillText(link, W / 2, LINK_Y + LINK_H / 2 + 16);
  g.textAlign = 'left';
}

function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, height: number) {
  const r = Math.max(W / img.width, height / img.height);
  const w = img.width * r, h = img.height * r;
  g.drawImage(img, (W - w) / 2, (height - h) / 2, w, h);
}

export async function drawStory(o: {
  model?: StoryModel;
  photo: string | null;
  dayLabel: string;
  /** « Vendredi 6 novembre », avec le jour. */
  dateLabel?: string;
  subtitle: string;
  times: string[];
  salon: string;
  link: string;
}): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  try {
    await Promise.all([document.fonts.load('600 96px Outfit'), document.fonts.load('500 40px Inter')]);
  } catch {
    /* polices indisponibles : repli système */
  }
  const model = o.model ?? 'clair';
  const img = o.photo ? await loadImage(o.photo) : null;
  const date = o.dateLabel && o.dateLabel !== o.dayLabel ? o.dateLabel : null;
  g.textBaseline = 'alphabetic';

  if (model === 'clair') {
    // La photo en haut, le panneau blanc dessous : il monte quand la journée compte beaucoup de plages,
    // pour que les heures restent lisibles.
    const top = Math.max(PANEL_MIN_TOP, PANEL_TOP - Math.max(0, rowsOf(o.times.length) - 3) * 100);
    g.fillStyle = ACCENT;
    g.fillRect(0, 0, W, H);
    if (img) {
      const box = top + 80;
      cover(g, img, box);
      const veil = g.createLinearGradient(0, box - 420, 0, box);
      veil.addColorStop(0, 'rgba(30,27,48,0)');
      veil.addColorStop(1, 'rgba(30,27,48,.72)');
      g.fillStyle = veil;
      g.fillRect(0, box - 420, W, 420);
    }
    g.fillStyle = '#ffffff';
    fit(g, o.salon, 600, 60, W - MARGIN * 2);
    g.fillText(o.salon, MARGIN, top - 44);
    g.beginPath();
    g.roundRect(0, top, W, H - top + 80, [72, 72, 0, 0]);
    g.fill();
    let y = top + 104;
    if (date) {
      g.fillStyle = MUTED;
      g.font = '500 40px Inter, sans-serif';
      g.fillText(date, MARGIN, y);
      y += 96;
    } else y += 40;
    g.fillStyle = INK;
    fit(g, o.dayLabel, 600, 104, W - MARGIN * 2);
    g.fillText(o.dayLabel, MARGIN, y);
    y += 72;
    g.fillStyle = ACCENT;
    g.font = '600 48px Outfit, Inter, sans-serif';
    g.fillText(o.subtitle, MARGIN, y);
    pills(g, o.times, y + 56, 104, SOFT, INK, 28);
    linkBar(g, o.link, INK, '#ffffff');
  } else {
    // Plein cadre : la photo sous un voile, ou le violet uni et ses deux grands disques.
    if (model === 'photo' && img) {
      cover(g, img, H);
      g.fillStyle = 'rgba(20,16,36,.58)';
      g.fillRect(0, 0, W, H);
    } else {
      g.fillStyle = ACCENT;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#7b6df0';
      g.beginPath();
      g.arc(W - 40, 300, 460, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#8d81f3';
      g.beginPath();
      g.arc(W - 40, 300, 250, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    fit(g, o.salon, 600, 52, W - MARGIN * 2);
    g.fillText(o.salon, MARGIN, SAFE_TOP + 44);
    fit(g, o.dayLabel, 600, 148, W - MARGIN * 2);
    g.fillText(o.dayLabel, MARGIN, SAFE_TOP + 210);
    g.font = '500 44px Inter, sans-serif';
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.fillText(date ? `${date} · ${o.subtitle}` : o.subtitle, MARGIN, SAFE_TOP + 284, W - MARGIN * 2);
    pills(g, o.times, SAFE_TOP + 360, 132, '#ffffff', INK, 36);
    linkBar(g, o.link, model === 'photo' ? ACCENT : INK, '#ffffff');
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

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
  const file = new File([blob], name, { type: 'image/png' });
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
