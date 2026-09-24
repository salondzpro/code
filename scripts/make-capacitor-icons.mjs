/**
 * Icônes Android de l'application mobile (coque Capacitor) : le wordmark « Salon DZ » sur fond noir,
 * la MÊME marque que l'en-tête du site et que le favicon.
 *
 *   node scripts/make-capacitor-icons.mjs
 *
 * Trois jeux d'images, aux cinq densités d'Android :
 *   ic_launcher          icône pleine (appareils anciens)
 *   ic_launcher_round    même image, masque rond
 *   ic_launcher_foreground  premier plan de l'icône ADAPTATIVE : le fond est séparé et la zone sûre
 *                           n'est qu'un disque central de 66 %, d'où un wordmark plus petit.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const RES = path.join(ROOT, 'apps', 'web', 'android', 'app', 'src', 'main', 'res');
const FONTS = path.join(ROOT, 'apps', 'web', 'public', 'fonts');

const INK = '#111214';
const CAP = 0.7275; // hauteur de capitale d'Inter, en em
/** Tailles Android : mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192. */
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const font = (weight) =>
  `@font-face{font-family:Inter;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(
    path.join(FONTS, `inter-${weight}.woff2`),
  ).toString('base64')}) format('woff2')}`;
const FONT_CSS = [400, 600].map(font).join('');

/** Le wordmark, à largeur imposée pour tenir exactement dans la zone voulue quelle que soit la police. */
const wordmark = (size, fontSize, textWidth) =>
  `<text x="${size / 2}" y="${size / 2 + (CAP * fontSize) / 2}" text-anchor="middle" font-family="Inter" font-size="${fontSize}" textLength="${textWidth}" lengthAdjust="spacingAndGlyphs"><tspan font-weight="600" fill="#fff">Salon </tspan><tspan font-weight="400" fill="#9aa0a6">DZ</tspan></text>`;

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

async function shoot(file, size, body, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>${FONT_CSS}html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#fff'};width:${size}px;height:${size}px;overflow:hidden}</style>${body}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

try {
  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    const full = svg(size, `<rect width="${size}" height="${size}" fill="${INK}"/>${wordmark(size, size * 0.185, size * 0.8)}`);
    await shoot(path.join(dir, 'ic_launcher.png'), size, full);
    await shoot(path.join(dir, 'ic_launcher_round.png'), size, full);
    // Premier plan adaptatif : le fond est fourni à part, et seul le disque central est garanti visible.
    await shoot(path.join(dir, 'ic_launcher_foreground.png'), size, svg(size, wordmark(size, size * 0.127, size * 0.55)), true);
    console.log('✔', `mipmap-${density}`, `${size}px`);
  }
  // Play Store : icône 512 pleine, même marque.
  const store = path.join(ROOT, 'apps', 'web', 'android', 'store');
  mkdirSync(store, { recursive: true });
  await shoot(path.join(store, 'icone-play-store-512.png'), 512, svg(512, `<rect width="512" height="512" fill="${INK}"/>${wordmark(512, 96, 410)}`));
  console.log('✔ icône Play Store 512');
} finally {
  await browser.close();
}
