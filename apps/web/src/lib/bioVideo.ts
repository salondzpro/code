/**
 * « MA VIDÉO » — comment réserver chez ce professionnel, à publier sur ses réseaux.
 *
 * REFONTE DU 16 NOV. 2026 (demande du propriétaire : « au nouveau thème Apple / Uber, rapide, un clic
 * de souris sur chaque bouton pour que ses clientes comprennent tout de suite ») :
 *   - 14,5 s au lieu de 27,6 : une ouverture au nom du salon, trois étapes, la confirmation, la fin ;
 *   - les écrans sont ceux de l'application AUJOURD'HUI (page du salon avec note dorée et « + Choisir »,
 *     « Quand ? » avec ses créneaux cerclés, récapitulatif, confirmation verte), avec les vraies photos,
 *     prestations, prix et heures libres du salon ;
 *   - un CURSEUR MAIN (blanc, contour noir, ombre) vient sur chaque bouton et CLIQUE : le bouton
 *     s'enfonce, une onde et trois éclats partent du doigt — on voit où toucher ;
 *   - au-dessus du téléphone, l'étape en grand (« 1 sur 3 · Choisissez la prestation »…) ;
 *   - la fin rappelle le lien, que le curseur vient cliquer une dernière fois.
 * Dessinée sur le téléphone du pro, rien sur un serveur. `bioVideoVersion` change avec les données ET
 * avec `DESIGN` : un nouveau dessin refait la vidéo déjà préparée.
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
export const BIO_VIDEO_MS = 14500;
/** Change à chaque nouveau dessin : la vidéo préparée et gardée sur l'appareil est refaite. */
const DESIGN = 2;

// Charte actuelle (docs/CHARTE.md) : encre, gris, fond, vert de « oui », étoile dorée.
const INK = '#111111';
const MUTED = '#6e6e76';
const SUBTLE = '#8e8e93';
const BG = '#f7f7f9';
const FILL = '#ececf0';
const LINE = '#e6e6ea';
const GREEN = '#34c759';
const GOLD = '#f5a623';
const FONT = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
const f = (w: number, px: number) => `${w} ${px}px ${FONT}`;

/** Le téléphone mesure 390 × 844, comme l'écran pour lequel l'application est dessinée. */
const PW = 390;
const PH = 844;
const PHONE = { x: (W - PW) / 2, y: 372, s: 1 };

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
  /** Exemple affiché à l'écran : un prénom courant, jamais une vraie cliente. */
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
  const services = active.slice(0, 4).map((s) => ({ name: s.name, price: formatDA(s.priceDa), meta: formatDuration(s.durationMinutes) }));
  const photos = profilePhotos(salon);
  const [logo, cover, ...grid] = await Promise.all([salon.logoUrl ? loadImage(salon.logoUrl) : null, loadImage(photos[0]!), ...photos.slice(0, 3).map((p) => loadImage(p))]);
  const men = salon.genderTarget === 'men';
  return {
    salon: salon.name,
    link,
    handle: (instagram || salon.slug.replace(/-/g, '')).replace(/^@/, ''),
    job: profileJob(proProfile(salon)),
    city: salon.city,
    // Quartier et ville, sans doublon (« Hydra, Hydra » quand les deux portent le même nom).
    address: [...new Set([salon.zone, salon.city].filter(Boolean))].join(', ') || salon.city,
    rating: salon.ratingCount ? `${salon.ratingAvg.toFixed(1).replace('.', ',')} (${salon.ratingCount})` : '',
    initials: salon.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    confirmed: salon.autoConfirm,
    services,
    picked: services[0] ?? { name: salon.name, price: '', meta: '' },
    month: capitalize(pretty(date, { month: 'long', year: 'numeric' })),
    week: weekKeys(date).map((k) => ({
      label: capitalize(pretty(k, { weekday: 'short' }).replace(/\.$/, '')),
      n: String(Number(k.slice(8, 10))),
      past: k < date,
      on: k === date,
    })),
    dateLong: capitalize(pretty(date, { weekday: 'long', day: 'numeric', month: 'long' })),
    hours: (hours.length ? hours : openingHours(salon)).slice(0, 6),
    typedName: men ? 'Yacine B.' : 'Sarah K.',
    typedPhone: '0555 00 00 00',
    logo,
    cover,
    grid: grid.filter((x): x is HTMLImageElement => !!x),
  };
}

/** Le lien, la photo, TOUTES les prestations actives, et le dessin : la vidéo est refaite si l'un change. */
export function bioVideoVersion(salon: SalonOwnerView, link: string): string {
  const services = salon.services
    .filter((s) => s.isActive)
    .map((s) => `${s.id}:${s.name}:${s.priceDa}`)
    .sort();
  return JSON.stringify([DESIGN, link, salon.coverUrl, salon.logoUrl, salon.autoConfirm, salon.ratingCount, services]);
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

/* ------------------------------ Outils de dessin ------------------------------ */

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
/** Arrivée avec un léger dépassement (ressort) : l'élément « se pose ». */
const spring = (x: number) => {
  const k = clamp(x);
  return 1 + 1.6 * Math.pow(k - 1, 3) + 0.6 * Math.pow(k - 1, 2);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke?: string, lw = 1) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

/** Carte blanche à ombre légère, comme les cartes de l'application. */
function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 18) {
  g.save();
  g.shadowColor = 'rgba(17,17,17,.07)';
  g.shadowBlur = 14;
  g.shadowOffsetY = 3;
  box(g, x, y, w, h, r, '#ffffff');
  g.restore();
}

/** Une ligne de texte, coupée par « … » si elle dépasse. Rend la largeur dessinée. */
function line(g: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', max = 0): number {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = align;
  let s = text;
  if (max && g.measureText(s).width > max) {
    while (s.length > 1 && g.measureText(`${s}…`).width > max) s = s.slice(0, -1);
    s += '…';
  }
  g.fillText(s, x, y);
  return g.measureText(s).width;
}

/** La plus grande taille qui tient : un long nom de salon reste entier. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number): number {
  let px = size;
  g.font = f(weight, px);
  while (px > 22 && g.measureText(text).width > max) {
    px -= 2;
    g.font = f(weight, px);
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
    g.fillStyle = FILL;
    g.fillRect(x, y, w, h);
  }
  g.restore();
}

function avatar(g: CanvasRenderingContext2D, d: BioVideoData, x: number, y: number, r: number) {
  if (d.logo) {
    picture(g, d.logo, x - r, y - r, r * 2, r * 2, r);
    return;
  }
  if (d.cover) {
    picture(g, d.cover, x - r, y - r, r * 2, r * 2, r);
    return;
  }
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  line(g, d.initials, x, y + r * 0.34, f(600, Math.round(r * 0.9)), '#ffffff', 'center');
}

/** Étoile pleine à cinq branches, dorée. */
function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = GOLD;
  g.fill();
}

/** Le repère de lieu (épingle), au trait. */
function pin(g: CanvasRenderingContext2D, x: number, y: number) {
  g.strokeStyle = MUTED;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y - 3, 5, Math.PI * 0.85, Math.PI * 2.15);
  g.lineTo(x, y + 6);
  g.closePath();
  g.stroke();
}

/** « Appuyé » : un bouton qu'on vient de cliquer s'enfonce un instant. */
const pressedAt = (ms: number, tap: number) => Math.abs(ms - tap) < 160;
function pressScale(g: CanvasRenderingContext2D, cx: number, cy: number, on: boolean) {
  if (!on) return;
  g.translate(cx, cy);
  g.scale(0.94, 0.94);
  g.translate(-cx, -cy);
}

/* ------------------------------ Le minutage ------------------------------ */

/** Les quatre écrans et la fin. */
const T = {
  phoneIn: 1100,
  stepWhen: 3800,
  stepRecap: 7600,
  done: 9300,
  end: 10900,
};
/** Les clics (curseur), dans l'ordre : Choisir, le jour, l'heure, Continuer, Confirmer, le lien de fin. */
const TAP = { choose: 3100, day: 4700, hour: 5900, next: 7000, confirm: 8800, link: 13200 };

/* ------------------------------ Les écrans ------------------------------ */

const SERVICE_Y = 446;
const SERVICE_H = 84;
const WEEK_Y = 236;
const HOUR_Y = 360;
const HOUR_W = 114;
const HOUR_H = 48;
const hourAt = (i: number) => ({ x: 16 + (i % 3) * (HOUR_W + 8), y: HOUR_Y + Math.floor(i / 3) * (HOUR_H + 10) });
const dayX = (d: BioVideoData) => 16 + (358 / 7) * (Math.max(0, d.week.findIndex((x) => x.on)) + 0.5);
const PICK_HOUR = (d: BioVideoData) => Math.min(1, d.hours.length - 1);
const BTN_Y = 770;

/** Rond blanc à ombre légère (retour, partager, favori). */
function roundBtn(g: CanvasRenderingContext2D, cx: number, cy: number, draw: () => void) {
  g.save();
  g.shadowColor = 'rgba(17,17,17,.08)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 2;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy, 19, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 1.8;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw();
  g.restore();
}
const chevronLeft = (g: CanvasRenderingContext2D, cx: number, cy: number) => {
  g.beginPath();
  g.moveTo(cx + 3, cy - 6);
  g.lineTo(cx - 3, cy);
  g.lineTo(cx + 3, cy + 6);
  g.stroke();
};

/** 1 · La page du salon : photo, nom et note dorée, adresse, prestations avec « + Choisir ». */
function screenSalon(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = BG;
  g.fillRect(0, 0, PW, PH);
  roundBtn(g, 36, 74, () => chevronLeft(g, 36, 74));
  line(g, d.salon, 66, 80, f(600, 16), INK, 'left', 200);
  roundBtn(g, 306, 74, () => {
    [[-5, 0], [5, -6], [5, 6]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(306 + x!, 74 + y!, 2.6, 0, Math.PI * 2);
      g.stroke();
    });
    g.beginPath();
    g.moveTo(303, 72);
    g.lineTo(309, 69);
    g.moveTo(303, 76);
    g.lineTo(309, 79);
    g.stroke();
  });
  roundBtn(g, 352, 74, () => {
    g.beginPath();
    g.moveTo(352, 81);
    g.bezierCurveTo(340, 72, 344, 64, 352, 70);
    g.bezierCurveTo(360, 64, 364, 72, 352, 81);
    g.stroke();
  });
  [t('Prendre RDV'), t('Avis'), t('À propos')].forEach((x, i) => line(g, x, 65 + i * 130, 124, f(i ? 500 : 600, 14), i ? MUTED : INK, 'center'));
  g.fillStyle = INK;
  g.fillRect(0, 136, 130, 2.5);
  picture(g, d.cover, 0, 140, PW, 176);
  // Nom + note dorée sur la même ligne.
  line(g, d.salon, 16, 352, f(700, 22), INK, 'left', d.rating ? 250 : 358);
  g.font = f(500, 14);
  const note = d.rating || t('Nouveau');
  const nw = g.measureText(note).width;
  star(g, PW - 16 - nw - 12, 346, 8);
  line(g, note, PW - 16, 351, f(d.rating ? 600 : 500, 14), d.rating ? INK : MUTED, 'right');
  pin(g, 22, 376);
  line(g, d.address, 34, 381, f(400, 14), INK, 'left', 330);
  line(g, t('Choix de la prestation'), 16, 422, f(700, 18), INK);
  d.services.slice(0, 4).forEach((s, i) => {
    const y = SERVICE_Y + i * SERVICE_H;
    card(g, 16, y, 358, SERVICE_H - 10, 18);
    line(g, s.name, 32, y + 31, f(600, 15.5), INK, 'left', 210);
    const pw = line(g, s.price, 32, y + 54, f(600, 13.5), INK);
    line(g, ` · ${s.meta}`, 32 + pw, y + 54, f(400, 13.5), MUTED);
    g.save();
    pressScale(g, 318, y + 37, i === 0 && pressedAt(ms, TAP.choose));
    box(g, 268, y + 17, 96, 40, 20, i === 0 && ms > TAP.choose ? '#3a3a3c' : INK);
    line(g, `+  ${t('Choisir')}`, 316, y + 42, f(600, 14), '#ffffff', 'center');
    g.restore();
  });
}

function stepHead(g: CanvasRenderingContext2D, title: string) {
  g.fillStyle = BG;
  g.fillRect(0, 0, PW, PH);
  roundBtn(g, 36, 74, () => chevronLeft(g, 36, 74));
  line(g, title, PW / 2, 81, f(700, 18), INK, 'center');
}

/** Le panneau du bas et son bouton principal noir. */
function bottomButton(g: CanvasRenderingContext2D, label: string, on: boolean, pressed: boolean) {
  g.save();
  g.shadowColor = 'rgba(17,17,17,.08)';
  g.shadowBlur = 18;
  g.shadowOffsetY = -4;
  box(g, 0, 740, PW, 120, 26, '#ffffff');
  g.restore();
  g.save();
  pressScale(g, PW / 2, BTN_Y + 26, pressed);
  box(g, 16, BTN_Y, 358, 52, 26, on ? INK : FILL);
  line(g, label, PW / 2, BTN_Y + 33, f(600, 16), on ? '#ffffff' : SUBTLE, 'center', 320);
  g.restore();
}

/** 2 · « Quand ? » : le jour, puis l'heure, puis Continuer. */
function screenWhen(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  stepHead(g, t('Quand ?'));
  card(g, 16, 112, 358, 64, 18);
  avatar(g, d, 46, 144, 18);
  line(g, d.picked.name, 74, 140, f(600, 14.5), INK, 'left', 210);
  line(g, `${d.picked.price} · ${d.picked.meta}`, 74, 160, f(400, 12.5), MUTED, 'left', 210);
  line(g, d.month, 16, 218, f(600, 14), MUTED);
  const dayOn = ms > TAP.day;
  const w = 358 / 7;
  d.week.forEach((x, i) => {
    const cx = 16 + i * w + w / 2;
    const on = dayOn && x.on;
    g.save();
    pressScale(g, cx, WEEK_Y + 30, x.on && pressedAt(ms, TAP.day));
    if (on) box(g, cx - 22, WEEK_Y, 44, 60, 16, INK);
    line(g, x.label, cx, WEEK_Y + 24, f(500, 11.5), on ? '#ffffff' : SUBTLE, 'center');
    line(g, x.n, cx, WEEK_Y + 47, f(700, 17), on ? '#ffffff' : x.past ? '#c8c8ce' : INK, 'center');
    g.restore();
  });
  if (dayOn) {
    const a = out((ms - TAP.day) / 350);
    g.save();
    g.globalAlpha = a;
    g.translate(0, (1 - a) * 12);
    line(g, Number(d.hours[0]!.slice(0, 2)) < 12 ? t('Matin') : t('Après-midi'), 16, 340, f(700, 15), INK);
    const pick = PICK_HOUR(d);
    d.hours.forEach((x, i) => {
      const p = hourAt(i);
      const on = ms > TAP.hour && i === pick;
      g.save();
      pressScale(g, p.x + HOUR_W / 2, p.y + HOUR_H / 2, i === pick && pressedAt(ms, TAP.hour));
      box(g, p.x, p.y, HOUR_W, HOUR_H, 14, on ? INK : '#ffffff', on ? undefined : INK, 1.5);
      line(g, x, p.x + HOUR_W / 2, p.y + 31, f(600, 16), on ? '#ffffff' : INK, 'center');
      g.restore();
    });
    g.restore();
  }
  const ready = ms > TAP.hour;
  bottomButton(g, ready ? `${t('Continuer')} · ${d.hours[PICK_HOUR(d)]}` : t('Choisissez un créneau'), ready, pressedAt(ms, TAP.next));
}

/** 3 · Récapitulatif : quand, quoi, pour qui — puis « Confirmer ». */
function screenRecap(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  stepHead(g, t('Récapitulatif'));
  card(g, 16, 112, 358, 236, 20);
  avatar(g, d, 44, 146, 18);
  line(g, d.salon, 72, 142, f(600, 15), INK, 'left', 280);
  line(g, d.address, 72, 161, f(400, 12.5), MUTED, 'left', 280);
  g.fillStyle = LINE;
  g.fillRect(32, 184, 326, 1);
  line(g, d.dateLong, 32, 214, f(600, 15), INK, 'left', 230);
  line(g, d.hours[PICK_HOUR(d)] ?? '', 358, 220, f(700, 28), INK, 'right');
  g.fillStyle = LINE;
  g.fillRect(32, 240, 326, 1);
  line(g, d.picked.name, 32, 272, f(600, 15), INK, 'left', 220);
  line(g, d.picked.meta, 32, 293, f(400, 13), MUTED);
  line(g, d.picked.price, 358, 276, f(700, 16), INK, 'right');
  line(g, t('Paiement sur place'), 32, 330, f(400, 12.5), MUTED);
  card(g, 16, 364, 358, 64, 18);
  line(g, t('Pour moi'), 32, 392, f(400, 12.5), MUTED);
  line(g, d.typedName, 32, 414, f(600, 15), INK);
  bottomButton(g, t('Confirmer le rendez-vous'), true, pressedAt(ms, TAP.confirm));
}

/** 4 · Confirmation : la pastille verte se pose, la coche se dessine. */
function screenDone(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = BG;
  g.fillRect(0, 0, PW, PH);
  const k = spring(ms / 520);
  g.fillStyle = 'rgba(52,199,89,.14)';
  g.beginPath();
  g.arc(195, 230, 70 * clamp(ms / 420), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(195, 230, 46 * k, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const c = clamp((ms - 260) / 320);
  g.beginPath();
  g.moveTo(175, 231);
  if (c > 0) g.lineTo(mix(175, 189, clamp(c * 2)), mix(231, 245, clamp(c * 2)));
  if (c > 0.5) g.lineTo(mix(189, 217, (c - 0.5) * 2), mix(245, 215, (c - 0.5) * 2));
  g.stroke();
  g.lineCap = 'butt';
  const a = out((ms - 300) / 400);
  g.globalAlpha = a;
  line(g, d.confirmed ? t('Rendez-vous confirmé') : t('Demande envoyée'), 195, 330, f(700, 23), INK, 'center', 350);
  line(g, `${d.dateLong} · ${d.hours[PICK_HOUR(d)] ?? ''}`, 195, 358, f(400, 14), MUTED, 'center', 350);
  card(g, 16, 390, 358, 84, 18);
  avatar(g, d, 50, 432, 20);
  line(g, d.salon, 82, 427, f(600, 15), INK, 'left', 270);
  line(g, `${d.picked.name} · ${d.picked.price}`, 82, 448, f(400, 13), MUTED, 'left', 270);
  g.globalAlpha = 1;
}

/* ------------------------------ Le curseur ------------------------------ */

/**
 * Curseur MAIN (index levé), comme le curseur d'un ordinateur : blanc, contour noir épais, ombre grise
 * décalée. La pointe de l'index est en (8,1) dans un dessin de 24 × 24.
 */
const HAND = new Path2D(
  'M8 1.2c1.2 0 2.1.9 2.1 2.1v6.2c.4-.6 1-.9 1.8-.9 1.1 0 2 .8 2.1 1.9.4-.5 1-.8 1.7-.8 1.1 0 2 .8 2.1 1.9.4-.4.9-.6 1.5-.6 1.2 0 2.1.9 2.1 2.1v3.6c0 3.9-2.9 6.9-6.8 6.9h-2.3c-2.2 0-3.6-.7-5-2.2l-4-4.3c-.8-.9-.8-2.2.1-3 .9-.8 2.2-.7 3 .1l1.5 1.6V3.3c0-1.2.9-2.1 2.1-2.1z',
);
const FINGERS = new Path2D('M10.1 9.5v3.4M14 10.4v2.7M17.8 11.5v2');

/** Images clés du curseur, en coordonnées de l'écran du téléphone : [ms, x, y]. */
function cursorPath(d: BioVideoData): [number, number, number][] {
  const p = hourAt(PICK_HOUR(d));
  const choose = { x: 316, y: SERVICE_Y + 37 };
  return [
    [1700, 360, 900],
    [2700, choose.x, choose.y],
    [TAP.choose + 250, choose.x, choose.y],
    [TAP.day - 500, dayX(d), WEEK_Y + 32],
    [TAP.day + 200, dayX(d), WEEK_Y + 32],
    [TAP.hour - 450, p.x + HOUR_W / 2, p.y + HOUR_H / 2],
    [TAP.hour + 200, p.x + HOUR_W / 2, p.y + HOUR_H / 2],
    [TAP.next - 450, 250, BTN_Y + 28],
    [TAP.next + 250, 250, BTN_Y + 28],
    [T.stepRecap + 400, 300, 600],
    [TAP.confirm - 450, 230, BTN_Y + 28],
    [TAP.confirm + 250, 230, BTN_Y + 28],
    [T.done + 300, 360, 900],
  ];
}

/** Position du curseur à l'instant `ms` (null hors de son passage). */
function cursorAt(keys: [number, number, number][], ms: number): [number, number] | null {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (ms < first[0] || ms > last[0]) return null;
  for (let i = 0; i + 1 < keys.length; i += 1) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (ms >= a[0] && ms <= b[0]) {
      const k = ease((ms - a[0]) / Math.max(1, b[0] - a[0]));
      return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
    }
  }
  return [last[1], last[2]];
}

/** Le clic : une onde qui s'ouvre et trois éclats autour du doigt. */
function clickBurst(g: CanvasRenderingContext2D, x: number, y: number, k: number, scale: number) {
  if (k <= 0 || k >= 1) return;
  g.save();
  g.strokeStyle = `rgba(17,17,17,${0.5 * (1 - k)})`;
  g.lineWidth = 2.5 * scale;
  g.beginPath();
  g.arc(x, y, (10 + k * 34) * scale, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = `rgba(17,17,17,${0.9 * (1 - k)})`;
  g.lineWidth = 3 * scale;
  g.lineCap = 'round';
  [-2.4, -1.57, -0.74].forEach((a) => {
    const r1 = (16 + k * 14) * scale;
    const r2 = (24 + k * 16) * scale;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    g.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    g.stroke();
  });
  g.restore();
}

function drawCursor(g: CanvasRenderingContext2D, x: number, y: number, ms: number, taps: number[], scale = 1) {
  const tap = taps.find((v) => ms >= v - 60 && ms <= v + 520);
  if (tap !== undefined) clickBurst(g, x, y, (ms - tap) / 520, scale);
  const down = tap !== undefined && Math.abs(ms - tap) < 140;
  const s = 2.9 * scale * (down ? 0.88 : 1);
  g.save();
  // La pointe de l'index se pose un peu sous le centre du bouton : le libellé reste lisible.
  g.translate(x + 10 * scale, y + 12 * scale);
  g.rotate(-0.18);
  g.scale(s, s);
  g.translate(-8, -1.2);
  // Ombre portée grise, décalée, comme le curseur de l'ordinateur.
  g.save();
  g.translate(1.6, 1.8);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.fill(HAND);
  g.restore();
  g.fillStyle = '#ffffff';
  g.fill(HAND);
  g.strokeStyle = INK;
  g.lineWidth = 1.35;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke(HAND);
  g.lineWidth = 1.1;
  g.stroke(FINGERS);
  g.restore();
}

/* ------------------------------ Le montage ------------------------------ */

function phoneFrame(g: CanvasRenderingContext2D, x: number, y: number, s: number, draw: () => void, overlay: () => void) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.shadowColor = 'rgba(17,17,17,.20)';
  g.shadowBlur = 60;
  g.shadowOffsetY = 24;
  box(g, -12, -12, PW + 24, PH + 24, 60, '#0b0b0c');
  g.shadowColor = 'transparent';
  box(g, -9, -9, PW + 18, PH + 18, 57, null, '#2c2c2e', 1.5);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, PW, PH, 48);
  g.clip();
  draw();
  // Barre d'état et îlot.
  line(g, '9:41', 54, 33, f(600, 15), INK, 'center');
  box(g, 137, 12, 116, 32, 16, '#000000');
  [5, 8, 11, 14].forEach((h, i) => box(g, 314 + i * 5, 30 - h, 3, h, 1, INK));
  box(g, 338, 19, 26, 12, 4, null, INK, 1.4);
  box(g, 340, 21, 18, 8, 2, INK);
  g.restore();
  overlay();
  g.restore();
}

function drawScreens(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const steps: [number, () => void][] = [
    [0, () => screenSalon(g, d, ms)],
    [T.stepWhen, () => screenWhen(g, d, ms)],
    [T.stepRecap, () => screenRecap(g, d, ms)],
    [T.done, () => screenDone(g, d, ms - T.done)],
  ];
  const i = steps.reduce((a, s, n) => (ms >= s[0] ? n : a), 0);
  const k = out((ms - steps[i]![0]) / 380);
  if (i > 0 && k < 1) {
    g.save();
    g.translate(-k * PW * 0.3, 0);
    steps[i - 1]![1]();
    g.fillStyle = `rgba(0,0,0,${0.12 * k})`;
    g.fillRect(0, 0, PW, PH);
    g.restore();
  }
  g.save();
  g.translate(i > 0 ? (1 - k) * PW : 0, 0);
  steps[i]![1]();
  g.restore();
}

/** Le titre au-dessus du téléphone : « 1 sur 3 » en pastille, puis l'étape en grand. */
type Step = { from: number; n: number; title: string };
function stepsOf(d: BioVideoData): Step[] {
  return [
    { from: T.phoneIn, n: 1, title: t('Choisissez la prestation') },
    { from: T.stepWhen, n: 2, title: t('Choisissez le jour et l’heure') },
    { from: T.stepRecap, n: 3, title: t('Confirmez en un clic') },
    { from: T.done, n: 0, title: d.confirmed ? t('C’est réservé.') : t('Demande envoyée.') },
  ];
}

function drawStepTitle(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const step = [...stepsOf(d)].reverse().find((x) => ms >= x.from);
  if (!step) return;
  const k = ms - step.from;
  // Barre de progression en trois segments.
  for (let i = 0; i < 3; i += 1) {
    const done = step.n === 0 || i < step.n - 1 ? 1 : i === step.n - 1 ? clamp(k / 500) : 0;
    box(g, 48 + i * 212, 70, 200, 6, 3, FILL);
    if (done > 0) box(g, 48 + i * 212, 70, 200 * done, 6, 3, INK);
  }
  const a = out(k / 380);
  g.save();
  g.globalAlpha = a;
  g.translate(0, (1 - a) * 22);
  if (step.n > 0) {
    box(g, 48, 118, 132, 44, 22, INK);
    line(g, t('Étape {n} sur 3', { n: step.n }), 114, 147, f(600, 19), '#ffffff', 'center');
  } else {
    g.fillStyle = GREEN;
    g.beginPath();
    g.arc(70, 140, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(60, 141);
    g.lineTo(67, 148);
    g.lineTo(81, 132);
    g.stroke();
  }
  const px = fit(g, step.title, 800, 54, W - 96);
  line(g, step.title, 48, 236, f(800, px), INK);
  g.restore();
  line(g, d.salon, 48, 292, f(500, 22), MUTED, 'left', W - 96);
}

/** L'ouverture : la photo floutée du salon, son logo, son nom, « Réservez en 3 étapes ». */
function drawIntro(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const leave = ease((ms - 900) / 500);
  g.save();
  g.globalAlpha = 1 - leave;
  g.translate(0, -leave * 120);
  const a = spring(ms / 600);
  g.save();
  g.translate(W / 2, 470);
  g.scale(a, a);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(0, 0, 104, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, 0, 0, 98);
  g.restore();
  const b = out((ms - 200) / 450);
  g.globalAlpha = (1 - leave) * b;
  line(g, d.salon, W / 2, 680, f(800, fit(g, d.salon, 800, 62, W - 80)), INK, 'center');
  const c = out((ms - 400) / 450);
  g.globalAlpha = (1 - leave) * c;
  line(g, t('Réservez en 3 étapes'), W / 2, 740, f(500, 30), MUTED, 'center');
  g.restore();
}

/** Le fond : la photo du salon très floutée sous un voile clair (repli : fond uni). */
function drawBackdrop(g: CanvasRenderingContext2D, d: BioVideoData) {
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);
  if (!d.cover) return;
  g.save();
  g.filter = 'blur(48px) saturate(1.1)';
  picture(g, d.cover, -80, -80, W + 160, 1100);
  g.filter = 'none';
  g.restore();
  // Voile clair qui s'épaissit vers le bas, sans démarcation : la photo se fond dans le fond.
  const v = g.createLinearGradient(0, 0, 0, 980);
  v.addColorStop(0, 'rgba(247,247,249,.70)');
  v.addColorStop(0.5, 'rgba(247,247,249,.88)');
  v.addColorStop(1, BG);
  g.fillStyle = v;
  g.fillRect(0, 0, W, 980);
  g.fillStyle = BG;
  g.fillRect(0, 979, W, H - 979);
}

/** La fin : le nom, « Réservez en 30 secondes », et le lien — que le curseur vient cliquer. */
function drawEnd(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const a = spring(ms / 600);
  g.save();
  g.translate(W / 2, 330);
  g.scale(a, a);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(0, 0, 82, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, 0, 0, 78);
  g.restore();
  g.globalAlpha = out((ms - 250) / 450);
  line(g, d.salon, W / 2, 500, f(800, fit(g, d.salon, 800, 58, W - 80)), INK, 'center');
  if (d.rating) {
    g.font = f(600, 26);
    const w = g.measureText(d.rating).width;
    star(g, W / 2 - w / 2 - 6, 541, 13);
    line(g, d.rating, W / 2 + 14, 550, f(600, 26), INK, 'center');
  }
  g.globalAlpha = out((ms - 550) / 450);
  line(g, t('Réservez en 30 secondes.'), W / 2, 650, f(700, 40), INK, 'center', W - 80);
  // Le lien, en gros bouton noir : le curseur vient le cliquer.
  g.globalAlpha = out((ms - 850) / 450);
  const pressed = pressedAt(ms + T.end, TAP.link);
  g.save();
  pressScale(g, W / 2, 790, pressed);
  box(g, 50, 750, W - 100, 84, 42, INK);
  // Le lien EN ENTIER : la taille baisse plutôt que de le couper.
  const lp = fit(g, d.link, 700, 30, W - 150);
  line(g, d.link, W / 2, 803, f(700, lp), '#ffffff', 'center', W - 140);
  g.restore();
  line(g, t('Lien dans la bio'), W / 2, 890, f(500, 26), MUTED, 'center');
  g.globalAlpha = out((ms - 1300) / 450);
  line(g, `Salon DZ · ${t('réservation en ligne')}`, W / 2, 1180, f(500, 20), SUBTLE, 'center');
  g.globalAlpha = 1;
  // Dernier clic, sur le lien.
  const keys: [number, number, number][] = [
    [T.end + 1300, 600, 1150],
    [TAP.link - 150, W - 150, 780],
    [TAP.link + 700, W - 150, 780],
  ];
  const at = cursorAt(keys, ms + T.end);
  if (at) drawCursor(g, at[0], at[1], ms + T.end, [TAP.link], 1.5);
}

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, at: number, d: BioVideoData) {
  const ms = Math.max(0, at);
  g.textBaseline = 'alphabetic';
  drawBackdrop(g, d);
  if (ms >= T.end) {
    // Le téléphone descend, la fin s'installe.
    const k = ease((ms - T.end) / 500);
    if (k < 1) {
      phoneFrame(g, PHONE.x, mix(PHONE.y, H + 40, k), PHONE.s, () => drawScreens(g, ms, d), () => undefined);
    }
    drawEnd(g, ms - T.end, d);
    return;
  }
  if (ms < T.phoneIn + 500) drawIntro(g, ms, d);
  if (ms >= T.phoneIn - 200) {
    drawStepTitle(g, ms, d);
    const k = spring((ms - (T.phoneIn - 200)) / 700);
    const y = mix(H + 60, PHONE.y, k);
    const keys = cursorPath(d);
    const taps = [TAP.choose, TAP.day, TAP.hour, TAP.next, TAP.confirm];
    phoneFrame(g, PHONE.x, y, PHONE.s, () => drawScreens(g, ms, d), () => {
      const c = cursorAt(keys, ms);
      if (c) drawCursor(g, c[0], c[1], ms, taps);
    });
  }
}
