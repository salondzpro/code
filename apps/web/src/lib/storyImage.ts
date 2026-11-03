/**
 * Story des créneaux libres (« Mes disponibilités » de l'accueil pro, en image) : 1080 × 1920
 * dessinée dans le navigateur — photo du salon assombrie au NOIR de la marque (3 nov. 2026 : plus de
 * violet), « Demain · créneaux libres », jusqu'à 4 heures en pastilles blanches, le lien de
 * réservation et le nom du salon. Partagée par la feuille du téléphone (Instagram, WhatsApp…), sinon
 * téléchargée.
 */
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

export async function drawStory(o: {
  photo: string | null;
  dayLabel: string;
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
    await Promise.all([document.fonts.load('600 150px Outfit'), document.fonts.load('500 80px Outfit')]);
  } catch {
    /* polices indisponibles : repli système */
  }
  g.fillStyle = '#111214';
  g.fillRect(0, 0, W, H);
  const img = o.photo ? await loadImage(o.photo) : null;
  if (img) {
    const r = Math.max(W / img.width, H / img.height);
    const w = img.width * r, h = img.height * r;
    g.globalAlpha = 0.55;
    g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    g.globalAlpha = 1;
  }
  // Voile noir : le texte reste lisible quelle que soit la photo (fonction, pas décor).
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(17,18,20,.55)');
  grad.addColorStop(0.45, 'rgba(17,18,20,.35)');
  grad.addColorStop(1, 'rgba(17,18,20,.92)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.fillStyle = '#ffffff';
  g.textBaseline = 'alphabetic';
  g.font = '600 150px Outfit, Inter, sans-serif';
  g.fillText(o.dayLabel, 90, 300);
  g.font = '500 92px Outfit, Inter, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.82)';
  g.fillText(o.subtitle, 90, 415);

  const pillW = W - 180, pillH = 132, gap = 34;
  const startY = H - 420 - o.times.length * (pillH + gap);
  o.times.forEach((t, i) => {
    const y = startY + i * (pillH + gap);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(90, y, pillW, pillH, pillH / 2);
    g.fill();
    g.fillStyle = '#111214';
    g.font = '600 64px Outfit, Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText(t, W / 2, y + pillH / 2 + 22);
    g.textAlign = 'left';
  });

  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = '600 50px Outfit, Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText(o.link, W / 2, H - 230);
  g.font = '600 42px Inter, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.fillText(o.salon, W / 2, H - 150);
  g.textAlign = 'left';
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

/** Partage l'image par la feuille du téléphone ; sinon la télécharge. Rend `true` si partagée. */
export async function shareImage(blob: Blob, name: string, text: string): Promise<boolean> {
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return true;
    }
  } catch {
    return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return false;
}
