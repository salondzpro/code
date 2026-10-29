/**
 * ÉTIQUETTES À IMPRIMER (29 oct. 2026) — affiche de vitrine A5 et autocollant carré de comptoir,
 * rendus dans le navigateur sur un canvas à 300 points par pouce, puis enregistrés en PNG dont la
 * résolution est DÉCLARÉE à l'imprimeur (bloc `pHYs`) : ouvert dans un logiciel d'impression, le
 * fichier sort à la bonne taille, sans réglage.
 *
 * Chaque étiquette porte, de haut en bas : la marque Salon DZ, le logo du salon, son NOM EN GRAS,
 * son activité, le QR code (correction d'erreur maximale : il se lit encore abîmé ou mal éclairé),
 * l'appel à scanner en français ET en arabe, et le lien en clair en bas — pour qui n'a pas d'appareil
 * photo sous la main.
 *
 * Les modèles (`LABEL_TEMPLATES` de `@salondz/constants`) ne diffèrent que par leur PALETTE et leur
 * typographie : la mise en page est la même pour tous, donc un salon change de modèle sans que rien
 * ne bouge de place. Le modèle « Selon le métier » prend les couleurs de l'activité principale du
 * salon (ongles, cils, barbier, coiffure, soins…).
 */
import QRCode from 'qrcode';
import {
  categoryLabel,
  categoryTone,
  FACEBOOK_COLOR,
  INSTAGRAM_GRADIENT,
  INSTAGRAM_PATH,
  SNAPCHAT_COLOR,
  SNAPCHAT_PATH,
  TIKTOK_CYAN,
  TIKTOK_CYAN_OFFSET,
  TIKTOK_PATH,
  TIKTOK_RED,
  TIKTOK_RED_OFFSET,
  type LabelFormat, type LabelSocial, type LabelSocialId, type LabelTemplateId } from '@salondz/constants';

export interface LabelInput {
  name: string;
  /** Adresse complète encodée dans le QR. */
  url: string;
  /** Lien lisible imprimé en bas (sans « https:// »). */
  short: string;
  logoUrl?: string | null;
  categoryIds?: string[];
  /** Public du salon : choisit la typographie du modèle « Selon le métier ». */
  audience?: 'men' | 'women' | 'unisex';
  /** Réseaux imprimés par le modèle « Vitrine noire » (seuls ceux `shown` avec un nom). */
  socials?: LabelSocial[];
}

/** Tailles en pixels, 300 points par pouce : A5 (148 × 210 mm) et carré de 12,7 cm. */
export const LABEL_SIZES: Record<LabelFormat, { w: number; h: number; mm: string }> = {
  affiche: { w: 1748, h: 2480, mm: '148 × 210 mm (A5)' },
  carre: { w: 1500, h: 1500, mm: '127 × 127 mm' },
};

interface Palette {
  bg: string;
  /** Second ton du fond (dégradé vertical). */
  bg2: string;
  ink: string;
  muted: string;
  accent: string;
  /** Bande du lien, en bas. */
  band: string;
  bandInk: string;
  /** Cadre fin intérieur (affiche). */
  frame: string | null;
  serif: boolean;
  /** Nom en capitales espacées (barbier) ou en casse normale. */
  caps: boolean;
  /** Motif discret du fond. */
  motif: 'none' | 'stripes' | 'sparkles' | 'dots';
}

const SERIF = "'Playfair Label', 'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const ARABIC = "'Segoe UI', 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Geeza Pro', Tahoma, sans-serif";

/** Couleurs des métiers : celles de l'agenda (`--color-cat-*`), assombries pour l'impression. */
const TONES: Record<string, { bg: string; bg2: string; accent: string; ink: string }> = {
  hair: { bg: '#E9F7F7', bg2: '#D3EEEF', accent: '#1F8A91', ink: '#0B3F43' },
  barb: { bg: '#E8EEFF', bg2: '#D5E0FF', accent: '#3C5FC4', ink: '#1C2F66' },
  nail: { bg: '#FCEEF3', bg2: '#F8DCE6', accent: '#C2477A', ink: '#5E1F38' },
  lash: { bg: '#F0EAFF', bg2: '#E1D6FF', accent: '#6B45C2', ink: '#33206B' },
  skin: { bg: '#EAF6EF', bg2: '#D6EEDF', accent: '#2F8754', ink: '#164A2D' },
  lasr: { bg: '#FDF0E4', bg2: '#F9E0C9', accent: '#B8692C', ink: '#5C3010' },
};

function palette(id: LabelTemplateId, input: LabelInput): Palette {
  switch (id) {
    case 'vitrine':
    case 'elegance':
      return { bg: '#FCF3F6', bg2: '#F5DFE7', ink: '#3A1C2A', muted: '#8A6474', accent: '#B83D6E', band: '#B83D6E', bandInk: '#FFFFFF', frame: '#D9A9BA', serif: true, caps: false, motif: 'sparkles' };
    case 'nude':
      return { bg: '#F7F1EA', bg2: '#EADFD2', ink: '#2B2420', muted: '#7D6F63', accent: '#A47A45', band: '#2B2420', bandInk: '#F1E4CF', frame: '#C9AD84', serif: true, caps: false, motif: 'none' };
    case 'noir':
      return { bg: '#141517', bg2: '#0C0D0E', ink: '#FFFFFF', muted: '#A9ABAE', accent: '#C8A15A', band: '#C8A15A', bandInk: '#111214', frame: '#3A3B3E', serif: false, caps: true, motif: 'stripes' };
    case 'ardoise':
      return { bg: '#24323C', bg2: '#18232B', ink: '#FFFFFF', muted: '#A8B6C0', accent: '#5FD0B0', band: '#5FD0B0', bandInk: '#0E1A20', frame: '#3A4A55', serif: false, caps: false, motif: 'dots' };
    case 'minimal':
      return { bg: '#FFFFFF', bg2: '#FFFFFF', ink: '#111214', muted: '#6B6F73', accent: '#111214', band: '#111214', bandInk: '#FFFFFF', frame: '#E6E7E9', serif: false, caps: false, motif: 'none' };
    case 'marque':
      return { bg: '#111214', bg2: '#1B1D20', ink: '#FFFFFF', muted: '#A9ABAE', accent: '#3DDC97', band: '#3DDC97', bandInk: '#0B2B1D', frame: null, serif: false, caps: false, motif: 'none' };
    case 'categorie': {
      const t = TONES[categoryTone(input.categoryIds?.[0])] ?? TONES.barb!;
      return { bg: t.bg, bg2: t.bg2, ink: t.ink, muted: t.ink + 'B3', accent: t.accent, band: t.accent, bandInk: '#FFFFFF', frame: t.accent + '55', serif: input.audience === 'women', caps: false, motif: 'dots' };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Outils de dessin
// ---------------------------------------------------------------------------------------------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** Coupe un nom en au plus `lines` lignes tenant dans `max` px, en réduisant la taille si besoin. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, min: number, max: number, lines: number): { px: number; rows: string[] } {
  for (let px = start; px >= min; px -= 2) {
    ctx.font = font(px);
    const words = text.split(/\s+/);
    const rows: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= max) cur = next;
      else {
        if (cur) rows.push(cur);
        cur = w;
      }
    }
    if (cur) rows.push(cur);
    if (rows.length <= lines && rows.every((r) => ctx.measureText(r).width <= max)) return { px, rows };
  }
  ctx.font = font(min);
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return { px: min, rows: [t + '…'] };
}

/** Espacement des lettres (pour les capitales du barbier et les petits titres). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text];
  const total = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  ctx.textAlign = align;
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function motif(ctx: CanvasRenderingContext2D, p: Palette, W: number, H: number, u: number) {
  ctx.save();
  if (p.motif === 'stripes') {
    // Rayures obliques très discrètes : l'enseigne du barbier, sans le folklore.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 18 * u;
    for (let x = -H; x < W; x += 70 * u) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
  } else if (p.motif === 'dots') {
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.07;
    for (let y = 30 * u; y < H; y += 34 * u) for (let x = 30 * u; x < W; x += 34 * u) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Marque Salon DZ, dessinée (même construction que `components/Wordmark.tsx`) : « Salon » plein, « DZ » léger. */
function wordmark(ctx: CanvasRenderingContext2D, cx: number, y: number, px: number, color: string, sub: string | null, u: number) {
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = `700 ${px}px ${SANS}`;
  const a = ctx.measureText('Salon').width;
  ctx.font = `400 ${px}px ${SANS}`;
  const gap = px * 0.22;
  const b = ctx.measureText('DZ').width;
  const x0 = cx - (a + gap + b) / 2;
  ctx.textAlign = 'left';
  ctx.font = `700 ${px}px ${SANS}`;
  ctx.fillText('Salon', x0, y);
  ctx.globalAlpha = 0.6;
  ctx.font = `400 ${px}px ${SANS}`;
  ctx.fillText('DZ', x0 + a + gap, y);
  ctx.globalAlpha = 1;
  if (sub) {
    ctx.textAlign = 'center';
    ctx.font = `600 ${px * 0.32}px ${SANS}`;
    ctx.globalAlpha = 0.65;
    spaced(ctx, sub, cx, y + px * 0.62, px * 0.09);
    ctx.globalAlpha = 1;
  }
  void u;
}

async function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const c = document.createElement('canvas');
  await QRCode.toCanvas(c, url, { errorCorrectionLevel: 'H', margin: 0, width: Math.round(size), color: { dark: '#111214', light: '#ffffff' } });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, x, y, size, size);
  ctx.imageSmoothingEnabled = true;
}

let fontsReady: Promise<void> | null = null;
/** Polices chargées AVANT de dessiner : un canvas ne les attend pas et dessinerait en police de secours. */
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        const f = new FontFace('Playfair Label', "url(/fonts/playfair-700.woff2) format('woff2')", { weight: '700' });
        const fi = new FontFace('Playfair Label', "url(/fonts/playfair-600i.woff2) format('woff2')", { weight: '600', style: 'italic' });
        await Promise.all([f.load(), fi.load()]).then((faces) => faces.forEach((x) => document.fonts.add(x)));
      } catch {
        /* police de secours (Georgia) : l'étiquette reste propre */
      }
      await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 40px Inter`))).catch(() => undefined);
    })();
  }
  return fontsReady;
}

// ---------------------------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------------------------


// ---------------------------------------------------------------------------------------------
// « Vitrine noire » — autocollant noir de vitrine (29 oct. 2026, d'après le modèle fourni par le
// propriétaire, sans les vis de plaque) : « Salon × Salon DZ » en tête, « Réservation RDV » en très gros, QR, lien, puis
// les réseaux du salon. Mise en page propre, distincte des autres modèles.
// ---------------------------------------------------------------------------------------------

/**
 * Pastilles des réseaux, façon icône d'application : tuile aux couleurs de la marque et glyphe
 * officiel (`@salondz/constants`, mêmes tracés que `components/BrandIcons.tsx`). Aucune image
 * distante : le rendu ne dépend d'aucun serveur.
 */
function socialIcon(ctx: CanvasRenderingContext2D, id: LabelSocialId, x: number, y: number, s: number) {
  ctx.save();
  roundRect(ctx, x, y, s, s, s * 0.24);
  const glyph = (d: string, color: string, k: number, dx = 0, dy = 0) => {
    ctx.save();
    const g = s * k;
    ctx.translate(x + (s - g) / 2 + dx, y + (s - g) / 2 + dy);
    ctx.scale(g / 24, g / 24);
    ctx.fillStyle = color;
    ctx.fill(new Path2D(d));
    ctx.restore();
  };
  if (id === 'instagram') {
    const g = ctx.createLinearGradient(x, y + s, x + s, y);
    for (const st of INSTAGRAM_GRADIENT) g.addColorStop(Number(st.offset), st.color);
    ctx.fillStyle = g;
    ctx.fill();
    glyph(INSTAGRAM_PATH, '#FFFFFF', 0.62);
  } else if (id === 'facebook') {
    ctx.fillStyle = FACEBOOK_COLOR;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${s * 0.86}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('f', x + s * 0.56, y + s * 1.0);
  } else if (id === 'snapchat') {
    ctx.fillStyle = SNAPCHAT_COLOR;
    ctx.fill();
    ctx.save();
    const g = s * 0.64;
    ctx.translate(x + (s - g) / 2, y + (s - g) / 2);
    ctx.scale(g / 24, g / 24);
    const path = new Path2D(SNAPCHAT_PATH);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill(path);
    ctx.strokeStyle = '#111214';
    ctx.lineWidth = 1.1;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();
  } else {
    ctx.fillStyle = '#111214';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    const k = 0.58;
    const f = (s * k) / 24;
    glyph(TIKTOK_PATH, TIKTOK_CYAN, k, TIKTOK_CYAN_OFFSET.x * f, TIKTOK_CYAN_OFFSET.y * f);
    glyph(TIKTOK_PATH, TIKTOK_RED, k, TIKTOK_RED_OFFSET.x * f, TIKTOK_RED_OFFSET.y * f);
    glyph(TIKTOK_PATH, '#FFFFFF', k);
  }
  ctx.restore();
}

async function renderVitrine(format: LabelFormat, input: LabelInput): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = LABEL_SIZES[format];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const u = W / 1000;
  const cx = W / 2;
  const square = format === 'carre';

  // Fond noir mat, très légèrement éclairé au centre
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, H * 0.42, 0, cx, H * 0.42, Math.max(W, H) * 0.75);
  glow.addColorStop(0, '#17181A');
  glow.addColorStop(1, '#050506');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const socials = (input.socials ?? []).filter((x) => x.shown && x.handle.trim());
  const at = (f: number) => H * f;
  // Repères verticaux (fraction de la hauteur) ; sans réseaux, le bloc central descend un peu.
  const shift = socials.length ? 0 : square ? 0.05 : 0.05;
  const Y = square
    ? { head: 0.14, title: 0.27 + shift, sub: 0.32 + shift, qr: 0.36 + shift, qrSize: 0.23, link: 0.66 + shift, rule: 0.745, icons: 0.772, handles: 0.884 }
    : { head: 0.165, title: 0.345 + shift, sub: 0.388 + shift, qr: 0.428 + shift, qrSize: 0.25, link: 0.664 + shift, rule: 0.745, icons: 0.772, handles: 0.848 };

  // En-tête : « Nom du salon × Salon DZ » sur une ligne, sinon le nom au-dessus.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  const headMax = 820 * u;
  const brandPx = (square ? 44 : 46) * u;
  ctx.font = `700 ${brandPx}px ${SANS}`;
  const wSalon = ctx.measureText('Salon').width;
  ctx.font = `600 ${brandPx}px ${SANS}`;
  const wDz = ctx.measureText('DZ').width;
  const brandW = wSalon + brandPx * 0.2 + wDz;
  const xPx = brandPx * 0.7;
  ctx.font = `400 ${xPx}px ${SANS}`;
  const xW = ctx.measureText('x').width;
  const gap = brandPx * 0.6;
  const drawBrand = (x0: number, y: number) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${brandPx}px ${SANS}`;
    ctx.fillText('Salon', x0, y);
    ctx.fillStyle = '#9A9DA1';
    ctx.font = `600 ${brandPx}px ${SANS}`;
    ctx.fillText('DZ', x0 + wSalon + brandPx * 0.2, y);
  };
  const nameFont = (px: number) => `700 ${px}px ${SANS}`;
  const oneLineMax = headMax - brandW - xW - gap * 2;
  ctx.font = nameFont(brandPx);
  if (ctx.measureText(input.name).width <= oneLineMax) {
    const nameW = ctx.measureText(input.name).width;
    const total = nameW + gap + xW + gap + brandW;
    let x0 = cx - total / 2;
    const y = at(Y.head);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(input.name, x0, y);
    x0 += nameW + gap;
    ctx.fillStyle = '#8D9094';
    ctx.font = `400 ${xPx}px ${SANS}`;
    ctx.fillText('x', x0, y);
    drawBrand(x0 + xW + gap, y);
  } else {
    const fitted = fitLines(ctx, input.name, nameFont, brandPx * 1.15, 30 * u, headMax, 2);
    ctx.font = nameFont(fitted.px);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    let y = at(Y.head) - fitted.px * 0.55 * fitted.rows.length;
    for (const row of fitted.rows) {
      ctx.fillText(row, cx, y);
      y += fitted.px * 1.05;
    }
    y += brandPx * 0.25;
    const total = xW + gap + brandW;
    const x0 = cx - total / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8D9094';
    ctx.font = `400 ${xPx}px ${SANS}`;
    ctx.fillText('x', x0, y);
    drawBrand(x0 + xW + gap, y);
  }

  // Titre
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  const title = fitLines(ctx, 'Réservation RDV', (px) => `700 ${px}px ${SANS}`, (square ? 100 : 118) * u, 60 * u, 700 * u, 1);
  ctx.font = `700 ${title.px}px ${SANS}`;
  ctx.fillText(title.rows[0]!, cx, at(Y.title));
  ctx.font = `400 ${(square ? 31 : 33) * u}px ${SANS}`;
  ctx.fillStyle = '#E6E7E9';
  ctx.fillText('Scannez le QR Code ou l’application', cx, at(Y.sub));

  // QR noir sur pavé blanc : un QR inversé (blanc sur noir) n'est pas lu par tous les téléphones.
  const qr = W * Y.qrSize;
  const qy = at(Y.qr);
  const pad = qr * 0.07;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, cx - qr / 2 - pad, qy - pad, qr + 2 * pad, qr + 2 * pad, pad * 0.5);
  ctx.fill();
  await drawQr(ctx, input.url, cx - qr / 2, qy, qr);

  // Lien
  ctx.fillStyle = '#FFFFFF';
  const link = fitLines(ctx, input.short, (px) => `700 ${px}px ${SANS}`, (square ? 36 : 38) * u, 22 * u, 820 * u, 1);
  ctx.font = `700 ${link.px}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(link.rows[0]!, cx, at(Y.link));

  // Réseaux
  if (socials.length) {
    const label = 'Suivez-nous sur les réseaux';
    ctx.font = `400 ${(square ? 27 : 29) * u}px ${SANS}`;
    ctx.fillStyle = '#E6E7E9';
    const ry = at(Y.rule);
    ctx.fillText(label, cx, ry);
    const lw = ctx.measureText(label).width;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2 * u;
    const lineY = ry - 10 * u;
    const span = 160 * u;
    ctx.beginPath();
    ctx.moveTo(cx - lw / 2 - 24 * u - span, lineY);
    ctx.lineTo(cx - lw / 2 - 24 * u, lineY);
    ctx.moveTo(cx + lw / 2 + 24 * u, lineY);
    ctx.lineTo(cx + lw / 2 + 24 * u + span, lineY);
    ctx.stroke();

    const n = socials.length;
    const colW = Math.min(205 * u, (860 * u) / n);
    const s = (square ? 66 : 68) * u;
    const x0 = cx - (colW * n) / 2;
    socials.forEach((so2, i) => {
      const ccx = x0 + colW * (i + 0.5);
      socialIcon(ctx, so2.id, ccx - s / 2, at(Y.icons), s);
      ctx.fillStyle = '#FFFFFF';
      const h = fitLines(ctx, so2.handle, (px) => `600 ${px}px ${SANS}`, (square ? 24 : 24) * u, 14 * u, colW - 10 * u, 1);
      ctx.font = `600 ${h.px}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(h.rows[0]!, ccx, at(Y.handles));
    });
  }
  return c;
}

export async function renderLabel(template: LabelTemplateId, format: LabelFormat, input: LabelInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  if (template === 'vitrine') return renderVitrine(format, input);
  const { w: W, h: H } = LABEL_SIZES[format];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const p = palette(template, input);
  const u = W / 1000; // unité : 1/1000 de la largeur
  const cx = W / 2;

  // Fond
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.bg);
  g.addColorStop(1, p.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  motif(ctx, p, W, H, u);

  const square = format === 'carre';
  const bandH = (square ? 120 : 150) * u;

  // Cadre fin intérieur (affiche) : l'étiquette a un bord, même découpée de travers.
  if (p.frame && !square) {
    ctx.strokeStyle = p.frame;
    ctx.lineWidth = 3 * u;
    roundRect(ctx, 34 * u, 34 * u, W - 68 * u, H - bandH - 68 * u, 22 * u);
    ctx.stroke();
  }

  // Bande du lien, en bas
  ctx.fillStyle = p.band;
  ctx.fillRect(0, H - bandH, W, bandH);

  let y = (square ? 92 : 108) * u;
  wordmark(ctx, cx, y, (square ? 46 : 50) * u, p.ink, square ? null : 'RÉSERVATION EN LIGNE', u);

  // Logo du salon (affiche seulement)
  if (!square) {
    y += 70 * u;
    const r = 64 * u;
    const logo = input.logoUrl ? await loadImage(input.logoUrl) : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, y + r, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = p.accent;
    ctx.stroke();
    ctx.clip();
    if (logo) {
      const s = Math.max((2 * r) / logo.width, (2 * r) / logo.height);
      ctx.drawImage(logo, cx - (logo.width * s) / 2, y + r - (logo.height * s) / 2, logo.width * s, logo.height * s);
    } else {
      ctx.fillStyle = p.accent;
      ctx.font = `700 ${r * 0.8}px ${p.serif ? SERIF : SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials(input.name), cx, y + r);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    if (p.motif === 'sparkles') {
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.55;
      sparkle(ctx, cx - r - 46 * u, y + 30 * u, 16 * u);
      sparkle(ctx, cx + r + 40 * u, y + r + 26 * u, 11 * u);
      sparkle(ctx, cx + r + 70 * u, y + 18 * u, 7 * u);
      ctx.globalAlpha = 1;
    }
    y += 2 * r + 18 * u;
  } else {
    y += 30 * u;
  }

  // NOM DU SALON — bien gras, sur une ou deux lignes
  const name = p.caps ? input.name.toUpperCase() : input.name;
  const nameFont = (px: number) => (p.serif ? `700 ${px}px ${SERIF}` : `800 ${px}px ${SANS}`);
  const fitted = fitLines(ctx, name, nameFont, (square ? 84 : 96) * u, 44 * u, (square ? 860 : 840) * u, 2);
  ctx.font = nameFont(fitted.px);
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  for (const row of fitted.rows) {
    y += fitted.px * 0.98;
    if (p.caps) spaced(ctx, row, cx, y, fitted.px * 0.06);
    else ctx.fillText(row, cx, y);
  }

  // Activité
  const cats = (input.categoryIds ?? []).slice(0, 2).map((id) => categoryLabel(id));
  if (cats.length) {
    y += (square ? 46 : 52) * u;
    ctx.font = `600 ${(square ? 28 : 31) * u}px ${SANS}`;
    ctx.fillStyle = p.accent;
    if (p.caps) spaced(ctx, cats.join('  ·  ').toUpperCase(), cx, y, 3 * u);
    else ctx.fillText(cats.join('  ·  '), cx, y);
  }

  // QR code dans sa carte blanche, coins soulignés de l'accent
  // Le QR prend la place qui RESTE entre le nom et l'appel à scanner : rien ne déborde, quelle que
  // soit la longueur du nom (une ou deux lignes, une activité ou aucune).
  const ctaH = (square ? 96 : 236) * u;
  y += (square ? 44 : 52) * u;
  const qrBox = Math.max(300 * u, Math.min((square ? 520 : 600) * u, H - bandH - ctaH - y - 24 * u));
  const pad = 30 * u;
  const bx = cx - qrBox / 2;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, bx, y, qrBox, qrBox, 30 * u);
  ctx.fill();
  if (p.bg === '#FFFFFF') {
    ctx.strokeStyle = '#E6E7E9';
    ctx.lineWidth = 3 * u;
    ctx.stroke();
  }
  // Coins d'accent : l'œil trouve le QR avant de lire
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 9 * u;
  ctx.lineCap = 'round';
  const k = 62 * u;
  const o = -16 * u;
  const corners: [number, number, number, number][] = [
    [bx + o, y + o, 1, 1],
    [bx + qrBox - o, y + o, -1, 1],
    [bx + o, y + qrBox - o, 1, -1],
    [bx + qrBox - o, y + qrBox - o, -1, -1],
  ];
  for (const [x0, y0, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + dy * k);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + dx * k, y0);
    ctx.stroke();
  }
  await drawQr(ctx, input.url, bx + pad, y + pad, qrBox - 2 * pad);
  y += qrBox;

  // Appel à l'action, en français puis en arabe
  y += (square ? 72 : 92) * u;
  ctx.fillStyle = p.ink;
  ctx.font = p.serif ? `600 italic ${(square ? 50 : 56) * u}px ${SERIF}` : `700 ${(square ? 46 : 52) * u}px ${SANS}`;
  ctx.fillText('Scannez pour réserver', cx, y);
  if (!square) {
    y += 62 * u;
    ctx.font = `700 ${40 * u}px ${ARABIC}`;
    ctx.direction = 'rtl';
    ctx.fillText('امسح الرمز للحجز', cx, y);
    ctx.direction = 'ltr';
    y += 50 * u;
    ctx.font = `500 ${26 * u}px ${SANS}`;
    ctx.fillStyle = p.muted;
    ctx.fillText('24 h/24  ·  sans appeler  ·  confirmation immédiate', cx, y);
  }

  // Lien en clair, dans la bande du bas
  ctx.fillStyle = p.bandInk;
  const linkPx = fitLines(ctx, input.short, (px) => `700 ${px}px ${SANS}`, (square ? 46 : 50) * u, 26 * u, 900 * u, 1);
  ctx.font = `700 ${linkPx.px}px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(linkPx.rows[0]!, cx, H - bandH / 2);
  ctx.textBaseline = 'alphabetic';
  return c;
}

// ---------------------------------------------------------------------------------------------
// PNG à 300 points par pouce
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Insère un bloc `pHYs` (300 ppp) après l'en-tête : le PNG s'imprime à sa taille réelle. */
function withDpi(png: Uint8Array, dpi = 300): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const v = new DataView(chunk.buffer);
  v.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // « pHYs »
  v.setUint32(8, ppm);
  v.setUint32(12, ppm);
  chunk[16] = 1; // unité : le mètre
  v.setUint32(17, crc32(chunk.subarray(4, 17)));
  const ihdrEnd = 8 + 4 + 4 + 13 + 4; // signature + IHDR complet
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

export async function labelPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('png');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([withDpi(bytes) as BlobPart], { type: 'image/png' });
}

/**
 * Enregistre le PNG. Sur le site : un téléchargement. Dans l'application, une WebView n'a pas de
 * dossier de téléchargements — le lien ne faisait rien : on écrit le fichier sur le téléphone
 * (`@capacitor/filesystem`) puis on ouvre la feuille de partage (Photos, Fichiers, imprimante,
 * WhatsApp…). Rend `'fallback'` quand l'installation n'a pas encore le greffon : l'écran montre
 * alors l'image en grand, à enregistrer d'un appui long.
 */
export async function downloadLabel(blob: Blob, filename: string): Promise<'done' | 'fallback'> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('Filesystem')) return 'fallback';
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await new Promise<string>((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] ?? '');
      r.onerror = () => ko(r.error);
      r.readAsDataURL(blob);
    });
    const saved = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, files: [saved.uri] });
    return 'done';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'done';
}
