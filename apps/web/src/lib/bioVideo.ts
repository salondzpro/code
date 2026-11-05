/**
 * « Ma vidéo » : comment réserver chez ce professionnel, à publier sur ses réseaux. Elle se lit comme un
 * enregistrement d'écran : son profil Instagram, le lien touché dans sa bio, puis la réservation dans les
 * écrans de Salon DZ, avec ses photos, ses prestations, ses prix et ses heures libres. Même découpage et
 * même rythme que la vidéo de mew3id, sans leurs images. Dessinée sur le téléphone, rien sur un serveur.
 * `bioVideoVersion` change avec ces données : le rond se rallume et la vidéo est refaite.
 */
import { formatDA, formatLocale, weekKeys } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { proProfile, profileJob, profilePhotos } from './proProfile';
import { loadImage } from './storyImage';
import { formatDuration } from './format';
import { t } from '@/i18n';

const W = 720;
const H = 1280;
export const BIO_VIDEO_SIZE = { width: W, height: H };
export const BIO_VIDEO_MS = 27600;

const ACCENT = '#6c5ce7';
const INK = '#1e1b30';
const MUTED = '#636174';
const SUBTLE = '#716f80';
const SOFT = '#f0effe';
const FILL = '#f3f3f8';
const LINE = '#e6e5ee';
const OUTFIT = 'Outfit, Inter, sans-serif';
const INTER = 'Inter, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';
const MONO = 'ui-monospace, Menlo, Consolas, monospace';

/** Le téléphone mesure 390 × 844, comme l'écran pour lequel l'application est dessinée. */
const PW = 390;
const PH = 844;
const BIG = { x: (W - PW * 1.42) / 2, y: 410, s: 1.42 };
const SMALL = { x: (W - PW * 1.02) / 2, y: 344, s: 1.02 };

type Picture = HTMLImageElement | null;
type Day = { label: string; n: string; past: boolean; on: boolean };
export type BioVideoData = {
  salon: string;
  link: string;
  handle: string;
  job: string;
  city: string;
  address: string;
  rating: string;
  initials: string;
  /** Sans validation manuelle, le rendez-vous est pris tout de suite. */
  confirmed: boolean;
  services: { name: string; price: string; meta: string }[];
  picked: { name: string; price: string; meta: string };
  month: string;
  week: Day[];
  dateLong: string;
  hours: string[];
  /** Exemple saisi à l'écran : un prénom courant et un numéro qui n'existe pas. */
  typedName: string;
  typedPhone: string;
  logo: Picture;
  cover: Picture;
  grid: Picture[];
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pretty = (key: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(formatLocale(), { ...o, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/** Sans heure libre ce jour-là, la vidéo montre les heures d'ouverture du salon. */
function openingHours(salon: SalonOwnerView): string[] {
  const day = salon.openingHours.find((h) => !h.isClosed);
  const from = Number(day?.opensAt.slice(0, 2) ?? 9);
  const to = Number(day?.closesAt.slice(0, 2) ?? 18);
  return Array.from({ length: Math.max(1, to - from) }, (_, i) => `${String(from + i).padStart(2, '0')}:00`);
}

/** `date` et `hours` : le jour proposé et ses vraies heures libres. */
export async function loadBioVideo(salon: SalonOwnerView, link: string, date: string, hours: string[], instagram: string | null): Promise<BioVideoData> {
  const active = salon.services.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const services = active.slice(0, 7).map((s) => ({ name: s.name, price: formatDA(s.priceDa), meta: `${formatDA(s.priceDa)} · ${formatDuration(s.durationMinutes)}` }));
  const photos = profilePhotos(salon);
  const [logo, cover, ...grid] = await Promise.all([salon.logoUrl ? loadImage(salon.logoUrl) : null, loadImage(photos[0]!), ...photos.slice(0, 6).map((p) => loadImage(p))]);
  const men = salon.genderTarget === 'men';
  return {
    salon: salon.name,
    link,
    handle: (instagram || salon.slug.replace(/-/g, '')).replace(/^@/, ''),
    job: profileJob(proProfile(salon)),
    city: salon.city,
    address: salon.address ?? salon.city,
    rating: salon.ratingCount ? `${salon.ratingAvg.toFixed(1).replace('.', ',')} (${salon.ratingCount})` : '',
    initials: salon.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    confirmed: salon.autoConfirm,
    services,
    picked: services[0] ?? { name: salon.name, price: '', meta: '' },
    month: pretty(date, { month: 'long', year: 'numeric' }),
    week: weekKeys(date).map((k) => ({
      label: capitalize(pretty(k, { weekday: 'short' }).replace(/\.$/, '')),
      n: String(Number(k.slice(8, 10))),
      past: k < date,
      on: k === date,
    })),
    dateLong: capitalize(pretty(date, { weekday: 'long', day: 'numeric', month: 'long' })),
    hours: (hours.length ? hours : openingHours(salon)).slice(0, 9),
    typedName: men ? 'Yacine' : 'Sarah',
    typedPhone: '0555 00 00 00',
    logo,
    cover,
    grid: grid.filter((x): x is HTMLImageElement => !!x),
  };
}

/** Le lien, la photo et TOUTES les prestations actives : une prestation hors de l'image compte aussi. */
export function bioVideoVersion(salon: SalonOwnerView, link: string): string {
  const services = salon.services
    .filter((s) => s.isActive)
    .map((s) => `${s.id}:${s.name}:${s.priceDa}`)
    .sort();
  return JSON.stringify([link, salon.coverUrl, salon.logoUrl, salon.autoConfirm, services]);
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

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke?: string) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1;
    g.stroke();
  }
}

/** Une ligne de texte, coupée par « … » si elle dépasse. */
function line(g: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', max = 0) {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = align;
  let s = text;
  if (max && g.measureText(s).width > max) {
    while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    s += '…';
  }
  g.fillText(s, x, y);
}

/** La plus grande taille qui tient : un long nom de salon reste entier. */
function shrink(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, max: number): number {
  let px = size;
  g.font = font(px);
  while (px > 24 && g.measureText(text).width > max) {
    px -= 2;
    g.font = font(px);
  }
  return px;
}

function picture(g: CanvasRenderingContext2D, img: Picture, x: number, y: number, w: number, h: number, r = 0) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.clip();
  if (img) {
    const k = Math.max(w / img.width, h / img.height);
    g.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k);
  } else {
    g.fillStyle = ACCENT;
    g.fillRect(x, y, w, h);
  }
  g.restore();
}

function avatar(g: CanvasRenderingContext2D, d: BioVideoData, x: number, y: number, r: number) {
  if (d.logo) {
    picture(g, d.logo, x - r, y - r, r * 2, r * 2, r);
    return;
  }
  g.fillStyle = ACCENT;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  line(g, d.initials, x, y + r * 0.34, `600 ${Math.round(r * 0.9)}px ${OUTFIT}`, '#ffffff', 'center');
}

/* ------------------------------ Les écrans ------------------------------ */

const WEEK_Y = 262;
const HOUR_Y = 372;
const HOUR_W = 114;
const HOUR_H = 46;
const hourAt = (i: number) => ({ x: 16 + (i % 3) * (HOUR_W + 8), y: HOUR_Y + Math.floor(i / 3) * (HOUR_H + 8) });
const NAME_Y = 214;
const PHONE_Y = 304;
const SERVICE_Y = 488;
const SERVICE_H = 78;
const PAGE_SCROLL = 330;

/** Le profil Instagram du salon, avec ses vraies photos. */
function screenInstagram(g: CanvasRenderingContext2D, d: BioVideoData) {
  line(g, '‹', 16, 86, `400 28px ${INTER}`, INK);
  line(g, d.handle, 36, 84, `600 16px ${INTER}`, INK, 'left', 280);
  line(g, '···', 372, 82, `600 18px ${INTER}`, INK, 'right');
  g.strokeStyle = '#e1306c';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(62, 150, 46, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, 62, 150, 40);
  line(g, d.salon, 124, 122, `600 15px ${INTER}`, INK, 'left', 250);
  ['publications', 'followers', 'suivi(e)s'].forEach((x, i) => {
    const px = 124 + i * 90;
    box(g, px, 136, 38, 12, 4, LINE);
    line(g, x, px, 168, `400 12.5px ${INTER}`, INK);
  });
  line(g, `${d.job} · 📍 ${d.city}`, 18, 222, `400 13.5px ${INTER}`, MUTED, 'left', 350);
  line(g, `${t('Réservez en ligne')} 👇`, 18, 243, `400 13.5px ${INTER}`, INK, 'left', 350);
  line(g, `🔗 ${d.link}`, 18, 265, `600 14px ${INTER}`, '#00376b', 'left', 350);
  box(g, 16, 286, 116, 34, 8, '#0095f6');
  line(g, 'Suivre', 74, 308, `600 14px ${INTER}`, '#ffffff', 'center');
  box(g, 138, 286, 116, 34, 8, '#efefef');
  line(g, 'Message', 196, 308, `600 14px ${INTER}`, INK, 'center');
  box(g, 260, 286, 114, 34, 8, '#efefef');
  line(g, 'Contacter', 317, 308, `600 14px ${INTER}`, INK, 'center');
  g.fillStyle = LINE;
  g.fillRect(0, 346, PW, 1);
  g.fillStyle = INK;
  g.fillRect(0, 346, PW / 3, 1.5);
  const size = (PW - 4) / 3;
  for (let i = 0; i < 9; i += 1) {
    const x = (i % 3) * (size + 2);
    const y = 350 + Math.floor(i / 3) * (size + 2);
    if (d.grid.length) picture(g, d.grid[i % d.grid.length]!, x, y, size, size);
    else box(g, x, y, size, size, 0, FILL);
  }
}

const BELL = new Path2D('M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326');

function appHeader(g: CanvasRenderingContext2D) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 44, PW, 50);
  g.fillStyle = INK;
  [62, 69, 76].forEach((y) => g.fillRect(20, y, 18, 2));
  g.textAlign = 'center';
  line(g, 'Salon', 182, 76, `600 18px ${OUTFIT}`, INK, 'center');
  line(g, 'DZ', 224, 76, `600 18px ${OUTFIT}`, SUBTLE, 'center');
  box(g, 348, 54, 28, 28, 14, null, LINE);
  g.save();
  g.translate(354, 60);
  g.scale(0.67, 0.67);
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.stroke(BELL);
  g.restore();
}

/** La page du salon, comme dans l'application. */
function screenPage(g: CanvasRenderingContext2D, d: BioVideoData, scroll: number, pressed: boolean) {
  g.save();
  g.beginPath();
  g.rect(0, 94, PW, PH - 94);
  g.clip();
  g.translate(0, -scroll);
  line(g, t('Prendre RDV'), 64, 122, `600 14px ${OUTFIT}`, INK, 'center');
  line(g, t('Avis'), 195, 122, `500 14px ${OUTFIT}`, MUTED, 'center');
  line(g, t('À propos'), 326, 122, `500 14px ${OUTFIT}`, MUTED, 'center');
  g.fillStyle = ACCENT;
  g.fillRect(0, 134, 130, 2);
  picture(g, d.cover, 0, 136, PW, 170);
  line(g, d.salon, 16, 342, `600 23px ${OUTFIT}`, INK, 'left', 358);
  line(g, d.address, 16, 368, `400 13.5px ${INTER}`, MUTED, 'left', 358);
  if (d.rating) line(g, `★ ${d.rating}`, 16, 390, `600 13.5px ${INTER}`, INK);
  box(g, 16, 404, 174, 40, 12, null, LINE);
  line(g, t('Partager'), 103, 429, `600 13.5px ${OUTFIT}`, ACCENT, 'center');
  box(g, 200, 404, 174, 40, 12, null, LINE);
  line(g, t('Itinéraire'), 287, 429, `600 13.5px ${OUTFIT}`, ACCENT, 'center');
  line(g, t('Choix de la prestation'), 16, 474, `600 18px ${OUTFIT}`, INK);
  d.services.forEach((s, i) => {
    const y = SERVICE_Y + i * SERVICE_H;
    box(g, 16, y, 358, SERVICE_H - 8, 16, '#ffffff', LINE);
    line(g, s.name, 30, y + 30, `600 15px ${OUTFIT}`, INK, 'left', 232);
    line(g, s.meta, 30, y + 52, `400 13px ${INTER}`, MUTED, 'left', 232);
    box(g, 278, y + 17, 84, 36, 18, pressed && i === 0 ? '#4f3fd0' : ACCENT);
    line(g, t('Choisir'), 320, y + 41, `600 14px ${OUTFIT}`, '#ffffff', 'center');
  });
  g.restore();
}

function stepHead(g: CanvasRenderingContext2D, title: string, step: string) {
  box(g, 16, 108, 34, 34, 17, '#ffffff', LINE);
  line(g, '‹', 33, 133, `400 24px ${INTER}`, INK, 'center');
  line(g, title, 62, 134, `600 21px ${OUTFIT}`, INK);
  line(g, step, 374, 131, `400 13px ${INTER}`, MUTED, 'right');
}

function bottomPanel(g: CanvasRenderingContext2D) {
  box(g, 0, 730, PW, 120, 24, '#ffffff', LINE);
  box(g, 174, 740, 42, 4, 2, LINE);
}

/** « Quand ? » : le jour, puis l'heure. */
function screenWhen(g: CanvasRenderingContext2D, d: BioVideoData, dayOn: boolean, hour: number) {
  stepHead(g, t('Quand ?'), t('Étape 1 sur 3'));
  box(g, 16, 156, 358, 60, 16, '#ffffff', LINE);
  avatar(g, d, 46, 186, 20);
  line(g, d.salon, 78, 182, `600 14px ${OUTFIT}`, INK, 'left', 280);
  line(g, d.picked.meta ? `${d.picked.name} · ${d.picked.price}` : d.picked.name, 78, 202, `400 12.5px ${INTER}`, MUTED, 'left', 280);
  line(g, d.month, 16, 246, `600 14px ${OUTFIT}`, MUTED);
  const w = 358 / 7;
  d.week.forEach((x, i) => {
    const cx = 16 + i * w + w / 2;
    const on = dayOn && x.on;
    if (on) box(g, cx - 22, WEEK_Y, 44, 56, 14, INK);
    line(g, x.label, cx, WEEK_Y + 22, `500 11px ${INTER}`, on ? '#ffffff' : SUBTLE, 'center');
    line(g, x.n, cx, WEEK_Y + 45, `600 17px ${OUTFIT}`, on ? '#ffffff' : x.past ? '#c8c7d2' : INK, 'center');
  });
  if (dayOn) {
    line(g, Number(d.hours[0]!.slice(0, 2)) < 12 ? t('Matin') : t('Après-midi'), 16, 354, `600 14px ${OUTFIT}`, INK);
    d.hours.forEach((x, i) => {
      const p = hourAt(i);
      const on = i === hour;
      box(g, p.x, p.y, HOUR_W, HOUR_H, 12, on ? ACCENT : '#ffffff', on ? undefined : LINE);
      line(g, x, p.x + HOUR_W / 2, p.y + 29, `600 14px ${OUTFIT}`, on ? '#ffffff' : INK, 'center');
    });
  }
  bottomPanel(g);
  box(g, 16, 760, 358, 48, 14, hour >= 0 ? ACCENT : FILL);
  line(g, hour >= 0 ? `${t('Continuer')} · ${d.hours[hour]}` : t('Choisissez un créneau'), 195, 790, `600 15px ${OUTFIT}`, hour >= 0 ? '#ffffff' : SUBTLE, 'center');
}

/** « Pour qui ? » : le nom et le numéro, saisis à l'écran. */
function screenWho(g: CanvasRenderingContext2D, d: BioVideoData, name: string, phone: string, focus: 'name' | 'phone' | null, caret: boolean, ready: boolean) {
  stepHead(g, t('Pour qui ?'), t('Étape 2 sur 3'));
  box(g, 16, 154, 358, 40, 12, FILL);
  box(g, 20, 158, 175, 32, 10, INK);
  line(g, t('Pour moi'), 107, 179, `600 13.5px ${OUTFIT}`, '#ffffff', 'center');
  line(g, t('Pour quelqu’un d’autre'), 284, 179, `600 13px ${OUTFIT}`, MUTED, 'center', 165);
  const field = (label: string, y: number, value: string, hint: string, on: boolean) => {
    line(g, label, 16, y - 8, `600 13.5px ${OUTFIT}`, INK);
    box(g, 16, y, 358, 50, 14, '#ffffff', on ? ACCENT : LINE);
    line(g, value || hint, 32, y + 31, `400 16px ${INTER}`, value ? INK : '#a9a8b6');
    if (on && caret) {
      g.font = `400 16px ${INTER}`;
      g.fillStyle = ACCENT;
      g.fillRect(32 + g.measureText(value).width + 1, y + 15, 1.5, 21);
    }
  };
  field(t('Votre nom'), NAME_Y, name, t('Prénom et nom'), focus === 'name');
  field(t('Numéro de téléphone'), PHONE_Y, phone, t('Votre numéro'), focus === 'phone');
  bottomPanel(g);
  line(g, d.picked.price, 16, 778, `600 20px ${OUTFIT}`, INK);
  line(g, `${d.dateLong} · ${d.hours[Math.min(2, d.hours.length - 1)]}`, 16, 800, `400 12.5px ${INTER}`, MUTED, 'left', 240);
  box(g, 270, 760, 104, 48, 24, ready ? ACCENT : FILL);
  line(g, t('Vérifier'), 322, 790, `600 15px ${OUTFIT}`, ready ? '#ffffff' : SUBTLE, 'center');
}

/** La confirmation, avec la coche qui se dessine. */
function screenDone(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  const k = out(ms / 450);
  g.fillStyle = ACCENT;
  g.beginPath();
  g.arc(195, 190, 38 * k, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const c = clamp((ms - 250) / 300);
  g.beginPath();
  g.moveTo(178, 191);
  if (c > 0) g.lineTo(mix(178, 190, clamp(c * 2)), mix(191, 203, clamp(c * 2)));
  if (c > 0.5) g.lineTo(mix(190, 213, (c - 0.5) * 2), mix(203, 178, (c - 0.5) * 2));
  g.stroke();
  g.lineCap = 'butt';
  line(g, d.confirmed ? t('Rendez-vous confirmé') : t('Demande envoyée'), 195, 272, `600 23px ${OUTFIT}`, INK, 'center', 350);
  line(g, d.salon, 195, 298, `400 14px ${INTER}`, MUTED, 'center', 350);
  box(g, 16, 330, 358, 216, 18, '#ffffff', LINE);
  [
    [t('Prestation'), d.picked.name],
    [t('Date'), d.dateLong],
    [t('Heure'), d.hours[Math.min(2, d.hours.length - 1)] ?? ''],
    [t('Total'), d.picked.price],
  ].forEach(([a, b], i) => {
    line(g, a!, 34, 376 + i * 48, `400 14px ${INTER}`, MUTED);
    line(g, b!, 356, 376 + i * 48, `600 14px ${OUTFIT}`, INK, 'right', 220);
  });
  box(g, 16, 760, 358, 48, 14, ACCENT);
  line(g, t('Voir le rendez-vous'), 195, 790, `600 15px ${OUTFIT}`, '#ffffff', 'center');
}

/* ------------------------------ Le montage ------------------------------ */

/** La main : où elle est, et quand elle touche. Coordonnées de l'écran du téléphone. */
const dayX = (d: BioVideoData) => 16 + (358 / 7) * (Math.max(0, d.week.findIndex((x) => x.on)) + 0.5);
function handPath(d: BioVideoData): [number, number, number][] {
  const pick = Math.min(2, d.hours.length - 1);
  const p = hourAt(pick);
  return [
    [1200, 300, 640],
    [2000, 190, 262],
    [2750, 190, 262],
    [3000, 300, 640],
    [5200, 300, 620],
    [5700, 320, SERVICE_Y + 35 - PAGE_SCROLL],
    [6150, 320, SERVICE_Y + 35 - PAGE_SCROLL],
    [6500, 300, 520],
    [7200, dayX(d), WEEK_Y + 32],
    [7900, dayX(d), WEEK_Y + 32],
    [9400, p.x + HOUR_W / 2, p.y + 24],
    [10200, p.x + HOUR_W / 2, p.y + 24],
    [11200, 195, 784],
    [11900, 195, 784],
    [12400, 300, 500],
    [13200, 150, NAME_Y + 26],
    [13800, 150, NAME_Y + 26],
    [15200, 150, PHONE_Y + 26],
    [15800, 150, PHONE_Y + 26],
    [17800, 322, 784],
    [18700, 322, 784],
    [19300, 300, 600],
    [22800, 300, 600],
    [23300, 195, 784],
    [23900, 195, 784],
  ];
}
const TAPS = [2450, 5950, 7600, 9900, 11650, 13550, 15550, 18400, 23650];

/** Une main dessinée, pour que le geste se lise sans le doigt de personne. */
const HAND = new Path2D('M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 14V4a2 2 0 0 1 4 0v5.5V9a2 2 0 0 1 4 0v1v0a2 2 0 0 1 4 0z');

function drawHand(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const keys = handPath(d);
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (ms < first[0] || ms > last[0] + 200) return;
  let x = last[1];
  let y = last[2];
  for (let i = 0; i + 1 < keys.length; i += 1) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (ms >= a[0] && ms <= b[0]) {
      const k = ease((ms - a[0]) / (b[0] - a[0]));
      x = mix(a[1], b[1], k);
      y = mix(a[2], b[2], k);
      break;
    }
  }
  const tap = TAPS.find((v) => ms >= v - 120 && ms <= v + 500);
  if (tap !== undefined) {
    const k = clamp((ms - tap) / 500);
    g.strokeStyle = `rgba(108,92,231,${0.55 * (1 - k)})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 8 + k * 30, 0, Math.PI * 2);
    g.stroke();
  }
  const press = tap !== undefined && Math.abs(ms - tap) < 110 ? 0.9 : 1;
  g.save();
  g.translate(x - 16 * press, y - 4 * press);
  g.scale(2.3 * press, 2.3 * press);
  g.fillStyle = '#ffffff';
  g.fill(HAND);
  g.strokeStyle = INK;
  g.lineWidth = 0.95;
  g.lineJoin = 'round';
  g.stroke(HAND);
  g.restore();
}

function phoneFrame(g: CanvasRenderingContext2D, x: number, y: number, s: number, draw: () => void, overlay: () => void) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.shadowColor = 'rgba(30,27,48,.16)';
  g.shadowBlur = 50;
  g.shadowOffsetY = 18;
  box(g, -11, -11, PW + 22, PH + 22, 58, '#14121f');
  g.shadowColor = 'transparent';
  g.save();
  g.beginPath();
  g.roundRect(0, 0, PW, PH, 46);
  g.clip();
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, PW, PH);
  draw();
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, PW, 44);
  line(g, '9:41', 60, 31, `600 15px ${INTER}`, INK, 'center');
  box(g, 136, 11, 118, 30, 15, '#000000');
  [5, 8, 11, 14].forEach((h, i) => box(g, 318 + i * 5, 29 - h, 3, h, 1, INK));
  box(g, 342, 18, 24, 12, 3, INK);
  g.restore();
  overlay();
  g.restore();
}

type Title = { from: number; note: string; a: string; b: string; c: string };
function titles(d: BioVideoData): Title[] {
  return [
    { from: 0, note: `instagram · @${d.handle}`, a: t('Réserver chez'), b: '', c: `${d.salon} ?` },
    { from: 3000, note: d.link, a: t('Le lien de'), b: t('notre'), c: t('bio.') },
    { from: 4600, note: t('étape 1 sur 3'), a: t('Choisissez'), b: t('votre'), c: t('prestation.') },
    { from: 6400, note: t('étape 2 sur 3'), a: t('Le jour,'), b: t('puis l’'), c: t('heure.') },
    { from: 12000, note: t('étape 3 sur 3'), a: t('Votre nom,'), b: t('votre'), c: t('numéro.') },
    d.confirmed
      ? { from: 19000, note: t('rendez-vous confirmé'), a: t('Et voilà.'), b: t("C'est"), c: t('réservé.') }
      : { from: 19000, note: t('demande envoyée'), a: t('Et voilà.'), b: t('On vous'), c: t('confirme.') },
  ];
}

function drawTitle(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const list = titles(d);
  const title = [...list].reverse().find((x) => ms >= x.from)!;
  const k = ms - title.from;
  line(g, `// ${title.note}`, 48, 110, `400 19px ${MONO}`, SUBTLE, 'left', 620);
  const first = out(k / 350);
  g.save();
  g.globalAlpha = first;
  g.translate(0, (1 - first) * 18);
  line(g, title.a, 46, 190, `700 62px ${OUTFIT}`, INK, 'left', 630);
  g.restore();
  const second = out((k - 220) / 400);
  g.save();
  g.globalAlpha = second;
  g.translate(0, (1 - second) * 18);
  let x = 46;
  if (title.b) {
    line(g, title.b, x, 266, `500 56px ${OUTFIT}`, SUBTLE);
    x += g.measureText(title.b).width + (title.b.endsWith('’') ? 2 : 14);
  }
  const serif = (px: number) => `italic 400 ${px}px ${SERIF}`;
  line(g, title.c, x, 266, serif(shrink(g, title.c, serif, 74, W - x - 40)), ACCENT);
  g.restore();
}

function typed(text: string, ms: number, from: number, to: number) {
  return text.slice(0, Math.round(text.length * clamp((ms - from) / (to - from))));
}

function drawScreen(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const hour = Math.min(2, d.hours.length - 1);
  // Le profil, puis la page du salon qui monte par-dessus.
  if (ms < 6400) {
    if (ms < 3100) screenInstagram(g, d);
    if (ms >= 2650) {
      g.save();
      g.translate(0, (1 - out((ms - 2650) / 420)) * PH);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 44, PW, PH);
      appHeader(g);
      screenPage(g, d, ease((ms - 4300) / 1100) * PAGE_SCROLL, ms > 5840 && ms < 6100);
      g.restore();
    }
    return;
  }
  // Les étapes glissent de droite à gauche, comme dans l'application.
  const steps: [number, () => void][] = [
    [6400, () => screenWhen(g, d, ms > 7640, ms > 9940 ? hour : -1)],
    [12000, () => screenWho(g, d, typed(d.typedName, ms, 13750, 14900), typed(d.typedPhone, ms, 15750, 17400), ms < 13560 ? null : ms < 15560 ? 'name' : ms < 17600 ? 'phone' : null, Math.floor(ms / 450) % 2 === 0, ms > 17450)],
    [19000, () => screenDone(g, d, ms - 19000)],
  ];
  const i = steps.reduce((a, s, n) => (ms >= s[0] ? n : a), 0);
  const k = out((ms - steps[i]![0]) / 340);
  appHeader(g);
  if (i > 0 && k < 1) {
    g.save();
    g.translate(-k * PW, 0);
    steps[i - 1]![1]();
    g.restore();
  }
  g.save();
  g.translate(i > 0 ? (1 - k) * PW : 0, 0);
  if (i > 0 && k < 1) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 94, PW, PH);
  }
  steps[i]![1]();
  g.restore();
}

/** La fin : le nom, le temps qu'il faut, et où trouver le lien. */
function drawEnd(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const a = out(ms / 450);
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = ACCENT;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(W / 2, 330 + (1 - a) * 30, 96, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, W / 2, 330 + (1 - a) * 30, 86);
  g.restore();
  const b = out((ms - 300) / 450);
  g.globalAlpha = b;
  const bold = (px: number) => `700 ${px}px ${OUTFIT}`;
  line(g, d.salon, W / 2, 530, bold(shrink(g, d.salon, bold, 66, 640)), INK, 'center');
  g.globalAlpha = out((ms - 650) / 450);
  g.font = `500 42px ${OUTFIT}`;
  const left = `${t('Réservez en')} `;
  const lw = g.measureText(left).width;
  g.font = `italic 400 58px ${SERIF}`;
  const rw = g.measureText(t('30 secondes.')).width;
  const x = (W - lw - rw) / 2;
  line(g, left, x, 610, `500 42px ${OUTFIT}`, SUBTLE);
  line(g, t('30 secondes.'), x + lw, 610, `italic 400 58px ${SERIF}`, ACCENT);
  g.globalAlpha = out((ms - 1100) / 450);
  box(g, W / 2 - 200, 780, 400, 76, 38, ACCENT);
  line(g, `👆 ${t('Lien dans notre bio')}`, W / 2, 829, `600 28px ${OUTFIT}`, '#ffffff', 'center', 360);
  line(g, d.link, W / 2, 900, `400 24px ${MONO}`, INK, 'center', 640);
  g.globalAlpha = out((ms - 1500) / 450);
  line(g, `${t('réservation en ligne')} · Salon DZ`, W / 2, 1120, `400 19px ${MONO}`, SUBTLE, 'center');
  g.globalAlpha = 1;
}

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, at: number, d: BioVideoData) {
  const ms = Math.max(0, at);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  if (ms >= 24000) {
    drawEnd(g, ms - 24000, d);
    return;
  }
  // Le papier quadrillé, très léger.
  g.fillStyle = '#f4f3fa';
  for (let x = 40; x < W; x += 60) g.fillRect(x, 0, 1, H);
  for (let y = 40; y < H; y += 60) g.fillRect(0, y, W, 1);

  const f = Math.floor(ms / 1000);
  const code = `00:00:${String(f).padStart(2, '0')}:${String(Math.floor((ms % 1000) / 33.34)).padStart(2, '0')}`;
  line(g, `// ${t('comment réserver')}`, 48, 66, `400 19px ${MONO}`, SUBTLE);
  line(g, code, W - 48, 66, `400 19px ${MONO}`, SUBTLE, 'right');
  drawTitle(g, ms, d);

  // Le téléphone arrive de loin, se rapproche du profil, puis recule pour laisser voir tout l'écran.
  const come = out(ms / 800);
  const back = ease((ms - 2750) / 500);
  const s = mix(mix(0.9, BIG.s, come), SMALL.s, back);
  const y = mix(mix(760, BIG.y, come), SMALL.y, back);
  phoneFrame(g, (W - PW * s) / 2, y, s, () => drawScreen(g, ms, d), () => drawHand(g, ms, d));
}
