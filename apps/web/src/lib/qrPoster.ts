/**
 * Affiche QR « Réservez en ligne » (PRO-F 21) : une image prête à imprimer ou à partager, aux couleurs de Salon DZ —
 * wordmark de la plateforme, logo et nom du salon, QR code en grand, appel à l'action, lien court. Rendu sur canvas
 * (1080 × 1440, PNG) côté navigateur : rien à envoyer au serveur.
 */
import QRCode from 'qrcode';

export interface QrPosterInput {
  name: string;
  url: string;
  short: string;
  logoUrl?: string | null;
}

const W = 1080;
const H = 1440;
const INK = '#111214';
const MUTED = '#6B7075';
const SUBTLE = '#9A9EA3';
const LINE = '#E6E7E9';
const FILL = '#F4F5F6';
const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Charge une image avec CORS ; null si le serveur ne l'autorise pas (on dessine alors les initiales). */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Coupe une ligne trop longue avec « … » pour tenir dans `max` px. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

export async function renderQrPoster(input: QrPosterInput): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');

  // Fond + carte
  ctx.fillStyle = FILL;
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 60, 60, W - 120, H - 120, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Wordmark Salon DZ + « RÉSERVATION EN LIGNE »
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `600 64px ${FONT}`;
  const salonW = ctx.measureText('Salon').width;
  ctx.font = `300 64px ${FONT}`;
  const dzW = ctx.measureText('DZ').width;
  const gap = 12;
  const startX = W / 2 - (salonW + gap + dzW) / 2;
  ctx.textAlign = 'left';
  ctx.font = `600 64px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('Salon', startX, 190);
  ctx.font = `300 64px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('DZ', startX + salonW + gap, 190);
  ctx.textAlign = 'center';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillStyle = SUBTLE;
  ctx.letterSpacing = '8px';
  ctx.fillText('RÉSERVATION EN LIGNE', W / 2, 232);
  ctx.letterSpacing = '0px';

  // Logo du salon (rond) ou initiales
  const cx = W / 2;
  const cy = 360;
  const r = 84;
  const logo = input.logoUrl ? await loadImage(input.logoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (logo) {
    const s = Math.max((2 * r) / logo.width, (2 * r) / logo.height);
    const dw = logo.width * s;
    const dh = logo.height * s;
    ctx.drawImage(logo, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = FILL;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = MUTED;
    ctx.font = `600 64px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(input.name), cx, cy + 4);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Nom du salon
  ctx.fillStyle = INK;
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText(fit(ctx, input.name, W - 240), W / 2, 520);

  // Appel à l'action
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('Prenez rendez-vous en ligne, 24 h/24', W / 2, 574);

  // QR code (cadre blanc, coins arrondis)
  const qrSize = 520;
  const qx = W / 2 - qrSize / 2;
  const qy = 610;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, input.url, {
    width: qrSize,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: INK, light: '#ffffff' },
  });
  roundRect(ctx, qx - 28, qy - 28, qrSize + 56, qrSize + 56, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);

  // Bandeau « Scannez pour réserver »
  const by = qy + qrSize + 56;
  roundRect(ctx, W / 2 - 250, by, 500, 76, 38);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 30px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Scannez pour réserver', W / 2, by + 39);
  ctx.textBaseline = 'alphabetic';

  // Lien court + pied de page
  ctx.fillStyle = MUTED;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(fit(ctx, input.short, W - 240), W / 2, by + 128);
  ctx.fillStyle = SUBTLE;
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText(
    'Confirmation immédiate · Rappel avant le rendez-vous · Fait en Algérie',
    W / 2,
    H - 88,
  );

  return canvas.toDataURL('image/png');
}
