// Visuels des comptes de démonstration : une image par prestation, couvertures, logos et avatars,
// tous dans la MÊME identité (fond de studio chaud, lumière douce, sujet en trait d'encre, marque
// Salon DZ), le sujet seul changeant selon la prestation (cheveux, mains, cils, peau…).
//   pnpm demo:visuals            → génère et dépose dans Supabase Storage (salons/demo/*, avatars/demo/*)
//   pnpm demo:visuals --local    → génère seulement, dans node_modules/.shots/demo-visuals (PNG + WebP)
// Rendu par Chrome (playwright-core) : SVG → canvas → WebP. Icônes : lucide (mêmes que l'application).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOCAL = process.argv.includes('--local');
const OUT = path.join(ROOT, 'node_modules/.shots/demo-visuals');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Identité visuelle (jetons de l'application : encre #111214, fonds chauds, arrondis réduits)
// ---------------------------------------------------------------------------------------------
const INK = '#111214';
const TONES = {
  hair: '#E8DACB', // coiffure, lissage
  barb: '#D7DCE2', // barbe, traçage
  skin: '#D9E5DA', // soins de peau
  nail: '#F0D6D9', // onglerie
  lash: '#E2D9E9', // cils, sourcils
  brand: '#DDE3DF',
};

/** Icône lucide → fragment SVG (viewBox 24). */
const iconCache = new Map();
function icon(name) {
  if (iconCache.has(name)) return iconCache.get(name);
  const file = path.join(ROOT, 'node_modules/lucide-react/dist/esm/icons', `${name}.js`);
  const src = fs.readFileSync(file, 'utf8');
  const m = /const __iconNode = (\[[\s\S]*?\]);/.exec(src);
  if (!m) throw new Error(`icône introuvable : ${name}`);
  const nodes = new Function(`return ${m[1]}`)();
  const svg = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')} />`)
    .join('');
  iconCache.set(name, svg);
  return svg;
}

/** Sujets dessinés à la main, dans le même trait que les icônes (viewBox 24). */
const CUSTOM = {
  // Mèches lisses : quatre brins parallèles, légèrement courbés.
  strands: `<path d="M6 3c-1 6 0 12 1 18"/><path d="M10 3c-.5 6 .5 12 1 18"/><path d="M14 3c.5 6-.5 12-1 18"/><path d="M18 3c1 6 0 12-1 18"/>`,
  // Mèches ondulées (avant défrisage).
  waves: `<path d="M6 3c-2 3 2 6 0 9s2 6 0 9"/><path d="M10 3c-2 3 2 6 0 9s2 6 0 9"/><path d="M14 3c-2 3 2 6 0 9s2 6 0 9"/><path d="M18 3c-2 3 2 6 0 9s2 6 0 9"/>`,
  // Longs cheveux (femme) : deux masses qui encadrent.
  longHair: `<path d="M12 2c-5 0-8 4-8 9 0 4 1 7 1 11h3c0-3-1-6 0-9 1 2 3 3 4 3s3-1 4-3c1 3 0 6 0 9h3c0-4 1-7 1-11 0-5-3-9-8-9z"/>`,
  // Œil et cils : paupière, iris, cinq cils relevés.
  lashes: `<path d="M2 14c3-5 7-7 10-7s7 2 10 7"/><path d="M2 14c3 3 7 5 10 5s7-2 10-5"/><circle cx="12" cy="13" r="3"/><path d="M5 9 3.5 6.5"/><path d="M8.5 7.5 7.5 5"/><path d="M12 7V4"/><path d="M15.5 7.5l1-2.5"/><path d="M19 9l1.5-2.5"/>`,
  // Sourcil : arc plein et fil tendu dessous.
  brow: `<path d="M3 10c3-4 8-5 12-4 2 .5 4 1.5 6 3"/><path d="M4 12c3-2 7-3 11-2.5 2 .3 4 1 5.5 2"/><path d="M2 19h20"/><path d="M12 19l-2-3"/>`,
  // Tresse : trois brins entrelacés.
  braid: `<path d="M9 2c3 3-3 6 0 9s-3 6 0 9"/><path d="M15 2c-3 3 3 6 0 9s3 6 0 9"/><path d="M12 2v2"/><path d="M12 20v2"/>`,
  // Coupe : mèche coupée nette.
  cut: `<path d="M4 4c3 2 5 6 5 10v6"/><path d="M20 4c-3 2-5 6-5 10v6"/><path d="M9 14h6"/>`,
  // Peigne.
  comb: `<rect x="3" y="7" width="18" height="6" rx="2"/><path d="M6 13v4"/><path d="M9 13v4"/><path d="M12 13v4"/><path d="M15 13v4"/><path d="M18 13v4"/>`,
  // Rasoir de barbier.
  razor: `<path d="M9 15 19 5a2.1 2.1 0 0 1 3 3L12 18z"/><path d="M11.5 12.5l3 3"/><path d="M9 15l-4.5 4.5"/><path d="M12 18l-2 3"/>`,
  // Sèche-cheveux.
  dryer: `<path d="M3 8a5 5 0 0 1 5-5h9l2 2v6l-2 2H8a5 5 0 0 1-5-5z"/><path d="M8 13l2 8h4l-1-8"/><path d="M19 5v6"/>`,
  // Pot de soin / crème.
  jar: `<rect x="5" y="9" width="14" height="12" rx="2"/><path d="M4 9h16"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>`,
  // Flacon de vernis.
  polish: `<path d="M9 2h6v5H9z"/><path d="M9 7l-2 3v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10l-2-3"/><path d="M12 13v5"/>`,
  // Pied (pédicure).
  foot: `<path d="M7 21c-3 0-4-3-3-6 1-2 3-3 3-6V6a3 3 0 0 1 6 0v3c0 2 2 3 4 4s3 4 1 6c-2 3-8 2-11 2z"/><path d="M5 10h.01"/><path d="M8 7h.01"/>`,
};

/** Sujet d'un visuel : icône lucide (`i:`) ou dessin maison (`c:`), plus une pastille secondaire optionnelle. */
const S = (main, tone, badge) => ({ main, tone, badge });
const VISUALS = {
  // --- salon de Karim (hommes)
  'h-coupe-barbe': S('i:scissors', 'barb', 'c:razor'),
  'h-coupe': S('i:scissors', 'hair'),
  'h-coupe-mariage': S('i:scissors', 'hair', 'i:crown'),
  'h-nettoyage-peau': S('i:sparkles', 'skin', 'i:droplets'),
  'h-lissage-keratine': S('c:strands', 'hair', 'i:sparkles'),
  'h-lissage-proteine': S('c:strands', 'hair', 'i:droplet'),
  'h-defrisage': S('c:waves', 'hair', 'c:strands'),
  'h-coupe-barbe-brushing': S('i:scissors', 'barb', 'c:dryer'),
  'h-brushing': S('c:dryer', 'hair'),
  'h-barbe': S('c:razor', 'barb'),
  'h-tracage': S('i:pen-line', 'barb'),
  'h-coupe-barbe-shampoing': S('i:scissors', 'barb', 'i:droplets'),
  'h-coupe-lissage': S('i:scissors', 'hair', 'c:strands'),
  // --- salon de Yasmine (femmes)
  'f-coupe': S('c:longHair', 'hair', 'i:scissors'),
  'f-brushing': S('c:dryer', 'hair'),
  'f-coloration': S('c:longHair', 'hair', 'i:palette'),
  'f-balayage': S('c:longHair', 'hair', 'i:paintbrush'),
  'f-lissage-bresilien': S('c:strands', 'hair', 'i:sparkles'),
  'f-soin-proteine': S('c:strands', 'hair', 'i:droplet'),
  'f-chignon-mariee': S('c:longHair', 'hair', 'i:crown'),
  'f-tresses': S('c:braid', 'hair'),
  'f-manucure': S('i:hand', 'nail'),
  'f-pose-gel': S('i:hand', 'nail', 'i:gem'),
  'f-semi-permanent': S('i:hand', 'nail', 'c:polish'),
  'f-nail-art': S('i:hand', 'nail', 'i:palette'),
  'f-pedicure': S('c:foot', 'nail'),
  'f-extension-cils': S('c:lashes', 'lash', 'i:sparkles'),
  'f-rehaussement-cils': S('c:lashes', 'lash', 'i:arrow-up'),
  'f-teinture-cils': S('c:lashes', 'lash', 'i:droplet'),
  'f-sourcils': S('c:brow', 'lash'),
  'f-sourcils-fil': S('c:brow', 'lash', 'i:feather'),
  'f-nettoyage-peau': S('i:sparkles', 'skin', 'i:droplets'),
  'f-soin-hydratant': S('c:jar', 'skin', 'i:droplet'),
  'f-epilation-visage': S('i:feather', 'skin'),
};

const draw = (ref) => (ref.startsWith('i:') ? icon(ref.slice(2)) : CUSTOM[ref.slice(2)]);

/** Fond de studio commun : dégradé chaud, lumière haute, sol et ombre portée. */
function studio(w, h, tone) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5F2ED"/><stop offset="1" stop-color="#E3DED6"/></linearGradient>
      <radialGradient id="light" cx="0.5" cy="0.12" r="0.7"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${INK}" stop-opacity="0.22"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></radialGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity="0.06"/></linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect width="${w}" height="${h}" fill="url(#light)"/>
    <rect y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="url(#floor)"/>
    <ellipse cx="${w / 2}" cy="${h * 0.74}" rx="${w * 0.26}" ry="${h * 0.055}" fill="url(#shadow)"/>
    <circle cx="${w / 2}" cy="${h * 0.47}" r="${Math.min(w, h) * 0.36}" fill="${TONES[tone]}" opacity="0.9"/>`;
}

/** Visuel d'une prestation (1200 × 900). */
function serviceSvg(spec) {
  const w = 1200, h = 900;
  const size = 470, x = w / 2 - size / 2, y = h * 0.47 - size / 2;
  const badge = spec.badge
    ? `<g transform="translate(${w / 2 + 215} ${h * 0.47 + 160})">
         <circle r="120" fill="#FFFFFF" stroke="${INK}" stroke-opacity="0.08"/>
         <g transform="translate(-66 -66) scale(5.5)" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${draw(spec.badge)}</g>
       </g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${studio(w, h, spec.tone)}
    <g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${INK}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${draw(spec.main)}</g>
    ${badge}
  </svg>`;
}

/** Couverture de salon (1600 × 900) : trois sujets alignés. */
function coverSvg(subjects, tone) {
  const w = 1600, h = 900;
  const size = 250;
  const items = subjects
    .map((ref, i) => {
      const cx = w / 2 + (i - 1) * 420;
      return `<circle cx="${cx}" cy="${h * 0.47}" r="200" fill="#FFFFFF" fill-opacity="${i === 1 ? 0.55 : 0.35}"/>
        <g transform="translate(${cx - size / 2} ${h * 0.47 - size / 2}) scale(${size / 24})" fill="none" stroke="${INK}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${draw(ref)}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${studio(w, h, tone).replace(/<circle cx="800"[^>]*\/>/, '')}${items}</svg>`;
}

/** Logo (600 × 600) : monogramme sur pastille de ton. */
function logoSvg(initials, tone) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="${TONES[tone]}"/>
    <circle cx="300" cy="300" r="210" fill="#FFFFFF" fill-opacity="0.6"/>
    <text x="300" y="300" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="220" letter-spacing="-8" fill="${INK}">${initials}</text>
  </svg>`;
}

/** Avatar (600 × 600) : buste en trait d'encre, chevelure suggérée par le même trait (jamais un aplat). */
function avatarSvg(kind, tone) {
  const arc = `<path d="M8.05 9.36A4.2 4.2 0 0 1 15.95 9.36"/>`;
  const hair = {
    short: arc,
    tied: `${arc}<circle cx="12" cy="5.5" r="1.1"/>`,
    beard: `${arc}<path d="M8.9 12.9A3.9 3.9 0 0 0 15.1 12.9"/>`,
    long: `${arc}<path d="M8.05 9.36c-.3 2.6-.7 4.7-1.4 6.9"/><path d="M15.95 9.36c.3 2.6.7 4.7 1.4 6.9"/>`,
  }[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="${TONES[tone]}"/>
    <circle cx="300" cy="300" r="230" fill="#FFFFFF" fill-opacity="0.55"/>
    <g transform="translate(90 80) scale(17.5)" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="10.8" r="3.3"/>
      ${hair}
      <path d="M5 21c0-3.5 3-6 7-6s7 2.5 7 6"/>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------------------------
const JOBS = [
  ...Object.entries(VISUALS).map(([key, spec]) => ({ bucket: 'salons', key, svg: serviceSvg(spec), w: 1200, h: 900, label: true })),
  { bucket: 'salons', key: 'cover-hommes', svg: coverSvg(['i:scissors', 'c:razor', 'c:comb'], 'barb'), w: 1600, h: 900, label: true },
  { bucket: 'salons', key: 'cover-femmes', svg: coverSvg(['i:hand', 'c:longHair', 'c:lashes'], 'nail'), w: 1600, h: 900, label: true },
  { bucket: 'salons', key: 'logo-hommes', svg: logoSvg('KB', 'barb'), w: 600, h: 600 },
  { bucket: 'salons', key: 'logo-femmes', svg: logoSvg('YB', 'nail'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-hommes', svg: avatarSvg('beard', 'barb'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-sofiane', svg: avatarSvg('short', 'hair'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-femmes', svg: avatarSvg('tied', 'nail'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-lina', svg: avatarSvg('long', 'lash'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-clienthomme', svg: avatarSvg('short', 'skin'), w: 600, h: 600 },
  { bucket: 'avatars', key: 'avatar-clientfemme', svg: avatarSvg('long', 'hair'), w: 600, h: 600 },
];

// Vérification : chaque prestation du catalogue (packages/constants/src/demo.ts) a son visuel.
const catalog = fs.readFileSync(path.join(ROOT, 'packages/constants/src/demo.ts'), 'utf8');
for (const m of catalog.matchAll(/key: '([hf]-[a-z0-9-]+)'/g)) if (!VISUALS[m[1]]) throw new Error(`visuel manquant pour ${m[1]}`);

const font700 = fs.readFileSync(path.join(ROOT, 'apps/web/public/fonts/inter-700.woff2')).toString('base64');
const font400 = fs.readFileSync(path.join(ROOT, 'apps/web/public/fonts/inter-400.woff2')).toString('base64');

const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(`<style>
  @font-face{font-family:Inter;font-weight:700;src:url(data:font/woff2;base64,${font700}) format('woff2')}
  @font-face{font-family:Inter;font-weight:400;src:url(data:font/woff2;base64,${font400}) format('woff2')}
  body{margin:0;font-family:Inter}</style><div style="font:700 20px Inter">Salon</div><div style="font:400 20px Inter">DZ</div>`);
await page.evaluate(() => document.fonts.ready);

/** SVG → WebP (et PNG de contrôle) : le sujet est rasterisé, puis la marque écrite avec la police de l'application. */
async function render(job) {
  const { webp, png } = await page.evaluate(
    async ({ svg, w, h, label }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      if (label) {
        // Marque en bas à gauche : « Salon » gras, « DZ » fin — même logo que l'en-tête de l'application.
        const s = Math.round(h * 0.046);
        ctx.fillStyle = '#111214';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `700 ${s}px Inter`;
        const x = Math.round(w * 0.05), y = Math.round(h * 0.92);
        ctx.fillText('Salon', x, y);
        const wSalon = ctx.measureText('Salon').width;
        ctx.font = `400 ${s}px Inter`;
        ctx.globalAlpha = 0.6;
        ctx.fillText('DZ', x + wSalon + s * 0.18, y);
        ctx.globalAlpha = 1;
      }
      return { webp: c.toDataURL('image/webp', 0.86), png: c.toDataURL('image/png') };
    },
    job,
  );
  return { webp: Buffer.from(webp.split(',')[1], 'base64'), png: Buffer.from(png.split(',')[1], 'base64') };
}

let admin = null;
if (!LOCAL) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY manquants (lancer via pnpm demo:visuals)');
  admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

let total = 0;
for (const job of JOBS) {
  const { webp, png } = await render(job);
  fs.writeFileSync(path.join(OUT, `${job.key}.webp`), webp);
  fs.writeFileSync(path.join(OUT, `${job.key}.png`), png);
  total += webp.length;
  if (admin) {
    const { error } = await admin.storage.from(job.bucket).upload(`demo/${job.key}.webp`, webp, { contentType: 'image/webp', cacheControl: '3600', upsert: true });
    if (error) throw new Error(`${job.bucket}/demo/${job.key}.webp : ${error.message}`);
  }
  console.log(`${admin ? '↑' : '·'} ${job.bucket}/demo/${job.key}.webp (${(webp.length / 1024).toFixed(0)} Ko)`);
}
await browser.close();
console.log(`${JOBS.length} visuels, ${(total / 1024).toFixed(0)} Ko${admin ? ', déposés dans Supabase Storage' : `, dans ${OUT}`}`);
