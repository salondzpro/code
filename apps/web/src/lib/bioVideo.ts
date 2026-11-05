/**
 * « Ma vidéo » : comment réserver chez ce professionnel, à publier sur ses réseaux. Un modèle aux couleurs
 * de Salon DZ, rempli avec ses vraies données : la question reçue selon son métier, ses photos, ses
 * prestations, ses prix, ses heures libres, son lien. Dessinée sur le téléphone, rien sur un serveur.
 * `bioVideoVersion` change avec ces données : le rond se rallume et la vidéo est refaite.
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
  /** Sans validation manuelle, le rendez-vous est pris tout de suite. */
  confirmed: boolean;
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
    confirmed: salon.autoConfirm,
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
  return JSON.stringify([link, salon.coverUrl, salon.autoConfirm, services]);
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

/** Le fond de marque, l'étape en clair, et l'écran du téléphone qui monte du bas. */
function screen(g: CanvasRenderingContext2D, ms: number, caption: string, draw: () => void) {
  g.fillStyle = ACCENT;
  g.fillRect(0, 0, W, H);
  write(g, 'Salon DZ', W / 2, 62, 600, 28, '#ffffff', 'center');
  enter(g, ms, 0, () => write(g, caption, W / 2, 144, 600, 40, '#ffffff', 'center'));
  const x = 52;
  const y = 196;
  const k = (W - x * 2) / W;
  g.save();
  g.beginPath();
  g.roundRect(x, y, W - x * 2, H, 44);
  g.clip();
  g.translate(x, y);
  g.scale(k, k);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  draw();
  g.restore();
}

/** Ce que ses clients lui écrivent, et le lien qui y répond. */
function sceneMessage(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  photo(g, d.hook, 0, 0, W, H);
  g.fillStyle = 'rgba(20,16,36,.62)';
  g.fillRect(0, 0, W, H);
  write(g, 'Salon DZ', W / 2, 62, 600, 28, '#ffffff', 'center');
  enter(g, ms, 200, () => bubble(g, d.question, 400, false, '#ffffff', INK));
  enter(g, ms, 1200, () => bubble(g, d.link, 520, true, ACCENT, '#ffffff'));
  enter(g, ms, 2100, () => {
    write(g, t('Plus besoin de demander'), W / 2, 770, 600, 48, '#ffffff', 'center');
    write(g, t('Réservez en ligne chez {salon}', { salon: d.salon }), W / 2, 826, 500, 30, 'rgba(255,255,255,.92)', 'center');
  });
}

function scenePage(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const chosen = ms > 2200;
  screen(g, ms, t('1. Choisissez votre prestation'), () => {
    photo(g, d.cover, 0, 0, W, 340);
    box(g, 0, 300, W, 60, '#ffffff', 40);
    write(g, d.salon, M, 410, 600, 44, INK);
    d.services.forEach((s, i) => {
      const y = 450 + i * 92;
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
  });
}

/** Le jour et l'heure, avec ses vraies heures libres. */
function sceneSlot(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const pick = Math.min(2, d.hours.length - 1);
  const chosen = ms > 2400;
  screen(g, ms, t('2. Choisissez votre créneau'), () => {
    box(g, M, 50, W - M * 2, 110, SOFT, 26);
    write(g, d.picked.name, M + 26, 98, 600, 30, INK, 'left', W - M * 2 - 52);
    write(g, d.picked.price, M + 26, 136, 500, 26, MUTED);
    enter(g, ms, 300, () => {
      write(g, t('Quel jour ?'), M, 226, 600, 32, INK);
      const w = (W - M * 2 - 40) / 5;
      d.days.slice(0, 5).forEach((x, i) => {
        const px = M + i * (w + 10);
        box(g, px, 250, w, 96, i === 0 ? INK : FILL, 22);
        write(g, x, px + w / 2, 308, 600, 24, i === 0 ? '#ffffff' : INK, 'center', w - 12);
      });
    });
    enter(g, ms, 800, () => {
      write(g, t('À quelle heure ?'), M, 420, 600, 32, INK);
      const w = (W - M * 2 - 24) / 3;
      d.hours.forEach((x, i) => {
        const px = M + (i % 3) * (w + 12);
        const py = 446 + Math.floor(i / 3) * 94;
        const on = chosen && i === pick;
        box(g, px, py, w, 80, on ? ACCENT : FILL, 20);
        write(g, x, px + w / 2, py + 51, 600, 30, on ? '#ffffff' : INK, 'center', w - 16);
      });
    });
    bar(g, chosen ? `${d.day} · ${d.hours[pick] ?? ''}` : t('Choisissez un créneau'), t('Continuer'), chosen);
  });
}

/** Les champs restent vides : aucune donnée de client dans une vidéo qu'on publie. */
function sceneContact(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const hour = d.hours[Math.min(2, d.hours.length - 1)] ?? '';
  screen(g, ms, t('3. Laissez votre numéro'), () => {
    box(g, M, 50, W - M * 2, 110, SOFT, 26);
    write(g, d.picked.name, M + 26, 98, 600, 30, INK, 'left', W - M * 2 - 52);
    write(g, `${d.day} · ${hour}`, M + 26, 136, 500, 26, MUTED);
    enter(g, ms, 300, () => {
      write(g, t('Votre nom'), M, 232, 600, 30, INK);
      box(g, M, 252, W - M * 2, 96, FILL, 22);
    });
    enter(g, ms, 700, () => {
      write(g, t('Numéro de téléphone'), M, 412, 600, 30, INK);
      box(g, M, 432, W - M * 2, 96, FILL, 22);
      write(g, '+213', M + 26, 492, 500, 30, MUTED);
    });
    bar(g, `${t('Total')} · ${d.picked.price}`, t('Confirmer'), ms > 1800);
  });
}

function sceneDone(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const hour = d.hours[Math.min(2, d.hours.length - 1)] ?? '';
  screen(g, ms, d.confirmed ? t("Et c'est réservé") : t('Le salon vous confirme'), () => {
    const k = ease(ms / 400);
    g.fillStyle = SOFT;
    g.beginPath();
    g.arc(W / 2, 170, 100 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ACCENT;
    g.beginPath();
    g.arc(W / 2, 170, 72 * k, 0, Math.PI * 2);
    g.fill();
    if (k > 0.8) write(g, '✓', W / 2, 200, 600, 80, '#ffffff', 'center', 100);
    enter(g, ms, 300, () => write(g, d.confirmed ? t('Rendez-vous réservé') : t('Demande envoyée'), W / 2, 346, 600, 46, INK, 'center'));
    enter(g, ms, 500, () => write(g, d.salon, W / 2, 396, 500, 30, MUTED, 'center'));
    enter(g, ms, 700, () => {
      box(g, M, 440, W - M * 2, 300, FILL, 28);
      [
        [t('Prestation'), d.picked.name],
        [t('Jour'), d.day],
        [t('Heure'), hour],
        [t('Total'), d.picked.price],
      ].forEach(([a, b], i) => {
        write(g, a!, M + 28, 500 + i * 66, 500, 28, MUTED, 'left', 200);
        write(g, b!, W - M - 28, 500 + i * 66, 600, 28, INK, 'right', 340);
      });
    });
  });
}

/** La fin : où réserver. */
function sceneEnd(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  photo(g, d.cover, 0, 0, W, H);
  g.fillStyle = 'rgba(20,16,36,.66)';
  g.fillRect(0, 0, W, H);
  enter(g, ms, 100, () => write(g, d.salon, W / 2, 500, 600, 56, '#ffffff', 'center'));
  enter(g, ms, 500, () => write(g, t('Réservez en ligne, à toute heure'), W / 2, 566, 500, 34, 'rgba(255,255,255,.92)', 'center'));
  enter(g, ms, 900, () => {
    box(g, M, 620, W - M * 2, 104, ACCENT, 28);
    write(g, d.link, W / 2, 684, 600, 34, '#ffffff', 'center', W - M * 2 - 48);
  });
  enter(g, ms, 1400, () => write(g, 'Salon DZ', W / 2, 1140, 600, 40, '#ffffff', 'center'));
}

const SCENES: [(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) => void, number][] = [
  [sceneMessage, 3800],
  [scenePage, 4400],
  [sceneSlot, 4600],
  [sceneContact, 3400],
  [sceneDone, 3000],
  [sceneEnd, 3600],
];
export const BIO_VIDEO_MS = SCENES.reduce((a, s) => a + s[1], 0);

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  g.textBaseline = 'alphabetic';
  let rest = Math.max(0, ms);
  for (const [draw, length] of SCENES) {
    if (rest < length || draw === sceneEnd) {
      draw(g, rest, d);
      return;
    }
    rest -= length;
  }
}
