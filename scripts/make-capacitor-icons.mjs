/**
 * Icônes Android de l'application mobile (coque Capacitor) : le wordmark « Salon DZ » sur fond noir,
 * la MÊME marque que l'en-tête du site et que le favicon.
 *
 *   node scripts/make-capacitor-icons.mjs          → l'application grand public
 *   node scripts/make-capacitor-icons.mjs --pro    → la variante PROFESSIONNELLE (res-pro/)
 *
 * Trois jeux d'images, aux cinq densités d'Android :
 *   ic_launcher          icône pleine (appareils anciens)
 *   ic_launcher_round    même image, masque rond
 *   ic_launcher_foreground  premier plan de l'icône ADAPTATIVE : le fond est séparé et la zone sûre
 *                           n'est qu'un disque central de 66 %, d'où un wordmark plus petit.
 */
import fs, { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
/**
 * VARIANTE PROFESSIONNELLE. Les deux applications sont voisines sur un écran d'accueil : elles
 * doivent se reconnaître d'un coup d'œil sans qu'on lise. D'où la MÊME marque, et un bandeau clair
 * marqué PRO sous le logo — un contraste inversé se repère plus vite qu'un mot de plus à déchiffrer.
 *
 * Les fichiers vont dans `res-pro/`, que Gradle superpose à `res/` pour cette variante (voir
 * `app/build.gradle`) : rien à échanger ni à remettre en place avant et après chaque compilation.
 */
const PRO = process.argv.includes('--pro');
const RES = path.join(ROOT, 'apps', 'web', 'android', 'app', 'src', 'main', PRO ? 'res-pro' : 'res');
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

/**
 * Bandeau « PRO » : rectangle clair aux arrondis de la marque, texte en encre, lettres espacées.
 * Posé sous le logo, à une taille qui reste lisible à 48 px — la plus petite densité d'Android.
 */
const badgePro = (size) => {
  const w = size * 0.42;
  const h = size * 0.165;
  const x = (size - w) / 2;
  const y = size * 0.6;
  const r = size * 0.035;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#E8DACB"/>` +
    `<text x="${size / 2}" y="${y + h / 2 + CAP * (h * 0.56) / 2}" text-anchor="middle" font-family="Inter" ` +
    `font-size="${h * 0.56}" font-weight="700" letter-spacing="${size * 0.012}" fill="${INK}" ` +
    `textLength="${w * 0.58}" lengthAdjust="spacingAndGlyphs">PRO</text>`
  );
};

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
    const full = PRO
      ? svg(
          size,
          `<rect width="${size}" height="${size}" fill="${INK}"/>` +
            `<g transform="translate(0 ${-size * 0.1})">${wordmark(size, size * 0.165, size * 0.72)}</g>` +
            badgePro(size),
        )
      : svg(size, `<rect width="${size}" height="${size}" fill="${INK}"/>${wordmark(size, size * 0.185, size * 0.8)}`);
    await shoot(path.join(dir, 'ic_launcher.png'), size, full);
    await shoot(path.join(dir, 'ic_launcher_round.png'), size, full);
    // Premier plan adaptatif : le fond est fourni à part, et seul le disque central est garanti visible.
    await shoot(
      path.join(dir, 'ic_launcher_foreground.png'),
      size,
      PRO
        ? svg(
            size,
            `<g transform="translate(0 ${-size * 0.07})">${wordmark(size, size * 0.112, size * 0.48)}</g>` +
              `<g transform="translate(${size * 0.5} ${size * 0.5}) scale(0.66) translate(${-size * 0.5} ${-size * 0.5})">${badgePro(size)}</g>`,
          )
        : svg(size, wordmark(size, size * 0.127, size * 0.55)),
      true,
    );
    console.log('✔', `mipmap-${density}`, `${size}px`);
  }
  // Écran de démarrage natif : le fond d'encre et le wordmark, identiques à l'animation d'ouverture,
  // pour qu'on ne voie aucune rupture entre l'écran système et l'application.
  const SPLASH = { mdpi: 320, hdpi: 480, xhdpi: 720, xxhdpi: 960, xxxhdpi: 1280 };
  for (const [density, size] of Object.entries(SPLASH)) {
    const body = svg(size, `<rect width="${size}" height="${size}" fill="${INK}"/>${wordmark(size, size * 0.1, size * 0.44)}`);
    for (const orientation of ['port', 'land']) {
      const dir = path.join(RES, `drawable-${orientation}-${density}`);
      mkdirSync(dir, { recursive: true });
      await shoot(path.join(dir, 'splash.png'), size, body);
    }
  }
  await shoot(path.join(RES, 'drawable', 'splash.png'), 480, svg(480, `<rect width="480" height="480" fill="${INK}"/>${wordmark(480, 48, 211)}`));
  console.log('✔ écrans de démarrage');

  // iOS : une seule icône de 1024 (Xcode décline les tailles), et l'écran de démarrage en trois
  // densités. Même marque que l'Android, au pixel près.
  /**
   * iOS n'a PAS de variante professionnelle : il n'existe qu'une application iPhone, celle du grand
   * public. Ces visuels sont partagés — les écrire en mode `--pro` donnerait l'icône PRO à
   * l'application iPhone de tout le monde. C'est arrivé une fois ; d'où ce garde.
   */
  const XCASSETS = path.join(ROOT, 'apps', 'web', 'ios', 'App', 'App', 'Assets.xcassets');
  const IOS = PRO ? null : XCASSETS;
  const iconSet = IOS ? path.join(IOS, 'AppIcon.appiconset') : null;
  if (iconSet && fs.existsSync(iconSet)) {
    await shoot(path.join(iconSet, 'AppIcon-512@2x.png'), 1024, svg(1024, `<rect width="1024" height="1024" fill="${INK}"/>${wordmark(1024, 190, 820)}`));
    console.log('✔ icône iOS 1024');
  }
  /**
   * Depuis le 10 oct. 2026, l'application PROFESSIONNELLE iPhone existe (`pro.salondz.app`, voir
   * `codemagic.yaml`, flux `ios-pro`). Son icône vit dans un jeu À PART, `AppIcon-Pro.appiconset`,
   * que seul ce flux branche (`ASSETCATALOG_COMPILER_APPICON_NAME`) : le jeu `AppIcon` du grand
   * public n'est jamais touché en mode `--pro` — le garde ci-dessus reste entier.
   */
  if (PRO && fs.existsSync(XCASSETS)) {
    const proSet = path.join(XCASSETS, 'AppIcon-Pro.appiconset');
    mkdirSync(proSet, { recursive: true });
    fs.writeFileSync(
      path.join(proSet, 'Contents.json'),
      JSON.stringify({ images: [{ filename: 'AppIcon-512@2x.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
    );
    await shoot(
      path.join(proSet, 'AppIcon-512@2x.png'),
      1024,
      svg(1024, `<rect width="1024" height="1024" fill="${INK}"/><g transform="translate(0 -102)">${wordmark(1024, 170, 738)}</g>${badgePro(1024)}`),
    );
    console.log('✔ icône iOS 1024 (pro, AppIcon-Pro.appiconset)');
  }
  const splashSet = IOS ? path.join(IOS, 'Splash.imageset') : null;
  if (splashSet && fs.existsSync(splashSet)) {
    for (const [nom, taille] of [['splash-2732x2732.png', 2732], ['splash-2732x2732-1.png', 2732], ['splash-2732x2732-2.png', 2732]]) {
      await shoot(path.join(splashSet, nom), taille, svg(taille, `<rect width="${taille}" height="${taille}" fill="${INK}"/>${wordmark(taille, taille * 0.062, taille * 0.28)}`));
    }
    console.log('✔ écran de démarrage iOS');
  }

  // Play Store : icône 512 pleine, même marque.
  const store = path.join(ROOT, 'apps', 'web', 'android', 'store');
  mkdirSync(store, { recursive: true });
  const nomStore = PRO ? 'icone-play-store-512-pro.png' : 'icone-play-store-512.png';
  const dessinStore = PRO
    ? `<rect width="512" height="512" fill="${INK}"/><g transform="translate(0 -51)">${wordmark(512, 85, 369)}</g>${badgePro(512)}`
    : `<rect width="512" height="512" fill="${INK}"/>${wordmark(512, 96, 410)}`;
  await shoot(path.join(store, nomStore), 512, svg(512, dessinStore));
  console.log('✔ icône Play Store 512', PRO ? '(pro)' : '');
} finally {
  await browser.close();
}
