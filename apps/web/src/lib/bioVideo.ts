/**
 * Vidéo « lien en bio » propre à chaque professionnel, dessinée sur le téléphone à partir de ses vraies
 * données : son lien, ses prestations, ses prix. Rien n'est stocké sur un serveur. `bioVideoVersion`
 * change dès qu'une de ces données change : la story redevient nouvelle et la vidéo est refaite.
 */
import { formatDA } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { fit } from './storyImage';
import { t } from '@/i18n';

const W = 720;
const H = 1280;
const MARGIN = 56;
const SCENE_MS = 4500;
export const BIO_VIDEO_MS = SCENE_MS * 4;
export const BIO_VIDEO_SIZE = { width: W, height: H };

const ACCENT = '#6c5ce7';
const INK = '#1e1b30';
const MAX_SERVICES = 5;

export type BioVideoData = {
  salon: string;
  link: string;
  services: { name: string; price: string }[];
  more: number;
};

export function bioVideoData(salon: SalonOwnerView, link: string): BioVideoData {
  const active = salon.services.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    salon: salon.name,
    link,
    services: active.slice(0, MAX_SERVICES).map((s) => ({ name: s.name, price: formatDA(s.priceDa) })),
    more: Math.max(0, active.length - MAX_SERVICES),
  };
}

/** Le lien et TOUTES les prestations actives : une prestation hors de l'image compte aussi. */
export function bioVideoVersion(salon: SalonOwnerView, link: string): string {
  const services = salon.services
    .filter((s) => s.isActive)
    .map((s) => `${s.id}:${s.name}:${s.priceDa}`)
    .sort();
  return JSON.stringify([link, services]);
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
  const k = ease((ms - delay) / 500);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = k;
  g.translate(0, (1 - k) * 40);
  draw();
  g.restore();
}

function centered(g: CanvasRenderingContext2D, text: string, y: number, weight: number, size: number, color: string) {
  g.fillStyle = color;
  g.textAlign = 'center';
  fit(g, text, weight, size, W - MARGIN * 2);
  g.fillText(text, W / 2, y);
}

function box(g: CanvasRenderingContext2D, y: number, h: number, color: string, radius = 24) {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(MARGIN, y, W - MARGIN * 2, h, radius);
  g.fill();
}

function linkPill(g: CanvasRenderingContext2D, y: number, link: string) {
  box(g, y, 104, '#ffffff', 28);
  g.fillStyle = INK;
  g.textAlign = 'center';
  fit(g, link, 600, 34, W - MARGIN * 2 - 48);
  g.fillText(link, W / 2, y + 64);
}

function sceneLink(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  enter(g, ms, 100, () => centered(g, t('Votre lien de réservation'), 400, 500, 34, 'rgba(255,255,255,.9)'));
  enter(g, ms, 400, () => centered(g, d.salon, 500, 600, 68, '#ffffff'));
  enter(g, ms, 900, () => linkPill(g, 580, d.link));
  enter(g, ms, 1500, () => centered(g, t('À mettre dans votre bio Instagram'), 770, 500, 32, '#ffffff'));
}

function sceneServices(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  enter(g, ms, 100, () => centered(g, t('Vos prestations'), 300, 600, 60, '#ffffff'));
  d.services.forEach((s, i) => {
    const y = 370 + i * 116;
    enter(g, ms, 500 + i * 300, () => {
      box(g, y, 100, '#ffffff');
      g.textAlign = 'left';
      g.fillStyle = INK;
      fit(g, s.name, 600, 32, W - MARGIN * 2 - 260);
      g.fillText(s.name, MARGIN + 28, y + 61);
      g.textAlign = 'right';
      g.fillStyle = ACCENT;
      fit(g, s.price, 600, 32, 200);
      g.fillText(s.price, W - MARGIN - 28, y + 61);
    });
  });
  if (d.more) {
    enter(g, ms, 500 + d.services.length * 300, () =>
      centered(g, t('+ {n} autres sur votre page', { n: d.more }), 370 + d.services.length * 116 + 56, 500, 30, '#ffffff'),
    );
  }
}

function sceneSteps(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const steps = [t('Modifier le profil'), t('Liens'), t('Ajouter un lien externe'), t('Collez votre lien')];
  enter(g, ms, 100, () => centered(g, t('Dans Instagram'), 300, 600, 60, '#ffffff'));
  steps.forEach((s, i) => {
    const y = 380 + i * 136;
    enter(g, ms, 500 + i * 750, () => {
      box(g, y, 116, '#ffffff');
      g.fillStyle = ACCENT;
      g.beginPath();
      g.arc(MARGIN + 62, y + 58, 34, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      fit(g, String(i + 1), 600, 36, 40);
      g.fillText(String(i + 1), MARGIN + 62, y + 71);
      g.textAlign = 'left';
      g.fillStyle = INK;
      fit(g, s, 600, 34, W - MARGIN * 2 - 140);
      g.fillText(s, MARGIN + 116, y + 70);
    });
  });
  enter(g, ms, 3300, () => centered(g, d.link, 950, 500, 30, '#ffffff'));
}

function sceneEnd(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  enter(g, ms, 100, () => centered(g, t('On réserve depuis votre bio'), 480, 600, 52, '#ffffff'));
  enter(g, ms, 700, () => centered(g, t('Sans appel ni message'), 550, 500, 34, 'rgba(255,255,255,.9)'));
  enter(g, ms, 1300, () => linkPill(g, 620, d.link));
  enter(g, ms, 1900, () => centered(g, 'Salon DZ', 1120, 600, 40, '#ffffff'));
}

const SCENES = [sceneLink, sceneServices, sceneSteps, sceneEnd];

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const i = Math.min(SCENES.length - 1, Math.floor(ms / SCENE_MS));
  g.textBaseline = 'alphabetic';
  g.fillStyle = ACCENT;
  g.fillRect(0, 0, W, H);
  SCENES[i]!(g, ms - i * SCENE_MS, d);
}
