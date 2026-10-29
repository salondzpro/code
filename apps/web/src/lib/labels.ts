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
  LABEL_TEXTS,
  normalizeLabelStyle,
  type LabelStyle,
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
  /** Langue, couleur, style et phrase de la « Vitrine noire ». */
  style?: LabelStyle;
}

/** Tailles en pixels, 300 points par pouce : A5 (148 × 210 mm) et carré de 12,7 cm. */
export const LABEL_SIZES: Record<LabelFormat, { w: number; h: number; mm: string }> = {
  affiche: { w: 1748, h: 2480, mm: '148 × 210 mm (A5)' },
  carre: { w: 1500, h: 1500, mm: '127 × 127 mm' },
};

const SERIF = "'Playfair Label', 'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const ARABIC = "'Segoe UI', 'Noto Naskh Arabic', 'Noto Sans Arabic', 'Geeza Pro', Tahoma, sans-serif";

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

async function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const at = (r: number, c: number) => !!qr.modules.get(r, c);
  const cell = size / n;
  const INK = '#111214';
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, size, size);

  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  // Zone du logo : carré impair au centre, ~21 % du côté.
  const logo = qr.version <= 6;
  let k = Math.round(n * 0.21);
  if (k % 2 === 0) k += 1;
  const l0 = (n - k) / 2;
  const inLogo = (r: number, c: number) => logo && r >= l0 - 0.5 && r < l0 + k - 0.5 && c >= l0 - 0.5 && c < l0 + k - 0.5;

  ctx.fillStyle = INK;
  const inset = cell * 0.04;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!at(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
      roundRect(ctx, x + c * cell + inset, y + r * cell + inset, cell - 2 * inset, cell - 2 * inset, cell * 0.32);
      ctx.fill();
    }

  // Repères : anneau de 7 modules et cœur de 3, en carrés arrondis.
  const eye = (r: number, c: number) => {
    const ex = x + c * cell;
    const ey = y + r * cell;
    ctx.fillStyle = INK;
    roundRect(ctx, ex, ey, 7 * cell, 7 * cell, cell * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, ex + cell, ey + cell, 5 * cell, 5 * cell, cell * 1.3);
    ctx.fill();
    ctx.fillStyle = INK;
    roundRect(ctx, ex + 2 * cell, ey + 2 * cell, 3 * cell, 3 * cell, cell * 0.9);
    ctx.fill();
  };
  eye(0, 0);
  eye(0, n - 7);
  eye(n - 7, 0);

  if (logo) {
    // Marque au centre : pastille noire et « S » blanc, comme l'icône de l'application.
    const lx = x + (l0 - 0.5) * cell;
    const ly = y + (l0 - 0.5) * cell;
    const ls = k * cell;
    const m = cell * 0.55;
    ctx.fillStyle = INK;
    roundRect(ctx, lx + m, ly + m, ls - 2 * m, ls - 2 * m, (ls - 2 * m) * 0.24);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${(ls - 2 * m) * 0.62}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', lx + ls / 2, ly + ls / 2 + (ls - 2 * m) * 0.03);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

let fontsReady: Promise<void> | null = null;
/** Polices chargées AVANT de dessiner : un canvas ne les attend pas et dessinerait en police de secours. */
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        const f = new FontFace('Playfair Label', "url(/fonts/playfair-700.woff2) format('woff2')", { weight: '700' });
        const fi = new FontFace('Playfair Label', "url(/fonts/playfair-600i.woff2) format('woff2')", { weight: '600', style: 'italic' });
        // Arabe : Cairo (police variable, 400 à 700), sinon le canvas prend la police arabe du système.
        const ar = new FontFace('Cairo Label', "url(/fonts/cairo-arabic.woff2) format('woff2')", { weight: '200 1000' });
        await Promise.all([f.load(), fi.load(), ar.load()]).then((faces) => faces.forEach((x) => document.fonts.add(x)));
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

const CAIRO = "'Cairo Label', " + ARABIC;
const hasArabic = (t: string) => /[؀-ۿ]/.test(t);

/** Clarté perçue d'une couleur `#RRGGBB`, de 0 (noir) à 1 (blanc). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Mélange deux couleurs `#RRGGBB` (t = part de `b`). */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
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
  const st = normalizeLabelStyle(input.style);
  const txt = LABEL_TEXTS[st.locale];

  // Fond : la couleur choisie, légèrement éclairée au centre. Le texte suit sa clarté.
  const light = luminance(st.color) > 0.45;
  const ink = light ? '#111214' : '#FFFFFF';
  const ink2 = light ? 'rgba(17,18,20,0.82)' : 'rgba(255,255,255,0.88)';
  const muted = light ? 'rgba(17,18,20,0.45)' : 'rgba(255,255,255,0.55)';
  const ruleC = light ? 'rgba(17,18,20,0.55)' : 'rgba(255,255,255,0.7)';
  ctx.fillStyle = st.color;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(cx, H * 0.42, 0, cx, H * 0.42, Math.max(W, H) * 0.75);
  glow.addColorStop(0, mix(st.color, '#FFFFFF', light ? 0.35 : 0.07));
  glow.addColorStop(1, st.color);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Familles selon le style ; tout texte arabe passe en Cairo, de droite à gauche.
  const latin = st.font === 'elegant' ? SERIF : SANS;
  const caps = st.font === 'capitales';
  const fontOf = (text: string, weight: number, px: number, family = latin, italic = false) =>
    hasArabic(text) ? `${weight} ${px}px ${CAIRO}` : `${italic ? 'italic ' : ''}${weight} ${px}px ${family}`;
  /** Texte centré, retourné en arabe, espacé en capitales. */
  const center = (text: string, y: number, spacing = 0) => {
    ctx.textAlign = 'center';
    if (hasArabic(text)) {
      ctx.direction = 'rtl';
      ctx.fillText(text, cx, y);
      ctx.direction = 'ltr';
    } else if (spacing) spaced(ctx, text, cx, y, spacing);
    else ctx.fillText(text, cx, y);
  };

  const socials = (input.socials ?? []).filter((x) => x.shown && x.handle.trim());
  const at = (f: number) => H * f;
  // Repères verticaux (fraction de la hauteur) ; sans réseaux, le bloc central descend un peu.
  const shift = socials.length ? 0 : 0.05;
  const Y = square
    ? { head: 0.14, title: 0.27 + shift, sub: 0.32 + shift, qr: 0.36 + shift, qrSize: 0.23, link: 0.66 + shift, rule: 0.745, icons: 0.772, handles: 0.884 }
    : { head: 0.165, title: 0.345 + shift, sub: 0.388 + shift, qr: 0.428 + shift, qrSize: 0.25, link: 0.664 + shift, rule: 0.745, icons: 0.772, handles: 0.848 };

  // En-tête : « Nom du salon x Salon DZ » sur une ligne, sinon le nom au-dessus.
  ctx.textBaseline = 'alphabetic';
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
    ctx.fillStyle = ink;
    ctx.font = `700 ${brandPx}px ${SANS}`;
    ctx.fillText('Salon', x0, y);
    ctx.fillStyle = muted;
    ctx.font = `600 ${brandPx}px ${SANS}`;
    ctx.fillText('DZ', x0 + wSalon + brandPx * 0.2, y);
  };
  const drawX = (x0: number, y: number) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.font = `400 ${xPx}px ${SANS}`;
    ctx.fillText('x', x0, y);
  };
  const name = caps && !hasArabic(input.name) ? input.name.toUpperCase() : input.name;
  const nameFont = (px: number) => fontOf(name, 700, px);
  const oneLineMax = headMax - brandW - xW - gap * 2;
  ctx.font = nameFont(brandPx);
  if (ctx.measureText(name).width <= oneLineMax) {
    const nameW = ctx.measureText(name).width;
    const total = nameW + gap + xW + gap + brandW;
    let x0 = cx - total / 2;
    const y = at(Y.head);
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    ctx.fillText(name, x0, y);
    x0 += nameW + gap;
    drawX(x0, y);
    drawBrand(x0 + xW + gap, y);
  } else {
    const fitted = fitLines(ctx, name, nameFont, brandPx * 1.15, 30 * u, headMax, 2);
    ctx.font = nameFont(fitted.px);
    ctx.fillStyle = ink;
    let y = at(Y.head) - fitted.px * 0.55 * fitted.rows.length;
    for (const row of fitted.rows) {
      center(row, y);
      y += fitted.px * 1.05;
    }
    y += brandPx * 0.25;
    const x0 = cx - (xW + gap + brandW) / 2;
    drawX(x0, y);
    drawBrand(x0 + xW + gap, y);
  }

  // Titre
  ctx.fillStyle = ink;
  const titleText = caps && !hasArabic(txt.title) ? txt.title.toUpperCase() : txt.title;
  const tSpacing = (px: number) => (caps && !hasArabic(titleText) ? px * 0.04 : 0);
  const title = fitLines(ctx, titleText, (px) => fontOf(titleText, 700, px), (square ? 100 : 118) * u, 56 * u, caps ? 660 * u : 700 * u, 1);
  ctx.font = fontOf(titleText, 700, title.px);
  center(title.rows[0]!, at(Y.title), tSpacing(title.px));

  // Modèles roses : quelques éclats autour du titre — un ton enjoué, sans charger l'affiche.
  if (st.decor) {
    ctx.save();
    ctx.font = fontOf(titleText, 700, title.px);
    const tw = ctx.measureText(title.rows[0]!).width + (tSpacing(title.px) * title.rows[0]!.length);
    const ty = at(Y.title) - title.px * 0.36;
    ctx.fillStyle = light ? 'rgba(122, 46, 70, 0.72)' : 'rgba(255, 255, 255, 0.78)';
    const L = cx - tw / 2;
    const R = cx + tw / 2;
    sparkle(ctx, L - 46 * u, ty - 22 * u, 22 * u);
    sparkle(ctx, L - 18 * u, ty + 34 * u, 10 * u);
    sparkle(ctx, R + 44 * u, ty - 30 * u, 15 * u);
    sparkle(ctx, R + 26 * u, ty + 28 * u, 24 * u);
    // Deux éclats discrets près de l'en-tête
    ctx.globalAlpha = 0.6;
    sparkle(ctx, cx - 380 * u, at(Y.head) - 70 * u, 9 * u);
    sparkle(ctx, cx + 400 * u, at(Y.head) + 40 * u, 12 * u);
    ctx.restore();
  }

  // Phrase sous le titre : celle du professionnel, sinon celle de la langue (deux lignes au plus).
  const tagline = st.tagline || txt.tagline;
  const tagText = caps && !hasArabic(tagline) ? tagline.toUpperCase() : tagline;
  const tagWeight = caps ? 600 : st.font === 'elegant' ? 600 : 400;
  const tagFont = (px: number) => fontOf(tagText, tagWeight, px, latin, st.font === 'elegant');
  const tag = fitLines(ctx, tagText, tagFont, (square ? 31 : 33) * u * (caps ? 0.82 : 1), 22 * u, 800 * u, 2);
  ctx.font = tagFont(tag.px);
  ctx.fillStyle = ink2;
  let extra = 0;
  tag.rows.forEach((row, i) => {
    center(row, at(Y.sub) + i * tag.px * 1.25, caps && !hasArabic(row) ? tag.px * 0.08 : 0);
    if (i) extra += tag.px * 1.25;
  });

  // QR noir sur pavé blanc : un QR inversé (blanc sur noir) n'est pas lu par tous les téléphones.
  const qr = W * Y.qrSize;
  const qy = at(Y.qr) + extra;
  const pad = qr * 0.07;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, cx - qr / 2 - pad, qy - pad, qr + 2 * pad, qr + 2 * pad, pad * 0.5);
  ctx.fill();
  if (light) {
    ctx.strokeStyle = 'rgba(17,18,20,0.14)';
    ctx.lineWidth = 3 * u;
    ctx.stroke();
  }
  await drawQr(ctx, input.url, cx - qr / 2, qy, qr);

  // Lien
  ctx.fillStyle = ink;
  const link = fitLines(ctx, input.short, (px) => `700 ${px}px ${SANS}`, (square ? 36 : 38) * u, 22 * u, 820 * u, 1);
  ctx.font = `700 ${link.px}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(link.rows[0]!, cx, at(Y.link) + extra);

  // Réseaux
  if (socials.length) {
    const label = caps && !hasArabic(txt.follow) ? txt.follow.toUpperCase() : txt.follow;
    const lpx = (square ? 27 : 29) * u * (caps ? 0.85 : 1);
    ctx.font = fontOf(label, caps ? 600 : 400, lpx, latin, st.font === 'elegant');
    ctx.fillStyle = ink2;
    const ry = at(Y.rule);
    const ls = caps && !hasArabic(label) ? lpx * 0.1 : 0;
    center(label, ry, ls);
    const lw = ctx.measureText(label).width + ls * label.length;
    ctx.strokeStyle = ruleC;
    ctx.lineWidth = 2 * u;
    const lineY = ry - 10 * u;
    const span = Math.min(160 * u, (900 * u - lw) / 2 - 24 * u);
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
      ctx.fillStyle = ink;
      const h = fitLines(ctx, so2.handle, (px) => fontOf(so2.handle, 600, px, SANS), 24 * u, 14 * u, colW - 10 * u, 1);
      ctx.font = fontOf(so2.handle, 600, h.px, SANS);
      ctx.textAlign = 'center';
      ctx.fillText(h.rows[0]!, ccx, at(Y.handles));
    });
  }
  return c;
}

/** Tous les modèles sont des déclinaisons de la « Vitrine » : le modèle choisit couleur et style (`preset`). */
export async function renderLabel(_template: LabelTemplateId, format: LabelFormat, input: LabelInput): Promise<HTMLCanvasElement> {
  await ensureFonts();
  return renderVitrine(format, input);
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
