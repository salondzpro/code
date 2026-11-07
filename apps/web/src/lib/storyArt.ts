/**
 * Le dessin d'une story (7 nov. 2026) : une seule fonction qui rend la story À UN INSTANT DONNÉ. La
 * vidéo animée en enchaîne les images ; l'image fixe et les aperçus en prennent le dernier instant. Une
 * story explique d'elle-même ce qu'il faut faire : le salon, « places disponibles », le jour, combien de
 * créneaux restent, les créneaux rangés matin / après-midi / soir, trois étapes pour réserver, le lien.
 *
 * Repère 1080 × 1920. Instagram pose ses boutons en haut et en bas : rien d'important au-dessus de
 * SAFE_TOP ni sous la barre du lien.
 */
import { t } from '@/i18n';

export const STORY_W = 1080;
export const STORY_H = 1920;
/** Durée de la vidéo : les entrées durent ~3,5 s, le reste laisse lire. */
export const STORY_MS = 8000;
/** Instant « tout est en place » : c'est l'image fixe. */
export const STORY_STILL = Number.POSITIVE_INFINITY;

export type StoryModel = 'photo' | 'violet' | 'clair';

export interface StoryArt {
  model: StoryModel;
  photo: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  salon: string;
  dayLabel: string;
  dateLabel: string | null;
  times: string[];
  link: string;
}

const INK = '#1e1b30';
const MUTED = '#636174';
const ACCENT = '#6c5ce7';
const ACCENT_SOFT = '#f0effe';
const ACCENT_TINT = '#e5e3fe';
const OK = '#18a66a';
const M = 72;
const SAFE_TOP = 250;
const LINK_Y = STORY_H - 340;
const LINK_H = 132;
const STEPS_Y = LINK_Y - 196;
const DISPLAY = 'Outfit, Inter, sans-serif';
const BODY = 'Inter, sans-serif';

/* ------------------------------------------------------------------ outils */

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const out3 = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
/** Avancement d'une entrée : 0 avant `at`, 1 après `at + dur`, adouci. */
const step = (ms: number, at: number, dur = 520) => (ms === STORY_STILL ? 1 : out3((ms - at) / dur));

function font(g: CanvasRenderingContext2D, weight: number, size: number, family = DISPLAY) {
  g.font = `${weight} ${size}px ${family}`;
}
/** La plus grande taille qui tient : un long nom ne se tasse pas, il rapetisse. */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number, family = DISPLAY) {
  let px = size;
  font(g, weight, px, family);
  while (px > 24 && g.measureText(text).width > max) {
    px -= 2;
    font(g, weight, px, family);
  }
  return px;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
}
/** Apparition : opacité et léger glissement, sans rebond. */
function enter(g: CanvasRenderingContext2D, k: number, dx: number, dy: number, draw: () => void) {
  if (k <= 0) return;
  g.save();
  g.globalAlpha *= k;
  g.translate(dx * (1 - k), dy * (1 - k));
  draw();
  g.restore();
}
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1) {
  const r = Math.max(w / img.width, h / img.height) * zoom;
  const iw = img.width * r;
  const ih = img.height * r;
  g.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

type Theme = { text: string; sub: string; card: string; cardText: string; cardLine: string | null; icon: string; iconFg: string; chip: string; chipText: string; bar: string; barText: string; step: string; stepText: string };

const THEMES: Record<StoryModel, Theme> = {
  photo: {
    text: '#ffffff',
    sub: 'rgba(255,255,255,.86)',
    card: 'rgba(255,255,255,.16)',
    cardText: '#ffffff',
    cardLine: 'rgba(255,255,255,.28)',
    icon: 'rgba(255,255,255,.22)',
    iconFg: '#ffffff',
    chip: 'rgba(255,255,255,.18)',
    chipText: '#ffffff',
    bar: ACCENT,
    barText: '#ffffff',
    step: '#ffffff',
    stepText: INK,
  },
  violet: {
    text: '#ffffff',
    sub: 'rgba(255,255,255,.88)',
    card: '#ffffff',
    cardText: INK,
    cardLine: null,
    icon: ACCENT_SOFT,
    iconFg: ACCENT,
    chip: 'rgba(255,255,255,.2)',
    chipText: '#ffffff',
    bar: INK,
    barText: '#ffffff',
    step: '#ffffff',
    stepText: ACCENT,
  },
  clair: {
    text: INK,
    sub: MUTED,
    card: '#ffffff',
    cardText: INK,
    cardLine: '#e6e5ee',
    icon: ACCENT_SOFT,
    iconFg: ACCENT,
    chip: ACCENT_SOFT,
    chipText: ACCENT,
    bar: INK,
    barText: '#ffffff',
    step: ACCENT,
    stepText: '#ffffff',
  },
};

/* ------------------------------------------------------------------ fond */

function background(g: CanvasRenderingContext2D, a: StoryArt, ms: number) {
  const drift = ms === STORY_STILL ? 1 : clamp(ms / STORY_MS);
  if (a.model === 'photo' && a.photo) {
    // La photo avance doucement tout au long de la vidéo.
    cover(g, a.photo, 0, 0, STORY_W, STORY_H, 1.12 - 0.08 * drift);
    const veil = g.createLinearGradient(0, 0, 0, STORY_H);
    veil.addColorStop(0, 'rgba(20,16,36,.55)');
    veil.addColorStop(0.35, 'rgba(20,16,36,.62)');
    veil.addColorStop(1, 'rgba(20,16,36,.9)');
    g.fillStyle = veil;
    g.fillRect(0, 0, STORY_W, STORY_H);
    return;
  }
  if (a.model === 'clair') {
    g.fillStyle = '#f7f6fe';
    g.fillRect(0, 0, STORY_W, STORY_H);
    g.fillStyle = ACCENT_TINT;
    g.beginPath();
    g.arc(STORY_W + 40 - 30 * drift, -60, 420, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // Violet : le fond uni et de grands disques qui glissent lentement.
  g.fillStyle = ACCENT;
  g.fillRect(0, 0, STORY_W, STORY_H);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath();
  g.arc(STORY_W - 60 - 40 * drift, 260 + 30 * drift, 520, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(-120 + 40 * drift, STORY_H - 420, 380, 0, Math.PI * 2);
  g.fill();
}

/* ------------------------------------------------------------------ morceaux */

function header(g: CanvasRenderingContext2D, a: StoryArt, th: Theme, ms: number) {
  enter(g, step(ms, 0, 600), 0, -30, () => {
    const s = 104;
    const x = M;
    const y = SAFE_TOP;
    g.save();
    g.beginPath();
    g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    g.closePath();
    g.fillStyle = a.model === 'clair' ? ACCENT : 'rgba(255,255,255,.22)';
    g.fill();
    const img = a.logo ?? a.photo;
    if (img) {
      g.clip();
      cover(g, img, x, y, s, s);
    } else {
      g.fillStyle = '#ffffff';
      font(g, 600, 44);
      g.textAlign = 'center';
      g.fillText(a.salon.slice(0, 1).toUpperCase(), x + s / 2, y + s / 2 + 16);
    }
    g.restore();
    g.strokeStyle = a.model === 'clair' ? '#ffffff' : 'rgba(255,255,255,.9)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
    g.stroke();
    g.textAlign = 'left';
    g.fillStyle = th.text;
    fit(g, a.salon, 600, 46, STORY_W - M * 2 - s - 28);
    g.fillText(a.salon, x + s + 28, y + 46);
    g.fillStyle = th.sub;
    font(g, 500, 30, BODY);
    g.fillText(t('Réservation en ligne'), x + s + 28, y + 88);
  });
}

function kicker(g: CanvasRenderingContext2D, th: Theme, ms: number) {
  const k = step(ms, 300, 500);
  enter(g, k, 0, 20, () => {
    const label = t('Places disponibles');
    font(g, 600, 32, BODY);
    const w = g.measureText(label).width + 96;
    const y = 420;
    rr(g, M, y, w, 66, 33);
    g.fillStyle = th.chip;
    g.fill();
    const cx = M + 38;
    const cy = y + 33;
    // Le point « en direct » : un anneau qui s'élargit en boucle dans la vidéo.
    if (ms !== STORY_STILL) {
      const p = ((ms % 1400) / 1400);
      g.beginPath();
      g.arc(cx, cy, 9 + 16 * p, 0, Math.PI * 2);
      g.fillStyle = `rgba(24,166,106,${0.45 * (1 - p)})`;
      g.fill();
    }
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.fillStyle = OK;
    g.fill();
    g.fillStyle = th.chipText;
    g.fillText(label, M + 62, y + 44);
  });
}

function headline(g: CanvasRenderingContext2D, a: StoryArt, th: Theme, ms: number) {
  enter(g, step(ms, 500, 620), 0, 40, () => {
    g.fillStyle = th.text;
    fit(g, a.dayLabel, 600, 150, STORY_W - M * 2);
    g.fillText(a.dayLabel, M - 4, 610);
  });
  enter(g, step(ms, 800, 520), 0, 24, () => {
    const n = a.times.length;
    const left = n === 1 ? t('Encore 1 créneau libre') : t('Encore {n} créneaux libres', { n });
    const line = a.dateLabel ? `${a.dateLabel} · ${left}` : left;
    g.fillStyle = th.sub;
    fit(g, line, 500, 40, STORY_W - M * 2, BODY);
    g.fillText(line, M, 682);
  });
}

type Group = { label: string | null; times: string[] };
const startHour = (range: string) => Number(range.slice(0, 2)) || 0;
function groups(times: string[]): Group[] {
  const parts: Group[] = [
    { label: t('Matin'), times: times.filter((x) => startHour(x) < 12) },
    { label: t('Après-midi'), times: times.filter((x) => startHour(x) >= 12 && startHour(x) < 17) },
    { label: t('Soir'), times: times.filter((x) => startHour(x) >= 17) },
  ].filter((p) => p.times.length);
  return parts;
}

function clock(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = Math.max(3, r * 0.16);
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - r * 0.55);
  g.lineTo(cx, cy);
  g.lineTo(cx + r * 0.42, cy + r * 0.28);
  g.stroke();
}

function slots(g: CanvasRenderingContext2D, a: StoryArt, th: Theme, ms: number) {
  const top = 744;
  const bottom = STEPS_Y - 70;
  const room = bottom - top;
  const gs = groups(a.times);
  const n = a.times.length;
  const gap = 16;
  const head = 50;
  // Une colonne avec les titres de période tant que ça tient ; sinon deux colonnes, sans titres.
  let cols = 1;
  // Peu de créneaux : de grandes cartes, et le bloc centré entre le titre et les étapes.
  let h = Math.min(n <= 3 ? 136 : 116, (room - gs.length * head - (n - 1) * gap) / n);
  if (h < 84) {
    cols = 2;
    const rows = Math.ceil(n / 2);
    h = Math.min(104, (room - (rows - 1) * gap) / rows);
  }
  const w = (STORY_W - M * 2 - gap * (cols - 1)) / cols;
  const used = cols === 1 ? n * h + (n - 1) * gap + gs.length * head : Math.ceil(n / 2) * (h + gap) - gap;
  let y = top + Math.max(0, room - used) * 0.4;
  let i = 0;
  const card = (x: number, yy: number, range: string, idx: number) => {
    const k = step(ms, 1200 + idx * 150, 480);
    enter(g, k, 70, 0, () => {
      rr(g, x, yy, w, h, 26);
      g.fillStyle = th.card;
      g.fill();
      if (th.cardLine) {
        g.strokeStyle = th.cardLine;
        g.lineWidth = 2;
        g.stroke();
      }
      const ir = h * 0.3;
      const cx = x + 22 + ir;
      const cy = yy + h / 2;
      if (cols === 1) {
        g.beginPath();
        g.arc(cx, cy, ir, 0, Math.PI * 2);
        g.fillStyle = th.icon;
        g.fill();
        clock(g, cx, cy, ir * 0.5, th.iconFg);
      }
      g.fillStyle = th.cardText;
      const tx = cols === 1 ? cx + ir + 26 : x + w / 2;
      g.textAlign = cols === 1 ? 'left' : 'center';
      fit(g, range, 600, Math.round(h * 0.4), cols === 1 ? w - (tx - x) - 170 : w - 32);
      g.fillText(range, tx, cy + h * 0.14);
      g.textAlign = 'left';
      if (cols === 1) {
        // L'étiquette « Libre » à droite, avec son point vert.
        const lab = t('Libre');
        font(g, 600, 28, BODY);
        const lw = g.measureText(lab).width + 62;
        const lx = x + w - 22 - lw;
        rr(g, lx, cy - 25, lw, 50, 25);
        g.fillStyle = a.model === 'photo' ? 'rgba(255,255,255,.2)' : '#e2f6ec';
        g.fill();
        g.beginPath();
        g.arc(lx + 24, cy, 7, 0, Math.PI * 2);
        g.fillStyle = OK;
        g.fill();
        g.fillStyle = a.model === 'photo' ? '#ffffff' : '#0e7a4d';
        g.fillText(lab, lx + 40, cy + 10);
      }
    });
  };
  if (cols === 1) {
    for (const grp of gs) {
      const k = step(ms, 1100 + i * 150, 420);
      enter(g, k, 0, 10, () => {
        g.fillStyle = th.sub;
        font(g, 600, 30, BODY);
        g.fillText(grp.label ?? '', M + 4, y + 34);
      });
      y += head;
      for (const r of grp.times) {
        card(M, y, r, i);
        y += h + gap;
        i += 1;
      }
    }
  } else {
    a.times.forEach((r, idx) => card(M + (idx % 2) * (w + gap), y + Math.floor(idx / 2) * (h + gap), r, idx));
  }
}

function steps(g: CanvasRenderingContext2D, a: StoryArt, th: Theme, ms: number) {
  const items = [t('Touche le lien'), t('Choisis l’heure'), t('C’est réservé')];
  const base = 1300 + a.times.length * 150 + 200;
  const colW = (STORY_W - M * 2) / 3;
  enter(g, step(ms, base - 150, 400), 0, 10, () => {
    g.fillStyle = th.sub;
    font(g, 600, 30, BODY);
    g.fillText(t('Comment réserver'), M + 4, STEPS_Y + 6);
  });
  items.forEach((label, i) => {
    const k = step(ms, base + i * 180, 460);
    enter(g, k, 0, 24, () => {
      const cx = M + colW * i + 44;
      const cy = STEPS_Y + 74;
      g.beginPath();
      g.arc(cx, cy, 36, 0, Math.PI * 2);
      g.fillStyle = th.step;
      g.fill();
      g.fillStyle = th.stepText;
      font(g, 600, 34);
      g.textAlign = 'center';
      g.fillText(String(i + 1), cx, cy + 12);
      g.textAlign = 'left';
      g.fillStyle = th.text;
      fit(g, label, 600, 30, colW - 128, BODY);
      g.fillText(label, cx + 50, cy + 11);
      if (i < 2) {
        // Une flèche fine vers l'étape suivante.
        g.strokeStyle = th.sub;
        g.lineWidth = 3;
        const ax = M + colW * (i + 1) - 8;
        g.beginPath();
        g.moveTo(ax - 10, cy - 9);
        g.lineTo(ax, cy);
        g.lineTo(ax - 10, cy + 9);
        g.stroke();
      }
    });
  });
}

function linkBar(g: CanvasRenderingContext2D, a: StoryArt, th: Theme, ms: number) {
  const at = 1500 + a.times.length * 150 + 900;
  const k = step(ms, at, 560);
  enter(g, k, 0, 60, () => {
    const x = M;
    const w = STORY_W - M * 2;
    rr(g, x, LINK_Y, w, LINK_H, 40);
    g.fillStyle = th.bar;
    g.fill();
    // Un reflet qui traverse la barre toutes les 2 s, dans la vidéo seulement.
    if (ms !== STORY_STILL && ms > at + 600) {
      const p = ((ms - at - 600) % 2000) / 2000;
      if (p < 0.5) {
        const sx = x - 200 + (w + 400) * (p / 0.5);
        g.save();
        rr(g, x, LINK_Y, w, LINK_H, 40);
        g.clip();
        const sh = g.createLinearGradient(sx - 120, 0, sx + 120, 0);
        sh.addColorStop(0, 'rgba(255,255,255,0)');
        sh.addColorStop(0.5, 'rgba(255,255,255,.28)');
        sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh;
        g.fillRect(sx - 120, LINK_Y, 240, LINK_H);
        g.restore();
      }
    }
    // Pastille à flèche, puis « Réserve ici » et le lien.
    const cx = x + 30 + 38;
    const cy = LINK_Y + LINK_H / 2;
    g.beginPath();
    g.arc(cx, cy, 38, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.fill();
    g.strokeStyle = th.barText;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 11, cy + 11);
    g.lineTo(cx + 11, cy - 11);
    g.moveTo(cx - 5, cy - 11);
    g.lineTo(cx + 11, cy - 11);
    g.lineTo(cx + 11, cy + 5);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.75)';
    font(g, 500, 28, BODY);
    g.fillText(t('Réserve ici'), cx + 62, cy - 10);
    g.fillStyle = th.barText;
    fit(g, a.link, 600, 42, w - (cx + 62 - x) - 34);
    g.fillText(a.link, cx + 62, cy + 34);
  });
}

/** Dessine la story à l'instant `ms` (STORY_STILL = l'image fixe). Le contexte peut être réduit par `scale`. */
export function drawStoryFrame(g: CanvasRenderingContext2D, a: StoryArt, ms: number) {
  const th = THEMES[a.model === 'photo' && !a.photo ? 'violet' : a.model];
  g.save();
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.direction = 'ltr';
  background(g, a, ms);
  header(g, a, th, ms);
  kicker(g, th, ms);
  headline(g, a, th, ms);
  slots(g, a, th, ms);
  steps(g, a, th, ms);
  linkBar(g, a, th, ms);
  g.restore();
}
