/**
 * « MA PUB » — la vidéo qui montre comment réserver chez ce professionnel, à publier en story / Reel.
 *
 * REFONTE DU 26 NOV. 2026 (demande du propriétaire : « rénove-le avec plus d'animation, en expert
 * photo, montage vidéo et audio ») — un vrai montage de pub, 23 s, 9:16 :
 *   1. ACCROCHE (0–2,8 s) : la PHOTO DU SALON plein cadre en lent zoom (Ken Burns), le nom qui monte
 *      mot à mot, les étoiles qui se posent une à une, l'accroche « Réservez en 3 clics, sans appeler »,
 *      puis une ouverture en cercle vers le téléphone ;
 *   2. LE PARCOURS, dans les écrans de l'application D'AUJOURD'HUI (charte crème / encre, Lora + Poppins,
 *      boutons noir brillant) : le lien de la bio Instagram, la page du salon, « Choisir », le jour et
 *      l'heure, « Continuer avec Google ». Une CAMÉRA VIRTUELLE zoome sur chaque geste (« punch-in »
 *      des montages produit) et revient au plan large entre deux ; le curseur main clique ;
 *   3. LA CONFIRMATION : coche qui se dessine, ondes et CONFETTIS aux couleurs du salon ;
 *   4. LA FIN : halos qui respirent, photo cerclée d'un anneau tournant, nom, note, « Réservez en 30
 *      secondes. », le lien en noir brillant traversé d'un reflet, puis l'App Store et Google Play.
 * Au-dessus du téléphone : l'étape en titre animé et une barre de progression en quatre segments.
 * Le son (`bioVideoSound.ts`) suit les mêmes instants (`bioSoundCues`) ; voix off française
 * (`bioVoiceLines`, fichiers `public/video/voix/fr-<f|h>-<n>.wav`, `scripts/make-video-voices.ps1`).
 * Dessinée sur le téléphone du pro, rien sur un serveur ; `DESIGN` refait les vidéos déjà préparées.
 */
import { formatDA, formatLocale } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { proProfile, profileJob, profilePhotos } from './proProfile';
import { loadImage } from './storyImage';
import { formatDuration } from './format';
import { getLocale, t } from '@/i18n';
import type { VoiceLine } from './bioVideoSound';
import { VOIX_VERSION } from './voixVersion';

const W = 720;
const H = 1280;
export const BIO_VIDEO_SIZE = { width: W, height: H };
export const BIO_VIDEO_MS = 23000;
/** Change avec le dessin : les vidéos déjà préparées sont refaites. */
const DESIGN = 7;

/* Charte « Claude noir brillant » (styles/claude.css, tokens.css). */
const CREAM = '#faf9f5';
const INK = '#2f2c28';
const MUTED = '#77726a';
const SUBTLE = '#a8a397';
const LINE = '#e8e6dc';
const FILL = '#f0eee6';
const OK = '#5f8a4e';
const GOLD = '#e3a233';
const SERIF = '"Lora", Georgia, serif';
const SANS = '"Poppins", "Cairo", system-ui, sans-serif';
const f = (weight: number, size: number) => `${weight} ${size}px ${SANS}`;
const fl = (weight: number, size: number) => `${weight} ${size}px ${SERIF}`;

/** L'écran du téléphone est dessiné à la taille de l'application (390 × 844), puis mis à l'échelle. */
const PW = 390;
const PH = 844;
/** Zone haute laissée aux barres d'Instagram (story) : rien d'important au-dessus. */
const SAFE_TOP = 150;
const PHONE_S = 1.06;
const PHONE = { x: (W - PW * PHONE_S) / 2, y: 352 };

type Picture = HTMLImageElement | null;

export type BioVideoData = {
  salon: string;
  link: string;
  handle: string;
  job: string;
  city: string;
  address: string;
  rating: string;
  ratingValue: number;
  initials: string;
  /** Sans validation manuelle, le rendez-vous est pris tout de suite. */
  confirmed: boolean;
  /** Salon d'hommes : voix off d'homme, sinon de femme ; couleur d'accent. */
  men: boolean;
  accent: string;
  services: { name: string; price: string; meta: string }[];
  picked: { name: string; price: string; meta: string };
  /** Le jour proposé puis les trois suivants (« Jeudi 26 novembre »…). */
  days: string[];
  dateLong: string;
  hours: string[];
  /** Exemple affiché à l'écran : un prénom courant, jamais une vraie cliente. */
  typedName: string;
  typedPhone: string;
  logo: Picture;
  cover: Picture;
  grid: Picture[];
  /** Voix off : chaque phrase, son début réel (ms), sa durée, son fichier (null tant qu'il n'est pas enregistré). */
  voix: VoixLigne[];
};

/* ------------------------------ La voix off ------------------------------ */

/**
 * VOIX OFF EN DARIJA ET FRANÇAIS (26 nov. 2026, demande du propriétaire : « un homme avec l'accent
 * algérien, qui mélange l'arabe algérien et le français, comme le marketing d'Uber Eats »). Une VRAIE
 * voix, enregistrée : 7 phrases, `node scripts/import-voix.mjs <7 fichiers>` les range dans
 * `public/video/voix/` (WAV) et écrit leurs durées dans `voix.json`. Sans enregistrement, la vidéo
 * garde ses sous-titres animés et sa musique, sans voix de synthèse.
 * Le texte s'affiche en SOUS-TITRES mot à mot, comme sur TikTok : il doit rester celui qui est dit.
 */
export const VOIX: { at: number; text: string }[] = [
  { at: 100, text: 'Salam ! Réservi, sahla bezzaf !' },
  { at: 3000, text: 'Clique sur le lien f la bio.' },
  { at: 5300, text: 'Khayer la prestation li t’hab.' },
  { at: 7800, text: 'Le jour w l’heure, kima yjik.' },
  { at: 10500, text: 'Connecti toi b Google, f une seconde.' },
  { at: 12650, text: 'Hadi hiya ! C’est réservé !' },
  { at: 18700, text: 'Salon DZ ! Yallah, réservi dorka !' },
];
export type VoixLigne = { start: number; dur: number; text: string; file: string | null };

/** Les vraies durées (`voix.json`) ; à défaut, une estimation (≈ 70 ms par caractère). */
async function chargerVoix(): Promise<VoixLigne[]> {
  let pistes: { file: string; dur: number }[] = [];
  try {
    const r = await fetch('/video/voix/voix.json', { cache: 'no-cache' });
    if (r.ok) pistes = ((await r.json()) as { lignes?: { file: string; dur: number }[] }).lignes ?? [];
  } catch {
    /* pas d'enregistrement : sous-titres seuls */
  }
  // Même règle que le mixage : une phrase attend la fin de la précédente (+ 120 ms).
  let libre = 0;
  return VOIX.map((v, i) => {
    const p = pistes[i];
    const dur = p?.dur ?? Math.max(1200, v.text.length * 70);
    const start = Math.max(v.at, libre + 120);
    libre = start + dur;
    return { start, dur, text: v.text, file: p ? `/video/voix/${p.file}` : null };
  });
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pretty = (key: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(formatLocale(), { ...o, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const plusJours = (key: string, n: number) => new Date(Date.parse(`${key}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

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
  const jour = (k: string) => capitalize(pretty(k, { weekday: 'long', day: 'numeric', month: 'long' }));
  return {
    salon: salon.name,
    link,
    handle: (instagram || salon.slug.replace(/-/g, '')).replace(/^@/, ''),
    job: profileJob(proProfile(salon)),
    city: salon.city,
    // Quartier et ville, sans doublon (« Hydra, Hydra » quand les deux portent le même nom).
    address: [...new Set([salon.zone, salon.city].filter(Boolean))].join(', ') || salon.city,
    rating: salon.ratingCount ? `${salon.ratingAvg.toFixed(1).replace('.', ',')} (${salon.ratingCount})` : '',
    ratingValue: salon.ratingCount ? salon.ratingAvg : 0,
    initials: salon.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    confirmed: salon.autoConfirm,
    men,
    // Rose de l'espace féminin (--color-women), bleu doux de la charte pour les salons d'hommes.
    accent: men ? '#6a9bcc' : '#f06a9b',
    services,
    picked: services[0] ?? { name: salon.name, price: '', meta: '' },
    days: [0, 1, 2, 3].map((n) => jour(plusJours(date, n))),
    dateLong: jour(date),
    hours: (hours.length ? hours : openingHours(salon)).slice(0, 6),
    typedName: men ? 'Yacine B.' : 'Sarah K.',
    typedPhone: '0555 00 00 00',
    logo,
    cover,
    grid: grid.filter((x): x is HTMLImageElement => !!x),
    voix: await chargerVoix(),
  };
}

/** Le lien, la photo, TOUTES les prestations actives, et le dessin : la vidéo est refaite si l'un change. */
export function bioVideoVersion(salon: SalonOwnerView, link: string): string {
  const services = salon.services
    .filter((s) => s.isActive)
    .map((s) => `${s.id}:${s.name}:${s.priceDa}`)
    .sort();
  // La langue aussi : les textes ET la voix off changent avec elle.
  return JSON.stringify([DESIGN, VOIX_VERSION, getLocale(), salon.genderTarget, link, salon.coverUrl, salon.logoUrl, salon.autoConfirm, salon.ratingCount, services]);
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

/* ------------------------------ Courbes d'animation ------------------------------ */

const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** Entrée-sortie douce (montage) ; `out` : décélération (ce qui arrive) ; `inn` : accélération (ce qui part). */
const ease = (x: number) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const out = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const outQuint = (x: number) => 1 - Math.pow(1 - clamp(x), 5);
const inn = (x: number) => Math.pow(clamp(x), 3);
/** Arrivée avec un léger dépassement (ressort) : l'élément « se pose ». Jamais négatif (rayon d'`arc`). */
const spring = (x: number): number => {
  const k = clamp(x);
  return Math.max(0, 1 + 1.6 * Math.pow(k - 1, 3) + 0.6 * Math.pow(k - 1, 2));
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** Hasard reproductible : la même vidéo est dessinée pareil à chaque fabrication. */
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ------------------------------ Outils de dessin ------------------------------ */

function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient | null, stroke?: string, lw = 1) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, r));
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

/** Carte blanche à trait fin, sans ombre (charte : cartes `#fff` trait `#e8e6dc`, arrondi 14). */
function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 14) {
  box(g, x, y, w, h, r, '#ffffff', LINE, 1);
}

/** Bouton noir brillant de la charte (`--gloss`) : dégradé, reflet en haut, ombre douce. */
function gloss(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.save();
  g.shadowColor = 'rgba(18,18,20,.28)';
  g.shadowBlur = 16;
  g.shadowOffsetY = 6;
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#45454b');
  gr.addColorStop(1, '#121214');
  box(g, x, y, w, h, r, gr);
  g.restore();
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.clip();
  const hl = g.createLinearGradient(0, y, 0, y + h * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,.22)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(x, y, w, h * 0.5);
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
function fit(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, size: number, max: number): number {
  let px = size;
  g.font = font(px);
  while (px > 20 && g.measureText(text).width > max) {
    px -= 2;
    g.font = font(px);
  }
  return px;
}

/** Image recadrée (« cover »), avec un zoom et un décalage facultatifs (Ken Burns). */
function picture(g: CanvasRenderingContext2D, img: Picture, x: number, y: number, w: number, h: number, r = 0, zoom = 1, dx = 0, dy = 0) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.clip();
  if (img) {
    const k = Math.max(w / img.width, h / img.height) * zoom;
    g.drawImage(img, x + (w - img.width * k) / 2 + dx, y + (h - img.height * k) / 2 + dy, img.width * k, img.height * k);
  } else {
    g.fillStyle = FILL;
    g.fillRect(x, y, w, h);
  }
  g.restore();
}

function avatar(g: CanvasRenderingContext2D, d: BioVideoData, x: number, y: number, r: number) {
  const img = d.logo ?? d.cover;
  if (img) {
    picture(g, img, x - r, y - r, r * 2, r * 2, r);
    return;
  }
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  line(g, d.initials, x, y + r * 0.34, fl(600, Math.round(r * 0.9)), '#ffffff', 'center');
}

/** Étoile à cinq branches ; `fill` = part remplie (note 4,5 → la dernière à moitié). */
function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color = GOLD, fill = 1) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.fill();
  g.clip();
  g.fillStyle = color;
  g.fillRect(cx - r, cy - r, r * 2 * fill, r * 2);
  g.restore();
}

/** Le repère de lieu (épingle), au trait. */
function pin(g: CanvasRenderingContext2D, x: number, y: number, color = MUTED) {
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x, y - 3, 5, Math.PI * 0.85, Math.PI * 2.15);
  g.lineTo(x, y + 6);
  g.closePath();
  g.stroke();
}

/** Le « G » de Google, aux quatre couleurs officielles. */
function googleG(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const seg: [string, number, number][] = [
    ['#ea4335', -2.6, -0.62],
    ['#fbbc05', 2.25, 3.68],
    ['#34a853', 0.7, 2.25],
    ['#4285f4', -0.62, 0.7],
  ];
  g.save();
  g.lineWidth = r * 0.42;
  seg.forEach(([c, a, b]) => {
    g.strokeStyle = c;
    g.beginPath();
    g.arc(cx, cy, r * 0.79, a, b);
    g.stroke();
  });
  g.fillStyle = '#4285f4';
  g.fillRect(cx, cy - r * 0.2, r * 0.98, r * 0.4);
  g.restore();
}

/** « Appuyé » : un bouton qu'on vient de cliquer s'enfonce un instant. */
const pressedAt = (ms: number, tap: number) => Math.abs(ms - tap) < 170;
function pressScale(g: CanvasRenderingContext2D, cx: number, cy: number, on: boolean) {
  if (!on) return;
  g.translate(cx, cy);
  g.scale(0.94, 0.94);
  g.translate(-cx, -cy);
}

/* ------------------------------ Le minutage ------------------------------ */

/** Les grandes scènes du montage (ms). */
const T = {
  /** Fin de l'accroche : ouverture en cercle vers le téléphone. */
  iris: 2450,
  phoneIn: 2900,
  /** La page du salon monte par-dessus Instagram (navigateur intégré). */
  browser: 5000,
  when: 7650,
  /** Après le choix de l'heure, la page défile jusqu'à « 3. Identification ». */
  ident: 10150,
  done: 12550,
  end: 15400,
};
/** Les clics du curseur, dans l'ordre du parcours. */
const TAP = { bio: 4450, choose: 7050, day: 8650, hour: 9650, google: 11850, link: 17400 };
/** Les deux boutiques apparaissent après le dernier clic sur le lien. */
const STORES_AT = 18700;

/* ------------------------------ Les écrans (coordonnées 390 × 844) ------------------------------ */

/** Barre du haut de l'application : menu, logo « Salon DZ », cloche, compte noir. */
function appBar(g: CanvasRenderingContext2D) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 50, PW, 56);
  g.fillStyle = LINE;
  g.fillRect(0, 105, PW, 1);
  g.strokeStyle = INK;
  g.lineWidth = 1.8;
  g.lineCap = 'round';
  [70, 77, 84].forEach((y) => {
    g.beginPath();
    g.moveTo(18, y);
    g.lineTo(36, y);
    g.stroke();
  });
  g.font = `600 20px ${SANS}`;
  const w1 = g.measureText('Salon ').width;
  g.font = `400 20px ${SANS}`;
  const w2 = g.measureText('DZ').width;
  const x0 = PW / 2 - (w1 + w2) / 2;
  line(g, 'Salon ', x0, 85, `600 20px ${SANS}`, INK);
  line(g, 'DZ', x0 + w1, 85, `400 20px ${SANS}`, SUBTLE);
  gloss(g, 330, 61, 46, 36, 10);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(353, 75, 4.5, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(353, 90, 8, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
}

/** 1 · La page du salon : onglets, photo, nom en Lora, adresse, note, prestations avec « Choisir ». */
const SERVICE_Y = 492;
const SERVICE_H = 72;
function screenSalon(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, PW, PH);
  appBar(g);
  [t('Prendre RDV'), t('Avis'), t('À propos')].forEach((x, i) => line(g, x, 65 + i * 130, 134, f(i ? 400 : 500, 13.5), i ? MUTED : INK, 'center'));
  g.fillStyle = INK;
  g.fillRect(0, 146, 130, 2.5);
  // La photo glisse doucement : la page « vit » pendant qu'on la regarde.
  picture(g, d.cover, 0, 148, PW, 190, 0, 1.08, Math.sin(ms / 900) * 6, 0);
  line(g, d.salon, 16, 378, fl(600, fit(g, d.salon, (px) => fl(600, px), 25, 358)), INK);
  pin(g, 22, 401);
  line(g, d.address, 34, 406, f(400, 13.5), INK, 'left', 330);
  star(g, 22, 427, 7.5, INK, d.ratingValue ? 1 : 0);
  line(g, d.rating || t("Pas encore d'avis"), 36, 432, f(400, 13.5), INK, 'left', 200);
  line(g, `•  ${t('Ouvert')}`, 210, 432, f(500, 13.5), OK);
  line(g, t('Choix de la prestation'), 16, 476, f(500, 18), INK);
  d.services.slice(0, 4).forEach((s, i) => {
    const y = SERVICE_Y + i * SERVICE_H;
    g.fillStyle = '#ffffff';
    g.fillRect(0, y, PW, SERVICE_H - 1);
    g.fillStyle = LINE;
    g.fillRect(0, y + SERVICE_H - 1, PW, 1);
    line(g, s.name, 16, y + 30, f(500, 15), INK, 'left', 230);
    line(g, `${s.meta}  •  ${s.price}`, 16, y + 52, f(400, 12.5), MUTED, 'left', 230);
    g.save();
    pressScale(g, 330, y + 36, i === 0 && pressedAt(ms, TAP.choose));
    gloss(g, 282, y + 17, 94, 38, 10);
    line(g, t('Choisir'), 329, y + 41, f(500, 14), '#ffffff', 'center');
    g.restore();
  });
}

/** 2 · « Prestation sélectionnée », puis le jour déplié et ses heures. */
const DAY_Y = 338;
const HOUR_Y = DAY_Y + 64;
const HOUR_W = 110;
const HOUR_H = 46;
const hourAt = (i: number) => ({ x: 16 + (i % 3) * (HOUR_W + 14), y: HOUR_Y + Math.floor(i / 3) * (HOUR_H + 12) });
const PICK_HOUR = (d: BioVideoData) => Math.min(1, d.hours.length - 1);

function stepTitle(g: CanvasRenderingContext2D, n: number, title: string, y: number) {
  line(g, `${n}. ${title}`, 16, y, f(500, 18), INK);
}

function pickedCard(g: CanvasRenderingContext2D, d: BioVideoData, y: number) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, y, PW, 74);
  g.fillStyle = LINE;
  g.fillRect(0, y, PW, 1);
  g.fillRect(0, y + 73, PW, 1);
  line(g, d.picked.name, 16, y + 31, f(500, 15), INK, 'left', 260);
  line(g, `${d.picked.meta}  •  ${d.picked.price}`, 16, y + 54, f(400, 12.5), MUTED, 'left', 260);
  line(g, t('Supprimer'), PW - 16, y + 31, f(500, 13), INK, 'right');
  g.fillStyle = INK;
  g.font = f(500, 13);
  const w = g.measureText(t('Supprimer')).width;
  g.fillRect(PW - 16 - w, y + 35, w, 1.2);
}

function screenWhen(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, PW, PH);
  appBar(g);
  line(g, d.salon, 16, 152, fl(600, fit(g, d.salon, (px) => fl(600, px), 24, 358)), INK);
  stepTitle(g, 1, t('Prestation sélectionnée'), 196);
  pickedCard(g, d, 214);
  stepTitle(g, 2, t('Choix de la date & heure'), 322);
  // Les jours, comme dans l'application : le premier se déplie au toucher.
  const open = clamp((ms - TAP.day) / 380);
  const slotsH = (HOUR_H + 12) * Math.ceil(d.hours.length / 3) + 8;
  d.days.forEach((label, i) => {
    const y = DAY_Y + i * 58 + (i > 0 ? out(open) * slotsH : 0);
    if (y > PH) return;
    g.fillStyle = '#ffffff';
    g.fillRect(0, y, PW, 56);
    g.fillStyle = LINE;
    g.fillRect(0, y + 56, PW, 1);
    g.save();
    if (i === 0) pressScale(g, PW / 2, y + 28, pressedAt(ms, TAP.day));
    line(g, label, 16, y + 34, f(500, 15), INK, 'left', 300);
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.beginPath();
    const up = i === 0 ? open : 0;
    g.moveTo(PW - 30, y + (up > 0.5 ? 31 : 25));
    g.lineTo(PW - 24, y + (up > 0.5 ? 25 : 31));
    g.lineTo(PW - 18, y + (up > 0.5 ? 31 : 25));
    g.stroke();
    g.restore();
  });
  if (open > 0) {
    const pick = PICK_HOUR(d);
    g.save();
    g.beginPath();
    g.rect(0, DAY_Y + 57, PW, out(open) * slotsH);
    g.clip();
    d.hours.forEach((x, i) => {
      const p = hourAt(i);
      // Les heures arrivent l'une après l'autre (cascade).
      const a = out((ms - TAP.day - 120 - i * 45) / 280);
      const on = ms > TAP.hour && i === pick;
      g.save();
      g.globalAlpha = a;
      g.translate(0, (1 - a) * 10);
      pressScale(g, p.x + HOUR_W / 2, p.y + HOUR_H / 2, i === pick && pressedAt(ms, TAP.hour));
      if (on) gloss(g, p.x, p.y, HOUR_W, HOUR_H, 10);
      else box(g, p.x, p.y, HOUR_W, HOUR_H, 10, FILL);
      line(g, x, p.x + HOUR_W / 2, p.y + 29, f(500, 15), on ? '#ffffff' : INK, 'center');
      g.restore();
    });
    g.restore();
  }
}

/** 3 · Le créneau retenu, puis « Identification » : Continuer avec Google (un geste). */
function screenIdent(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, PW, PH);
  appBar(g);
  line(g, d.salon, 16, 152, fl(600, fit(g, d.salon, (px) => fl(600, px), 24, 358)), INK);
  stepTitle(g, 1, t('Prestation sélectionnée'), 196);
  pickedCard(g, d, 214);
  stepTitle(g, 2, t('Date et heure sélectionnées'), 330);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 348, PW, 74);
  g.fillStyle = LINE;
  g.fillRect(0, 348, PW, 1);
  g.fillRect(0, 421, PW, 1);
  line(g, d.dateLong, 16, 379, f(500, 15), INK, 'left', 280);
  line(g, `${t('à')} ${d.hours[PICK_HOUR(d)] ?? ''}`, 16, 402, f(400, 13), MUTED);
  line(g, t('Modifier'), PW - 16, 379, f(500, 13), INK, 'right');
  // « 3. Identification » arrive en glissant : la page a défilé jusque-là.
  const a = out((ms - T.ident - 150) / 420);
  g.save();
  g.globalAlpha = a;
  g.translate(0, (1 - a) * 24);
  stepTitle(g, 3, t('Identification'), 470);
  g.save();
  pressScale(g, PW / 2, 522, pressedAt(ms, TAP.google));
  box(g, 16, 494, 358, 56, 12, '#ffffff', LINE, 1.2);
  g.font = f(500, 15.5);
  const gw = g.measureText(t('Continuer avec Google')).width;
  const gx = PW / 2 - (gw + 34) / 2;
  googleG(g, gx + 11, 522, 11);
  line(g, t('Continuer avec Google'), gx + 34, 528, f(500, 15.5), INK);
  g.restore();
  line(g, t('Nouveau sur Salon DZ ?'), PW / 2, 590, f(500, 15), INK, 'center');
  box(g, 16, 606, 358, 52, 12, '#ffffff', LINE, 1.2);
  line(g, t('Créer mon compte'), PW / 2, 638, f(500, 15), INK, 'center');
  g.restore();
}

/** 4 · Confirmation : la pastille verte se pose, la coche se dessine, deux ondes partent. */
function screenDone(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, PW, PH);
  appBar(g);
  const cx = PW / 2;
  const cy = 250;
  [0, 260].forEach((delay) => {
    const k = clamp((ms - 180 - delay) / 1100);
    if (k <= 0 || k >= 1) return;
    g.fillStyle = `rgba(95,138,78,${0.32 * (1 - k)})`;
    g.beginPath();
    g.arc(cx, cy, 48 + k * 80, 0, Math.PI * 2);
    g.fill();
  });
  const k = spring(ms / 560);
  g.fillStyle = OK;
  g.beginPath();
  g.arc(cx, cy, 50 * k, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const c = clamp((ms - 280) / 340);
  g.beginPath();
  g.moveTo(cx - 21, cy + 1);
  if (c > 0) g.lineTo(mix(cx - 21, cx - 6, clamp(c * 2)), mix(cy + 1, cy + 16, clamp(c * 2)));
  if (c > 0.5) g.lineTo(mix(cx - 6, cx + 23, (c - 0.5) * 2), mix(cy + 16, cy - 15, (c - 0.5) * 2));
  g.stroke();
  g.lineCap = 'butt';
  const a = out((ms - 320) / 420);
  g.globalAlpha = a;
  g.save();
  g.translate(0, (1 - a) * 14);
  line(g, d.confirmed ? t('Rendez-vous confirmé') : t('Demande envoyée'), cx, 360, fl(600, 25), INK, 'center', 350);
  line(g, `${d.dateLong} · ${d.hours[PICK_HOUR(d)] ?? ''}`, cx, 390, f(400, 14), MUTED, 'center', 350);
  card(g, 16, 420, 358, 92);
  avatar(g, d, 52, 466, 22);
  line(g, d.salon, 86, 459, f(500, 15), INK, 'left', 270);
  line(g, `${d.picked.name} · ${d.picked.price}`, 86, 482, f(400, 13), MUTED, 'left', 270);
  g.restore();
  g.globalAlpha = 1;
}

/* ------------------------------ Instagram ------------------------------ */

/** Le lien de la bio, là où le curseur clique (coordonnées de l'écran du téléphone). */
const BIO_LINK = { x: 150, y: 289 };
/** Dégradé de la bague Instagram (couleurs officielles de la marque). */
const IG = ['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5'];
const IG_INK = '#111111';
const IG_MUTED = '#6e6e76';

function chevronLeft(g: CanvasRenderingContext2D, cx: number, cy: number) {
  g.beginPath();
  g.moveTo(cx + 3, cy - 6);
  g.lineTo(cx - 3, cy);
  g.lineTo(cx + 3, cy + 6);
  g.stroke();
}

/** Le profil Instagram DU SALON : son nom de compte, ses vraies photos, son lien en bio. */
function screenInstagram(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, PW, PH);
  g.save();
  g.strokeStyle = IG_INK;
  g.lineWidth = 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  chevronLeft(g, 26, 82);
  g.restore();
  line(g, d.handle, 50, 88, `700 17px system-ui, sans-serif`, IG_INK, 'left', 260);
  [0, 1, 2].forEach((i) => {
    g.fillStyle = IG_INK;
    g.beginPath();
    g.arc(352 + i * 7, 82, 2, 0, Math.PI * 2);
    g.fill();
  });
  // Photo du profil dans la bague Instagram, qui tourne doucement (story à voir).
  const ring = g.createConicGradient(ms / 700, 64, 160);
  IG.forEach((c, i) => ring.addColorStop(i / IG.length, c));
  ring.addColorStop(1, IG[0]!);
  g.strokeStyle = ring;
  g.lineWidth = 3.5;
  g.beginPath();
  g.arc(64, 160, 46, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, 64, 160, 40);
  // Compteurs : sans chiffre inventé, la forme suffit à reconnaître Instagram.
  [t('publications'), t('abonnés'), t('suivis')].forEach((x, i) => {
    const cx = 178 + i * 76;
    box(g, cx - 18, 140, 36, 14, 7, '#ececf0');
    line(g, x, cx, 178, `400 12.5px system-ui, sans-serif`, IG_INK, 'center');
  });
  line(g, d.salon, 18, 234, `700 15px system-ui, sans-serif`, IG_INK, 'left', 354);
  line(g, `${d.job} · ${d.city}`, 18, 255, `400 14px system-ui, sans-serif`, IG_MUTED, 'left', 354);
  line(g, t('Réservez en ligne, c’est ici :'), 18, 275, `400 14px system-ui, sans-serif`, IG_INK, 'left', 354);
  // Le lien de la bio : il « pulse » pour attirer l'œil, puis s'éclaire quand on le touche.
  const pulse = ms < TAP.bio ? 0.5 + 0.5 * Math.sin(ms / 160) : 0;
  if (ms > 3300 && ms < TAP.bio) box(g, 12, 280, 316, 24, 8, `rgba(0,149,246,${0.08 + 0.1 * pulse})`);
  if (pressedAt(ms, TAP.bio) || (ms > TAP.bio && ms < TAP.bio + 380)) box(g, 12, 280, 316, 24, 8, '#d7e7ff');
  g.save();
  g.strokeStyle = '#00376b';
  g.lineWidth = 1.6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(22, 297);
  g.lineTo(30, 289);
  g.stroke();
  g.beginPath();
  g.roundRect(17, 290, 9, 5, 2.5);
  g.roundRect(26, 286, 9, 5, 2.5);
  g.stroke();
  g.restore();
  line(g, d.link, 40, 297, `600 14px system-ui, sans-serif`, '#00376b', 'left', 330);
  box(g, 16, 316, 114, 34, 9, '#0095f6');
  line(g, t('Suivre'), 73, 338, `600 14px system-ui, sans-serif`, '#ffffff', 'center');
  box(g, 138, 316, 114, 34, 9, '#efefef');
  line(g, t('Message'), 195, 338, `600 14px system-ui, sans-serif`, IG_INK, 'center');
  box(g, 260, 316, 114, 34, 9, '#efefef');
  line(g, t('Contacter'), 317, 338, `600 14px system-ui, sans-serif`, IG_INK, 'center');
  g.fillStyle = IG_INK;
  g.fillRect(0, 372, PW / 3, 1.5);
  const size = (PW - 4) / 3;
  const pics = [d.cover, ...d.grid].filter(Boolean) as HTMLImageElement[];
  for (let i = 0; i < 9; i += 1) {
    const x = (i % 3) * (size + 2);
    const y = 376 + Math.floor(i / 3) * (size + 2);
    if (pics.length) picture(g, pics[i % pics.length]!, x, y, size, size);
    else box(g, x, y, size, size, 0, '#ececf0');
  }
}

/** La barre du navigateur d'Instagram, en haut de la page qui s'ouvre. */
function browserBar(g: CanvasRenderingContext2D, d: BioVideoData, alpha: number) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 44, PW, 62);
  g.fillStyle = '#ececf0';
  g.fillRect(0, 105, PW, 1);
  g.strokeStyle = IG_INK;
  g.lineWidth = 1.8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(20, 68);
  g.lineTo(32, 80);
  g.moveTo(32, 68);
  g.lineTo(20, 80);
  g.stroke();
  const host = d.link.split('/')[0] ?? d.link;
  line(g, host, PW / 2, 73, `600 14px system-ui, sans-serif`, IG_INK, 'center');
  line(g, d.salon, PW / 2, 92, `400 11.5px system-ui, sans-serif`, IG_MUTED, 'center', 240);
  g.restore();
}

/* ------------------------------ Le curseur ------------------------------ */

/**
 * Curseur MAIN (index levé), comme le curseur d'un ordinateur : blanc, contour encre, ombre grise
 * décalée. La pointe de l'index est en (8,1) dans un dessin de 24 × 24.
 */
const HAND = new Path2D(
  'M8 1.2c1.2 0 2.1.9 2.1 2.1v6.2c.4-.6 1-.9 1.8-.9 1.1 0 2 .8 2.1 1.9.4-.5 1-.8 1.7-.8 1.1 0 2 .8 2.1 1.9.4-.4.9-.6 1.5-.6 1.2 0 2.1.9 2.1 2.1v3.6c0 3.9-2.9 6.9-6.8 6.9h-2.3c-2.2 0-3.6-.7-5-2.2l-4-4.3c-.8-.9-.8-2.2.1-3 .9-.8 2.2-.7 3 .1l1.5 1.6V3.3c0-1.2.9-2.1 2.1-2.1z',
);
const FINGERS = new Path2D('M10.1 9.5v3.4M14 10.4v2.7M17.8 11.5v2');

const serviceBtn = { x: 330, y: SERVICE_Y + 36 };
const GOOGLE = { x: 250, y: 522 };

/** Images clés du curseur, en coordonnées de l'écran du téléphone : [ms, x, y]. */
function cursorPath(d: BioVideoData): [number, number, number][] {
  const p = hourAt(PICK_HOUR(d));
  const hx = p.x + HOUR_W / 2;
  const hy = p.y + HOUR_H / 2;
  return [
    [3200, 340, 820],
    [TAP.bio - 500, BIO_LINK.x, BIO_LINK.y],
    [TAP.bio + 260, BIO_LINK.x, BIO_LINK.y],
    [T.browser + 700, 300, 760],
    [TAP.choose - 520, serviceBtn.x, serviceBtn.y],
    [TAP.choose + 240, serviceBtn.x, serviceBtn.y],
    [T.when + 400, 280, 640],
    [TAP.day - 480, 210, DAY_Y + 30],
    [TAP.day + 200, 210, DAY_Y + 30],
    [TAP.hour - 520, hx, hy],
    [TAP.hour + 260, hx, hy],
    [T.ident + 600, 300, 700],
    [TAP.google - 520, GOOGLE.x, GOOGLE.y],
    [TAP.google + 300, GOOGLE.x, GOOGLE.y],
    [T.done + 200, 360, 900],
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
      // Trajectoire en léger arc, comme un vrai geste de la main.
      const arc = Math.sin(k * Math.PI) * Math.min(40, Math.hypot(b[1] - a[1], b[2] - a[2]) * 0.12);
      return [mix(a[1], b[1], k) + arc, mix(a[2], b[2], k) - arc * 0.5];
    }
  }
  return [last[1], last[2]];
}

/** Le clic : une onde qui s'ouvre et trois éclats autour du doigt. */
function clickBurst(g: CanvasRenderingContext2D, x: number, y: number, k: number, scale: number, color: string) {
  if (k <= 0 || k >= 1) return;
  g.save();
  g.fillStyle = color;
  g.globalAlpha = 0.18 * (1 - k);
  g.beginPath();
  g.arc(x, y, (8 + k * 30) * scale, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.7 * (1 - k);
  g.strokeStyle = color;
  g.lineWidth = 2.5 * scale;
  g.beginPath();
  g.arc(x, y, (10 + k * 34) * scale, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.95 * (1 - k);
  g.strokeStyle = INK;
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

function drawCursor(g: CanvasRenderingContext2D, x: number, y: number, ms: number, taps: number[], color: string, scale = 1) {
  const tap = taps.find((v) => ms >= v - 60 && ms <= v + 560);
  if (tap !== undefined) clickBurst(g, x, y, (ms - tap) / 560, scale, color);
  const down = tap !== undefined && Math.abs(ms - tap) < 140;
  const s = 2.7 * scale * (down ? 0.86 : 1);
  g.save();
  g.translate(x + 10 * scale, y + 12 * scale);
  g.rotate(-0.18);
  g.scale(s, s);
  g.translate(-8, -1.2);
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

/* ------------------------------ La caméra virtuelle ------------------------------ */

/**
 * Le « punch-in » des montages produit : avant chaque geste, la caméra s'approche de l'endroit
 * touché ; après, elle revient au plan large. [ms, zoom, x, y] en coordonnées de l'écran du téléphone.
 */
function cameraKeys(d: BioVideoData): [number, number, number, number][] {
  const p = hourAt(PICK_HOUR(d));
  const C = [195, 430] as const;
  return [
    [T.phoneIn, 1, ...C],
    [3500, 1, ...C],
    [4050, 1.42, BIO_LINK.x + 40, BIO_LINK.y + 30],
    [4850, 1.42, BIO_LINK.x + 40, BIO_LINK.y + 30],
    [5250, 1, ...C],
    [6100, 1, ...C],
    [6600, 1.34, 260, SERVICE_Y + 60],
    [7350, 1.34, 260, SERVICE_Y + 60],
    [7750, 1, ...C],
    [8300, 1, ...C],
    [9050, 1.3, p.x + 80, p.y + 10],
    [9950, 1.3, p.x + 80, p.y + 10],
    [10350, 1, ...C],
    [11100, 1, ...C],
    [11500, 1.36, 200, 540],
    [12150, 1.36, 200, 540],
    [12600, 1, ...C],
    [13300, 1.06, 195, 330],
    [T.end, 1.12, 195, 330],
  ];
}

function cameraAt(keys: [number, number, number, number][], ms: number): [number, number, number] {
  if (ms <= keys[0]![0]) return [keys[0]![1], keys[0]![2], keys[0]![3]];
  for (let i = 0; i + 1 < keys.length; i += 1) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (ms >= a[0] && ms <= b[0]) {
      const k = ease((ms - a[0]) / Math.max(1, b[0] - a[0]));
      return [mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k)];
    }
  }
  const l = keys[keys.length - 1]!;
  return [l[1], l[2], l[3]];
}

/* ------------------------------ Le montage ------------------------------ */

function phoneFrame(g: CanvasRenderingContext2D, x: number, y: number, s: number, draw: () => void, overlay: () => void) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.save();
  g.shadowColor = 'rgba(47,44,40,.28)';
  g.shadowBlur = 70;
  g.shadowOffsetY = 30;
  box(g, -12, -12, PW + 24, PH + 24, 60, '#0b0b0c');
  g.restore();
  box(g, -9, -9, PW + 18, PH + 18, 57, null, '#2c2c2e', 1.5);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, PW, PH, 48);
  g.clip();
  draw();
  // Barre d'état et îlot.
  line(g, '9:41', 54, 33, `600 15px system-ui, sans-serif`, IG_INK, 'center');
  box(g, 137, 12, 116, 32, 16, '#000000');
  [5, 8, 11, 14].forEach((h, i) => box(g, 314 + i * 5, 30 - h, 3, h, 1, IG_INK));
  box(g, 338, 19, 26, 12, 4, null, IG_INK, 1.4);
  box(g, 340, 21, 18, 8, 2, IG_INK);
  // Reflet de verre sur l'écran : une diagonale très légère.
  const shine = g.createLinearGradient(0, 0, PW, PH);
  shine.addColorStop(0, 'rgba(255,255,255,.10)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.fillRect(0, 0, PW, PH);
  g.restore();
  overlay();
  g.restore();
}

function drawScreens(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  // Instagram, puis la page du salon qui MONTE par-dessus (le navigateur d'Instagram s'ouvre).
  if (ms < T.when) {
    if (ms < T.browser + 520) screenInstagram(g, d, ms);
    if (ms >= T.browser) {
      const k = outQuint((ms - T.browser) / 520);
      g.save();
      g.translate(0, (1 - k) * PH);
      screenSalon(g, d, ms);
      browserBar(g, d, 1 - clamp((ms - T.browser - 1200) / 350));
      g.restore();
    }
    return;
  }
  // Ensuite les écrans glissent de droite à gauche (« Quand ? »), la page défile (identification),
  // puis la confirmation se pose.
  const steps: [number, () => void, 'slide' | 'scroll' | 'fade'][] = [
    [T.when, () => screenWhen(g, d, ms), 'slide'],
    [T.ident, () => screenIdent(g, d, ms), 'scroll'],
    [T.done, () => screenDone(g, d, ms - T.done), 'fade'],
  ];
  const i = steps.reduce((a, s, n) => (ms >= s[0] ? n : a), 0);
  const [from, draw, kind] = steps[i]!;
  const k = outQuint((ms - from) / 460);
  const prev = i > 0 ? steps[i - 1]![1] : () => screenSalon(g, d, ms);
  if (k >= 1) {
    draw();
    return;
  }
  if (kind === 'slide') {
    g.save();
    g.translate(-k * PW * 0.3, 0);
    prev();
    g.fillStyle = `rgba(0,0,0,${0.12 * k})`;
    g.fillRect(0, 0, PW, PH);
    g.restore();
    g.save();
    g.translate((1 - k) * PW, 0);
    draw();
    g.restore();
  } else if (kind === 'scroll') {
    // Le contenu remonte d'un bloc : l'heure choisie se replie, l'identification apparaît.
    g.save();
    g.globalAlpha = 1 - k;
    g.translate(0, -k * 60);
    prev();
    g.restore();
    g.save();
    g.globalAlpha = k;
    g.translate(0, (1 - k) * 60);
    draw();
    g.restore();
  } else {
    prev();
    g.save();
    g.globalAlpha = k;
    g.translate(PW / 2, PH / 2);
    g.scale(mix(1.04, 1, k), mix(1.04, 1, k));
    g.translate(-PW / 2, -PH / 2);
    draw();
    g.restore();
  }
}

/* ------------------------------ Titres et progression ------------------------------ */

type Step = { from: number; n: number; title: string };
function stepsOf(d: BioVideoData): Step[] {
  return [
    { from: T.phoneIn, n: 0, title: t('Touchez le lien de la bio') },
    { from: T.browser, n: 1, title: t('Choisissez la prestation') },
    { from: T.when, n: 2, title: t('Le jour et l’heure') },
    { from: T.ident, n: 3, title: t('Identifiez-vous en un geste') },
    { from: T.done, n: 4, title: d.confirmed ? t('C’est réservé.') : t('Demande envoyée.') },
  ];
}

const ARABE = /[؀-ۿ]/;
/** Écrit de droite à gauche (arabe) : titres alignés à droite. */
const rtl = () => getLocale() === 'ar';

/**
 * Un titre qui monte MOT À MOT, chaque mot sortant d'un masque (typographie animée). En arabe, la
 * phrase monte d'un bloc, alignée à droite : découpée en mots, elle se lisait dans le désordre.
 */
function kinetic(g: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, ms: number, stagger = 70, align: 'left' | 'center' = 'left') {
  g.font = font;
  if (ARABE.test(text)) {
    const k = outQuint(ms / 560);
    if (k <= 0) return;
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 40);
    g.save();
    g.globalAlpha *= k;
    g.direction = 'rtl';
    line(g, text, align === 'center' ? x : W - x, y + (1 - k) * size * 0.6, font, color, align === 'center' ? 'center' : 'right');
    g.restore();
    return;
  }
  const words = text.split(' ');
  const space = g.measureText(' ').width;
  const widths = words.map((w) => g.measureText(w).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 40);
  words.forEach((w, i) => {
    const k = outQuint((ms - i * stagger) / 520);
    if (k > 0) {
      g.save();
      g.beginPath();
      g.rect(cx - 4, y - size * 1.05, widths[i]! + 8, size * 1.4);
      g.clip();
      g.globalAlpha = k;
      line(g, w, cx, y + (1 - k) * size * 0.9, font, color);
      g.restore();
    }
    cx += widths[i]! + space;
  });
}

function drawStepTitle(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const steps = stepsOf(d);
  const idx = steps.reduce((a, s, i) => (ms >= s.from ? i : a), -1);
  if (idx < 0) return;
  const step = steps[idx]!;
  const k = ms - step.from;
  // Voile crème derrière les titres : lisibles même quand la caméra approche le téléphone.
  const v = g.createLinearGradient(0, 0, 0, 350);
  v.addColorStop(0, 'rgba(250,249,245,.98)');
  v.addColorStop(0.82, 'rgba(250,249,245,.95)');
  v.addColorStop(1, 'rgba(250,249,245,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, 350);
  const y0 = SAFE_TOP;
  // La pastille : Instagram, le numéro d'étape, ou la coche verte.
  const a = out(k / 360);
  g.save();
  g.globalAlpha = a;
  g.translate((1 - a) * -20, 0);
  if (step.n === 0) {
    const ig = g.createLinearGradient(48, y0 + 40, 220, y0);
    IG.forEach((c, i) => ig.addColorStop(i / (IG.length - 1), c));
    box(g, 48, y0, 150, 40, 20, ig);
    line(g, 'Instagram', 123, y0 + 27, f(600, 17), '#ffffff', 'center');
  } else if (step.n < 4) {
    gloss(g, 48, y0, 150, 40, 20);
    line(g, t('Étape {n} sur {total}', { n: step.n, total: 3 }), 123, y0 + 27, f(500, 16), '#ffffff', 'center');
  } else {
    g.fillStyle = OK;
    g.beginPath();
    g.arc(68, y0 + 20, 20, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(59, y0 + 21);
    g.lineTo(66, y0 + 28);
    g.lineTo(78, y0 + 13);
    g.stroke();
  }
  g.restore();
  const px = fit(g, step.title, (p) => fl(600, p), 50, W - 96);
  kinetic(g, step.title, 48, y0 + 102, fl(600, px), INK, k - 80);
  g.globalAlpha = out((k - 300) / 400);
  line(g, step.n === 0 ? `@${d.handle}` : d.salon, rtl() ? W - 48 : 48, y0 + 140, f(400, 20), MUTED, rtl() ? 'right' : 'left', W - 96);
  g.globalAlpha = 1;
  // Barre de progression en quatre segments : lien, prestation, créneau, confirmé.
  const segs = 4;
  const gap = 8;
  const sw = (W - 96 - gap * (segs - 1)) / segs;
  const yb = y0 + 166;
  for (let i = 0; i < segs; i += 1) {
    box(g, 48 + i * (sw + gap), yb, sw, 5, 3, 'rgba(47,44,40,.10)');
    const start = [T.phoneIn, T.browser, T.when, T.ident][i]!;
    const stop = [T.browser, T.when, T.ident, T.done][i]!;
    const p = clamp((ms - start) / (stop - start));
    if (p > 0) box(g, 48 + i * (sw + gap), yb, sw * p, 5, 3, i === segs - 1 && ms >= T.done ? OK : INK);
  }
}

/* ------------------------------ L'accroche ------------------------------ */

/** Plein cadre sur la photo du salon : lent zoom, nom mot à mot, étoiles, accroche. */
function drawHook(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const z = mix(1.18, 1.04, ease(ms / T.iris));
  if (d.cover) picture(g, d.cover, 0, 0, W, H, 0, z, Math.sin(ms / 1400) * 12, -ms * 0.01);
  else {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, d.accent);
    gr.addColorStop(1, INK);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // Dégradé cinéma : lisibilité du texte, sans écraser la photo.
  const v = g.createLinearGradient(0, H * 0.35, 0, H);
  v.addColorStop(0, 'rgba(18,16,14,0)');
  v.addColorStop(0.55, 'rgba(18,16,14,.55)');
  v.addColorStop(1, 'rgba(18,16,14,.86)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  const top = g.createLinearGradient(0, 0, 0, 300);
  top.addColorStop(0, 'rgba(18,16,14,.45)');
  top.addColorStop(1, 'rgba(18,16,14,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, W, 300);
  // Lumière qui traverse (« light leak ») aux couleurs du salon.
  const lk = clamp((ms - 300) / 1800);
  if (lk > 0 && lk < 1) {
    const lx = mix(-300, W + 300, lk);
    const leak = g.createRadialGradient(lx, 420, 10, lx, 420, 420);
    leak.addColorStop(0, `${d.accent}55`);
    leak.addColorStop(1, `${d.accent}00`);
    g.fillStyle = leak;
    g.fillRect(0, 0, W, H);
  }
  // Marque discrète en haut.
  g.globalAlpha = out((ms - 100) / 500);
  g.font = `600 26px ${SANS}`;
  const w1 = g.measureText('Salon ').width;
  line(g, 'Salon ', 48, SAFE_TOP + 20, `600 26px ${SANS}`, '#ffffff');
  line(g, 'DZ', 48 + w1, SAFE_TOP + 20, `400 26px ${SANS}`, 'rgba(255,255,255,.72)');
  g.globalAlpha = 1;
  // Le nom du salon, mot à mot.
  const px = fit(g, d.salon, (p) => fl(600, p), 76, W - 96);
  g.save();
  g.shadowColor = 'rgba(0,0,0,.35)';
  g.shadowBlur = 24;
  kinetic(g, d.salon, 48, 900, fl(600, px), '#ffffff', ms - 250, 110);
  g.restore();
  // Les étoiles se posent une à une.
  if (d.ratingValue) {
    for (let i = 0; i < 5; i += 1) {
      const k = spring((ms - 750 - i * 80) / 420);
      if (k <= 0) continue;
      g.save();
      g.translate(64 + i * 40, 950);
      g.scale(k, k);
      star(g, 0, 0, 15, GOLD, clamp(d.ratingValue - i));
      g.restore();
    }
    g.globalAlpha = out((ms - 1150) / 400);
    line(g, d.rating, 64 + 5 * 40 - 4, 960, f(500, 24), '#ffffff');
    g.globalAlpha = 1;
  }
  // L'accroche, dans une pastille de verre qui glisse.
  const a = outQuint((ms - 1250) / 600);
  if (a > 0) {
    const text = t('Réservez en 3 clics, sans appeler');
    g.font = f(500, 28);
    const tw = Math.min(W - 96, g.measureText(text).width + 52);
    g.save();
    g.globalAlpha = a;
    g.translate((1 - a) * -40, 0);
    box(g, 48, 1000, tw, 62, 31, 'rgba(255,255,255,.18)', 'rgba(255,255,255,.35)', 1.5);
    g.fillStyle = d.accent;
    g.beginPath();
    g.arc(76, 1031, 7, 0, Math.PI * 2);
    g.fill();
    line(g, text, 94, 1041, f(500, 26), '#ffffff', 'left', tw - 60);
    g.restore();
  }
}

/* ------------------------------ Confettis ------------------------------ */

function drawConfetti(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  if (ms < 0 || ms > 2800) return;
  const colors = [d.accent, GOLD, OK, INK, '#e3ecf5'];
  for (let i = 0; i < 70; i += 1) {
    const delay = rand(i) * 350;
    const k = (ms - delay) / 2400;
    if (k <= 0 || k >= 1) continue;
    // Partent du centre en éventail, puis retombent en flottant.
    const ang = -Math.PI / 2 + (rand(i + 7) - 0.5) * 2.4;
    const v = 520 + rand(i + 3) * 520;
    const x = W / 2 + Math.cos(ang) * v * k + Math.sin(k * 9 + i) * 18;
    const y = 640 + Math.sin(ang) * v * k + 900 * k * k;
    g.save();
    g.globalAlpha = 1 - Math.pow(k, 3);
    g.translate(x, y);
    g.rotate(k * 12 * (rand(i + 11) - 0.5) * 2);
    g.scale(1, Math.abs(Math.cos(k * 14 + i)));
    g.fillStyle = colors[i % colors.length]!;
    if (i % 3 === 0) {
      g.beginPath();
      g.arc(0, 0, 6, 0, Math.PI * 2);
      g.fill();
    } else g.fillRect(-6, -10, 12, 20);
    g.restore();
  }
}

/* ------------------------------ Le fond ------------------------------ */

/** Fond crème et deux halos qui respirent (couleur du salon et bleu doux). */
function drawBackdrop(g: CanvasRenderingContext2D, d: BioVideoData, ms: number) {
  g.fillStyle = CREAM;
  g.fillRect(0, 0, W, H);
  const halo = (x: number, y: number, r: number, c: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(250,249,245,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  };
  halo(W * 0.85 + Math.sin(ms / 2200) * 40, 260 + Math.cos(ms / 2600) * 30, 520, `${d.accent}30`);
  halo(W * 0.1 + Math.cos(ms / 2400) * 40, H * 0.78, 560, 'rgba(201,198,187,.38)');
}

/* ------------------------------ Les boutiques ------------------------------ */

/** Logos officiels des boutiques (tracés 24 × 24, Simple Icons, CC0). */
const APPLE = new Path2D(
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
);
const PLAY: [string, Path2D][] = [
  ['#00a0ff', new Path2D('M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z')],
  ['#00f076', new Path2D('M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z')],
  ['#ffd500', new Path2D('M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z')],
  ['#ff3a44', new Path2D('M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z')],
];

/** Badge de boutique, noir comme les badges officiels : logo, petite ligne, nom de la boutique. */
function storeBadge(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: 'apple' | 'google') {
  g.save();
  g.shadowColor = 'rgba(47,44,40,.22)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 6;
  box(g, x, y, w, h, 16, '#000000');
  g.restore();
  box(g, x + 1, y + 1, w - 2, h - 2, 15, null, '#a6a6a6', 1.5);
  const s = 1.85;
  g.save();
  g.translate(x + 22, y + (h - 24 * s) / 2);
  g.scale(s, s);
  if (kind === 'apple') {
    g.fillStyle = '#ffffff';
    g.fill(APPLE);
  } else {
    PLAY.forEach(([c, p]) => {
      g.fillStyle = c;
      g.fill(p);
    });
  }
  g.restore();
  const tx = x + 22 + 24 * s + 14;
  const max = w - (tx - x) - 12;
  const store = kind === 'apple' ? t('l’App Store') : 'Google Play';
  line(g, kind === 'apple' ? t('Télécharger dans') : t('DISPONIBLE SUR'), tx, y + 31, `500 15px system-ui, sans-serif`, '#ffffff', 'left', max);
  line(g, store, tx, y + 60, `700 ${Math.min(28, fit(g, 'Google Play', (p) => `700 ${p}px system-ui, sans-serif`, 28, max))}px system-ui, sans-serif`, '#ffffff', 'left', max);
}

/* ------------------------------ Le son ------------------------------ */

/** Les instants du son, tirés du minutage de l'image : un clic tombe pile sur son toucher. */
export type BioSoundCues = {
  pop: number;
  taps: number[];
  whooshes: number[];
  /** [début, fin, nombre de lettres] de chaque saisie. */
  typing: [number, number, number][];
  success: number;
  stores: number;
  /** Impact sourd de l'accroche, montée avant la confirmation, souffles de caméra (26 nov. 2026). */
  impact?: number;
  riser?: number;
  zooms?: number[];
};

export function bioSoundCues(_d: BioVideoData): BioSoundCues {
  return {
    pop: 260,
    taps: [TAP.bio, TAP.choose, TAP.day, TAP.hour, TAP.google, TAP.link],
    whooshes: [T.iris - 120, T.browser, T.when, T.ident, T.done, T.end],
    typing: [],
    success: T.done + 300,
    stores: STORES_AT + 150,
    impact: 60,
    riser: T.done + 120,
    zooms: [3600, 6150, 8350, 11150],
  };
}

/** La voix off enregistrée (homme, darija + français), pour tous les salons et toutes les langues. */
export function bioVoiceLines(d: BioVideoData): VoiceLine[] {
  return d.voix.filter((v) => v.file).map((v) => ({ at: v.start, file: v.file! }));
}

/* ------------------------------ La fin ------------------------------ */

const LINK_Y = 690;

function drawEnd(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  // Photo cerclée d'un anneau qui tourne (couleur du salon → or).
  const a = spring(ms / 700);
  g.save();
  g.translate(W / 2, 330);
  g.scale(a, a);
  const ring = g.createConicGradient(ms / 900, 0, 0);
  ring.addColorStop(0, d.accent);
  ring.addColorStop(0.5, GOLD);
  ring.addColorStop(1, d.accent);
  g.strokeStyle = ring;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, 0, 100, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = CREAM;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 93, 0, Math.PI * 2);
  g.stroke();
  avatar(g, d, 0, 0, 90);
  g.restore();
  const px = fit(g, d.salon, (p) => fl(600, p), 58, W - 80);
  kinetic(g, d.salon, W / 2, 500, fl(600, px), INK, ms - 250, 90, 'center');
  if (d.ratingValue) {
    for (let i = 0; i < 5; i += 1) {
      const k = spring((ms - 600 - i * 70) / 380);
      if (k <= 0) continue;
      g.save();
      g.translate(W / 2 - 110 + i * 34, 546);
      g.scale(k, k);
      star(g, 0, 0, 13, GOLD, clamp(d.ratingValue - i));
      g.restore();
    }
    g.globalAlpha = out((ms - 950) / 400);
    line(g, d.rating, W / 2 + 62, 555, f(500, 22), INK);
    g.globalAlpha = 1;
  }
  kinetic(g, t('Réservez en 30 secondes.'), W / 2, 630, f(500, 34), INK, ms - 800, 70, 'center');
  // Le lien, en noir brillant, traversé d'un reflet ; le curseur vient le cliquer.
  const la = outQuint((ms - 1100) / 520);
  if (la > 0) {
    g.save();
    g.globalAlpha = la;
    g.translate(0, (1 - la) * 30);
    const pressed = pressedAt(ms + T.end, TAP.link);
    pressScale(g, W / 2, LINK_Y + 44, pressed);
    gloss(g, 50, LINK_Y, W - 100, 88, 44);
    g.save();
    g.beginPath();
    g.roundRect(50, LINK_Y, W - 100, 88, 44);
    g.clip();
    const sh = ((ms - 1400) % 1900) / 1900;
    if (ms > 1400) {
      const sx = mix(-200, W + 200, sh);
      const gr = g.createLinearGradient(sx - 90, 0, sx + 90, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.28)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(50, LINK_Y, W - 100, 88);
    }
    g.restore();
    const lp = fit(g, d.link, (p) => f(500, p), 30, W - 160);
    line(g, d.link, W / 2, LINK_Y + 55, f(500, lp), '#ffffff', 'center', W - 150);
    g.restore();
  }
  g.globalAlpha = out((ms - 1500) / 450);
  line(g, `${t('Lien dans la bio')} · @${d.handle}`, W / 2, 822, f(400, 23), MUTED, 'center', W - 80);
  g.globalAlpha = 1;
  // « Disponible en application » : les deux boutiques, qui se posent l'une après l'autre.
  const sIn = ms - (STORES_AT - T.end);
  if (sIn > 0) {
    g.globalAlpha = out(sIn / 400);
    line(g, t('Disponible en application'), W / 2, 920, f(500, 28), INK, 'center', W - 80);
    g.globalAlpha = 1;
    const bw = 280;
    const gap = 16;
    const x0 = (W - bw * 2 - gap) / 2;
    (['apple', 'google'] as const).forEach((kind, i) => {
      const k = spring((sIn - 150 - i * 140) / 520);
      if (k <= 0) return;
      g.save();
      g.globalAlpha = clamp((sIn - 150 - i * 140) / 200);
      const cx = x0 + i * (bw + gap) + bw / 2;
      g.translate(cx, 988);
      g.scale(k, k);
      g.translate(-cx, -988);
      storeBadge(g, x0 + i * (bw + gap), 950, bw, 76, kind);
      g.restore();
    });
  }
  // Marque en pied.
  g.globalAlpha = out((ms - 2000) / 600) * 0.9;
  g.font = `600 24px ${SANS}`;
  const w1 = g.measureText('Salon ').width;
  g.font = `400 24px ${SANS}`;
  const w2 = g.measureText('DZ').width;
  const bx = W / 2 - (w1 + w2) / 2;
  line(g, 'Salon ', bx, 1250, `600 24px ${SANS}`, INK);
  line(g, 'DZ', bx + w1, 1250, `400 24px ${SANS}`, SUBTLE);
  g.globalAlpha = 1;
  // Dernier clic, sur le lien.
  const keys: [number, number, number][] = [
    [T.end + 1500, 620, 1060],
    [TAP.link - 160, W - 160, LINK_Y + 34],
    [TAP.link + 800, W - 160, LINK_Y + 34],
  ];
  const at = cursorAt(keys, ms + T.end);
  if (at) drawCursor(g, at[0], at[1], ms + T.end, [TAP.link], d.accent, 1.5);
}


/* ------------------------------ Les sous-titres ------------------------------ */

/**
 * Sous-titres de la voix off, façon TikTok : les mots arrivent un à un (petit rebond), le mot dit est
 * en OR, sur un bandeau sombre lisible par-dessus n'importe quel écran. Le minutage des mots suit leur
 * longueur dans la durée réelle de la phrase.
 */
const CAP_Y = 1150;
function drawCaptions(g: CanvasRenderingContext2D, ms: number, d: BioVideoData) {
  const v = d.voix.find((x) => ms >= x.start - 80 && ms <= x.start + x.dur + 450);
  if (!v) return;
  const words = v.text.split(' ');
  const poids = words.map((w) => w.length + 2);
  const total = poids.reduce((a, b) => a + b, 0);
  let acc = 0;
  const debut = words.map((_, i) => {
    const t0 = v.start + (acc / total) * v.dur;
    acc += poids[i]!;
    return t0;
  });
  const font = f(600, 34);
  g.font = font;
  const space = g.measureText(' ').width;
  // Deux lignes au plus, coupées au mot.
  const maxW = W - 120;
  const lignes: number[][] = [[]];
  let lw = 0;
  words.forEach((w, i) => {
    const ww = g.measureText(w).width;
    if (lw && lw + space + ww > maxW) {
      lignes.push([]);
      lw = 0;
    }
    lignes[lignes.length - 1]!.push(i);
    lw += (lw ? space : 0) + ww;
  });
  const sortie = clamp((ms - (v.start + v.dur + 150)) / 300);
  const entree = out((ms - v.start + 80) / 220);
  const lh = 50;
  const y0 = CAP_Y - ((lignes.length - 1) * lh) / 2;
  g.save();
  g.globalAlpha = entree * (1 - sortie);
  lignes.forEach((idx, li) => {
    const largeurs = idx.map((i) => g.measureText(words[i]!).width);
    const lwid = largeurs.reduce((a, b) => a + b, 0) + space * (idx.length - 1);
    const y = y0 + li * lh;
    box(g, W / 2 - lwid / 2 - 18, y - 36, lwid + 36, 48, 14, 'rgba(24,22,20,.78)');
    let x = W / 2 - lwid / 2;
    idx.forEach((i, n) => {
      // Karaoké : déjà dit = blanc, en cours = OR avec un petit rebond, à venir = blanc voilé.
      const dit = ms >= debut[i]! && (i === words.length - 1 || ms < debut[i + 1]!);
      const passe = ms >= debut[i]!;
      const k = dit ? spring((ms - debut[i]!) / 240) : 1;
      // Le mot dit saute légèrement vers le haut (sans grossir : il ne mord jamais sur ses voisins).
      const saut = dit ? Math.sin(clamp(k) * Math.PI) * 5 : 0;
      line(g, words[i]!, x, y - saut, font, dit ? '#ffd166' : passe ? '#ffffff' : 'rgba(255,255,255,.5)');
      x += largeurs[n]! + space;
    });
  });
  g.restore();
}

/* ------------------------------ L'image ------------------------------ */

/** Dessine l'image de la vidéo à l'instant `ms`. */
export function drawBioFrame(g: CanvasRenderingContext2D, at: number, d: BioVideoData) {
  const ms = Math.max(0, at);
  g.textBaseline = 'alphabetic';
  g.globalAlpha = 1;
  g.filter = 'none';

  // 1 · L'accroche plein cadre, puis l'ouverture en cercle vers le fond crème.
  if (ms < T.iris + 520) {
    drawBackdrop(g, d, ms);
    const k = clamp((ms - T.iris) / 520);
    if (k < 1) {
      g.save();
      if (k > 0) {
        // Le cercle de la photo se referme sur le centre (iris) pendant qu'elle s'approche.
        g.beginPath();
        g.arc(W / 2, H * 0.55, Math.hypot(W, H) * (1 - inn(k)), 0, Math.PI * 2);
        g.clip();
        g.translate(W / 2, H * 0.55);
        g.scale(1 + k * 0.25, 1 + k * 0.25);
        g.translate(-W / 2, -H * 0.55);
      }
      drawHook(g, ms, d);
      g.restore();
    }
    if (ms < T.phoneIn - 200) {
      drawCaptions(g, ms, d);
      return;
    }
  } else drawBackdrop(g, d, ms);

  // 4 · La fin : le téléphone s'éloigne, la fin s'installe.
  if (ms >= T.end) {
    const k = ease((ms - T.end) / 600);
    if (k < 1) {
      g.save();
      g.globalAlpha = 1 - k;
      const s = PHONE_S * mix(1.12, 0.7, k);
      phoneFrame(g, W / 2 - (PW * s) / 2, mix(PHONE.y - 40, PHONE.y + 220, k), s, () => drawScreens(g, ms, d), () => undefined);
      g.restore();
    }
    drawEnd(g, ms - T.end, d);
    drawCaptions(g, ms, d);
    return;
  }

  // 2 · Le téléphone arrive (ressort + légère rotation), la caméra suit chaque geste.
  const ink = spring((ms - (T.phoneIn - 200)) / 760);
  const y = mix(H + 80, PHONE.y, ink);
  const rot = (1 - clamp((ms - (T.phoneIn - 200)) / 760)) * -0.12;
  const [zoom, fx, fy] = cameraAt(cameraKeys(d), ms);
  const keys = cursorPath(d);
  const taps = [TAP.bio, TAP.choose, TAP.day, TAP.hour, TAP.google];
  g.save();
  // Le point visé de l'écran glisse vers le centre utile de l'image à mesure qu'on zoome.
  const Fx = PHONE.x + fx * PHONE_S;
  const Fy = y + fy * PHONE_S;
  const pull = clamp((zoom - 1) / 0.45);
  const Tx = mix(Fx, W / 2, pull);
  const Ty = mix(Fy, 800, pull);
  g.translate(Tx, Ty);
  g.scale(zoom, zoom);
  g.rotate(rot);
  g.translate(-Fx, -Fy);
  phoneFrame(g, PHONE.x, y, PHONE_S, () => drawScreens(g, ms, d), () => {
    const c = cursorAt(keys, ms);
    if (c) drawCursor(g, c[0], c[1], ms, taps, d.accent);
  });
  g.restore();
  drawConfetti(g, ms - T.done - 200, d);
  drawStepTitle(g, ms, d);
  drawCaptions(g, ms, d);
}
