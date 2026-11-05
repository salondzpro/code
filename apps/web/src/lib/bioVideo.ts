/**
 * Vidéo « lien en bio » propre à chaque professionnel, dessinée sur le téléphone à partir de ses vraies
 * données. Elle raconte ce que vit son client : la question en message, sa page avec ses photos et ses
 * prix, le choix d'un créneau, la confirmation, puis comment mettre le lien dans sa bio. Rien n'est
 * stocké sur un serveur. `bioVideoVersion` change avec ces données : la story redevient nouvelle.
 */
import { formatDA } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { proProfile, profilePhotos, profileQuestion } from './proProfile';
import { fit, loadImage } from './storyImage';
import { t } from '@/i18n';

const W = 720;
const H = 1280;
const M = 44;
export const BIO_VIDEO_SIZE = { width: W, height: H };

const ACCENT = '#6c5ce7';
const INK = '#1e1b30';
const MUTED = '#636174';
const SOFT = '#f0effe';
const FILL = '#f3f3f8';
const MAX_SERVICES = 5;
const MAX_HOURS = 9;

type Picture = HTMLImageElement | null;
export type BioVideoData = {
  salon: string;
  link: string;
  question: string;
  services: { name: string; price: string }[];
  /** La prestation que le client de la vidéo choisit, et son rendez-vous. */
  picked: { name: string; price: string };
  day: string;
  days: string[];
  hours: string[];
  cover: Picture;
  hook: Picture;
};

/** `days` et `hours` : les vrais jours et les vraies heures libres du salon. */
export async function loadBioVideo(salon: SalonOwnerView, link: string, day: string, days: string[], hours: string[]): Promise<BioVideoData> {
  const active = salon.services.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const services = active.slice(0, MAX_SERVICES).map((s) => ({ name: s.name, price: formatDA(s.priceDa) }));
  const photos = profilePhotos(salon);
  const [cover, hook] = await Promise.all([loadImage(photos[0]!), loadImage(photos[1] ?? photos[0]!)]);
  return {
    salon: salon.name,
    link,
    question: profileQuestion(proProfile(salon)),
    services,
    picked: services[0] ?? { name: salon.name, price: '' },
    day,
    days,
    hours: hours.slice(0, MAX_HOURS),
    cover,
    hook,
  };
}

/** Le lien, la photo et TOUTES les prestations actives : une prestation hors de l'image compte aussi. */
export function bioVideoVersion(salon: SalonOwnerView, link: string): string {
  const services = salon.services
    .filter((s) => s.isActive)
    .map((s) => `${s.id}:${s.name}:${s.priceDa}`)
    .sort();
  return JSON.stringify([link, salon.coverUrl, services]);
}

/**
 * Formats à essayer, du meilleur au dernier recours : Instagram et WhatsApp veulent du MP4. Pas de H.264
 * niveau 3.0 (`42E01E`) : il s'arrête à 720 × 576, et l'enregistrement sortait vide à 720 × 1280.
 */
export function bioVideoTypes(): string[] {
  if (typeof MediaRecorder === 'undefined') return [];
  return ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter((x) =>
    MediaRecorder.isTypeSupported(x),
  );
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** L'élément arrive en glissant vers le haut, `delay` ms après le début de la scène. */
function enter(g: CanvasRenderingContext2D, ms: number, delay: number, draw: () => void) {
  const k = ease((ms - delay) / 450);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = k;
  g.translate(0, (1 - k) * 36);
  draw();
  g.restore();
}

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 24) {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x, y, w, h, radius);
  g.fill();
}

function write(g: CanvasRenderingContext2D, text: string, x: number, y: number, weight: number, size: number, color: string, align: CanvasTextAlign = 'left', max = W - M * 2) {
  g.fillStyle = color;
  g.textAlign = align;
  fit(g, text, weight, size, max);
  g.fillText(text, x, y);
}

/** Remplit le cadre sans déformer la photo. */
function photo(g: CanvasRenderingContext2D, img: Picture, x: number, y: number, w: number, h: number) {
  if (!img) {
    g.fillStyle = ACCENT;
    g.fillRect(x, y, w, h);
    return;
  }
  const r = Math.max(w / img.width, h / img.height);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.drawImage(img, x + (w - img.width * r) / 2, y + (h - img.height * r) / 2, img.width * r, img.height * r);
  g.restore();
}

function bubble(g: CanvasRenderingContext2D, text: string, y: number, right: boolean, bg: string, fg: string) {
  g.font = '500 34px Outfit, Inter, sans-serif';
  const w = Math.min(W - M * 2 - 40, g.measureText(text).width + 56);
  const x = right ? W - M - w : M;
  box(g, x, y, w, 92, bg, 30);
  write(g, text, x + 28, y + 58, 500, 34, fg, 'left', w - 56);
}

function bar(g: CanvasRenderingContext2D, label: string, action: string, ready: boolean) {
  const y = H - 132;
  box(g, M - 12, y, W - (M - 12) * 2, 100, INK, 32);
  write(g, label, M + 18, y + 61, 500, 28, '#ffffff', 'left', 340);
  box(g, W - M - 204, y + 12, 180, 76, ready ? ACCENT : '#3a3748', 24);
  write(g, action, W - M - 114, y + 61, 600, 28, '#ffffff', 'center', 160);
}

/** Ce que le pro reçoit tous les jours en message, et le lien qui y répond. */
function sceneMessage(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  photo(g, d.hook, 0, 0, W, H);
  g.fillStyle = 'rgba(20,16,36,.62)';
  g.fillRect(0, 0, W, H);
  enter(g, ms, 200, () => bubble(g, d.question, 420, false, '#ffffff', INK));
  enter(g, ms, 1300, () => bubble(g, d.link, 540, true, ACCENT, '#ffffff'));
  enter(g, ms, 2300, () => write(g, t('Votre lien répond à votre place'), W / 2, 800, 600, 46, '#ffffff', 'center'));
}

/** Sa page, comme son client la voit. */
function scenePage(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const chosen = ms > 2400;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  photo(g, d.cover, 0, 0, W, 380);
  box(g, 0, 340, W, 60, '#ffffff', 40);
  write(g, d.salon, M, 450, 600, 46, INK);
  write(g, t('Prestations'), M, 530, 600, 30, INK);
  d.services.forEach((s, i) => {
    const y = 556 + i * 92;
    enter(g, ms, 200 + i * 160, () => {
      const on = chosen && i === 0;
      box(g, M, y, W - M * 2, 80, on ? SOFT : '#ffffff', 20);
      write(g, s.name, M + 18, y + 50, 500, 29, INK, 'left', 330);
      write(g, s.price, W - M - 78, y + 50, 600, 28, INK, 'right', 180);
      g.fillStyle = on ? ACCENT : FILL;
      g.beginPath();
      g.arc(W - M - 38, y + 40, 22, 0, Math.PI * 2);
      g.fill();
      write(g, on ? '✓' : '+', W - M - 38, y + 50, 600, 28, on ? '#ffffff' : ACCENT, 'center', 30);
    });
  });
  bar(g, chosen ? d.picked.name : t('Choisissez un service'), t('Réserver'), chosen);
}

/** Le choix du jour et de l'heure, avec ses vraies heures libres. */
function sceneSlot(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const pick = Math.min(2, d.hours.length - 1);
  const chosen = ms > 2600;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  write(g, t('Choisir un créneau'), M, 130, 600, 46, INK);
  box(g, M, 170, W - M * 2, 110, SOFT, 26);
  write(g, d.picked.name, M + 26, 218, 600, 30, INK, 'left', W - M * 2 - 52);
  write(g, d.picked.price, M + 26, 256, 500, 26, MUTED);
  enter(g, ms, 300, () => {
    write(g, t('Quel jour ?'), M, 350, 600, 32, INK);
    const w = (W - M * 2 - 40) / 5;
    d.days.slice(0, 5).forEach((x, i) => {
      const px = M + i * (w + 10);
      box(g, px, 376, w, 96, i === 0 ? INK : FILL, 22);
      write(g, x, px + w / 2, 434, 600, 24, i === 0 ? '#ffffff' : INK, 'center', w - 12);
    });
  });
  enter(g, ms, 900, () => {
    write(g, t('À quelle heure ?'), M, 548, 600, 32, INK);
    const w = (W - M * 2 - 24) / 3;
    d.hours.forEach((x, i) => {
      const px = M + (i % 3) * (w + 12);
      const py = 574 + Math.floor(i / 3) * 94;
      const on = chosen && i === pick;
      box(g, px, py, w, 80, on ? ACCENT : FILL, 20);
      write(g, x, px + w / 2, py + 51, 600, 30, on ? '#ffffff' : INK, 'center', w - 16);
    });
  });
  bar(g, chosen ? `${d.day} · ${d.hours[pick] ?? ''}` : t('Choisissez un créneau'), t('Continuer'), chosen);
}

/** Le rendez-vous est pris, sans un message. */
function sceneDone(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const hour = d.hours[Math.min(2, d.hours.length - 1)] ?? '';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const k = ease(ms / 400);
  g.fillStyle = SOFT;
  g.beginPath();
  g.arc(W / 2, 300, 104 * k, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ACCENT;
  g.beginPath();
  g.arc(W / 2, 300, 76 * k, 0, Math.PI * 2);
  g.fill();
  if (k > 0.8) write(g, '✓', W / 2, 330, 600, 84, '#ffffff', 'center', 100);
  enter(g, ms, 300, () => write(g, t('Rendez-vous réservé'), W / 2, 480, 600, 48, INK, 'center'));
  enter(g, ms, 500, () => write(g, d.salon, W / 2, 530, 500, 30, MUTED, 'center'));
  enter(g, ms, 800, () => {
    box(g, M, 590, W - M * 2, 300, FILL, 28);
    [
      [t('Prestation'), d.picked.name],
      [t('Jour'), d.day],
      [t('Heure'), hour],
      [t('Total'), d.picked.price],
    ].forEach(([a, b], i) => {
      write(g, a!, M + 28, 650 + i * 66, 500, 28, MUTED, 'left', 200);
      write(g, b!, W - M - 28, 650 + i * 66, 600, 28, INK, 'right', 340);
    });
  });
}

/** Ce qu'il lui reste à faire : mettre le lien dans sa bio. */
function sceneBio(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const steps = [t('Modifier le profil'), t('Liens'), t('Ajouter un lien externe'), t('Collez votre lien')];
  g.fillStyle = ACCENT;
  g.fillRect(0, 0, W, H);
  enter(g, ms, 100, () => write(g, t('Mettez-le dans votre bio'), W / 2, 240, 600, 50, '#ffffff', 'center'));
  enter(g, ms, 300, () => write(g, t('Dans Instagram'), W / 2, 296, 500, 32, 'rgba(255,255,255,.9)', 'center'));
  steps.forEach((s, i) => {
    const y = 350 + i * 128;
    enter(g, ms, 600 + i * 600, () => {
      box(g, M, y, W - M * 2, 110, '#ffffff', 26);
      g.fillStyle = ACCENT;
      g.beginPath();
      g.arc(M + 58, y + 55, 32, 0, Math.PI * 2);
      g.fill();
      write(g, String(i + 1), M + 58, y + 67, 600, 34, '#ffffff', 'center', 40);
      write(g, s, M + 108, y + 66, 600, 32, INK, 'left', W - M * 2 - 130);
    });
  });
  enter(g, ms, 3200, () => {
    box(g, M, 900, W - M * 2, 100, INK, 26);
    write(g, d.link, W / 2, 962, 600, 32, '#ffffff', 'center', W - M * 2 - 40);
  });
  enter(g, ms, 3600, () => write(g, 'Salon DZ', W / 2, 1120, 600, 38, '#ffffff', 'center'));
}

const SCENES: [(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) => void, number][] = [
  [sceneMessage, 4200],
  [scenePage, 4800],
  [sceneSlot, 5000],
  [sceneDone, 3400],
  [sceneBio, 5600],
];
export const BIO_VIDEO_MS = SCENES.reduce((a, s) => a + s[1], 0);

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  g.textBaseline = 'alphabetic';
  let rest = Math.max(0, ms);
  for (const [draw, length] of SCENES) {
    if (rest < length || draw === sceneBio) {
      draw(g, rest, d);
      return;
    }
    rest -= length;
  }
}
