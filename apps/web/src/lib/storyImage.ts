/**
 * Image de story 1080 × 1920 dessinée dans le navigateur : la photo du salon, puis un panneau blanc avec
 * le jour, les heures et le lien. Le bas reste libre : Instagram y pose ses boutons.
 */
import { isNativeApp, shareFileNative } from './nativeFile';

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const INK = '#1e1b30';
const MUTED = '#636174';
const ACCENT = '#6c5ce7';
const SOFT = '#f0effe';
const PANEL_TOP = 800;
const MARGIN = 80;

export async function drawStory(o: {
  photo: string | null;
  dayLabel: string;
  /** « Vendredi 6 novembre », au-dessus du jour. */
  dateLabel?: string;
  subtitle: string;
  times: string[];
  salon: string;
  link: string;
}): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  try {
    await Promise.all([document.fonts.load('600 96px Outfit'), document.fonts.load('500 40px Inter')]);
  } catch {
    /* polices indisponibles : repli système */
  }
  // La photo du salon en haut, le nom posé dessus.
  g.fillStyle = ACCENT;
  g.fillRect(0, 0, W, H);
  const img = o.photo ? await loadImage(o.photo) : null;
  if (img) {
    const box = PANEL_TOP + 80;
    const r = Math.max(W / img.width, box / img.height);
    const w = img.width * r, h = img.height * r;
    g.drawImage(img, (W - w) / 2, (box - h) / 2, w, h);
    const veil = g.createLinearGradient(0, box - 420, 0, box);
    veil.addColorStop(0, 'rgba(30,27,48,0)');
    veil.addColorStop(1, 'rgba(30,27,48,.72)');
    g.fillStyle = veil;
    g.fillRect(0, box - 420, W, 420);
  }
  g.fillStyle = '#ffffff';
  g.textBaseline = 'alphabetic';
  g.font = '600 60px Outfit, Inter, sans-serif';
  g.fillText(o.salon, MARGIN, PANEL_TOP - 44, W - MARGIN * 2);

  // Le panneau blanc : le jour, puis les heures.
  g.beginPath();
  g.roundRect(0, PANEL_TOP, W, H - PANEL_TOP + 80, [72, 72, 0, 0]);
  g.fill();
  let y = PANEL_TOP + 104;
  if (o.dateLabel && o.dateLabel !== o.dayLabel) {
    g.fillStyle = MUTED;
    g.font = '500 40px Inter, sans-serif';
    g.fillText(o.dateLabel, MARGIN, y);
    y += 96;
  } else y += 40;
  g.fillStyle = INK;
  g.font = '600 104px Outfit, Inter, sans-serif';
  g.fillText(o.dayLabel, MARGIN, y, W - MARGIN * 2);
  y += 72;
  g.fillStyle = ACCENT;
  g.font = '600 48px Outfit, Inter, sans-serif';
  g.fillText(o.subtitle, MARGIN, y);
  y += 56;

  const cols = o.times.length > 1 ? 2 : 1;
  const gap = 20, pillH = 104;
  const pillW = (W - MARGIN * 2 - gap * (cols - 1)) / cols;
  g.textAlign = 'center';
  g.font = '600 50px Outfit, Inter, sans-serif';
  o.times.forEach((x, i) => {
    const px = MARGIN + (i % cols) * (pillW + gap);
    const py = y + Math.floor(i / cols) * (pillH + gap);
    g.fillStyle = SOFT;
    g.beginPath();
    g.roundRect(px, py, pillW, pillH, 28);
    g.fill();
    g.fillStyle = INK;
    g.fillText(x, px + pillW / 2, py + pillH / 2 + 18);
  });

  // Le lien : au-dessus de la zone qu'Instagram recouvre, là où se pose le sticker « Lien ».
  const barY = H - 340, barH = 136;
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(MARGIN, barY, W - MARGIN * 2, barH, 36);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '600 44px Outfit, Inter, sans-serif';
  g.fillText(o.link, W / 2, barY + barH / 2 + 16, W - MARGIN * 2 - 64);
  g.textAlign = 'left';
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Partage l'image par la feuille du téléphone ; sinon la télécharge. Rend `true` si la feuille s'est
 * ouverte. Pour une story, pas de `text` : un texte joint à l'image empêche Instagram de proposer les
 * stories sur certains téléphones, et le lien est déjà dessiné sur l'image.
 */
export async function shareImage(blob: Blob, name: string, text?: string): Promise<boolean> {
  if (await isNativeApp()) {
    try {
      return await shareFileNative(blob, name);
    } catch {
      // La personne a refermé la feuille : rien à signaler.
      return true;
    }
  }
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share(text ? { files: [file], text } : { files: [file] });
      return true;
    }
  } catch {
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return false;
}
