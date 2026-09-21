/**
 * Génère les images de marque de l'application mobile — la MÊME marque que le site : un carré noir
 * `#111214` et un « S » blanc en Inter Bold (voir `apps/web/public/favicon.svg`).
 *
 *   node scripts/make-app-icons.mjs                     → apps/mobile/assets/*
 *   node scripts/make-app-icons.mjs --store <dossier>   → + icône 512 et image de présentation du Play Store
 *
 * Avant ce script, `icon.png`, `adaptive-icon.png` et `splash.png` étaient des CARRÉS VIOLETS UNIS, sans
 * logo : l'application aurait été publiée avec une icône vide. Rien n'est dessiné à la main ici — la police
 * est celle du site, et la position de la lettre se calcule (hauteur de capitale d'Inter = 0,7275 em) pour
 * que le « S » soit centré à l'œil, pas seulement dans sa boîte.
 *
 * Fichiers produits :
 *   icon.png                1024² plein cadre, sans transparence (iOS arrondit lui-même)
 *   adaptive-icon.png       1024² transparent, « S » dans la zone sûre de 66 % (Android masque en rond, goutte…)
 *   splash.png              1024² transparent, pastille arrondie sur fond blanc (écran de démarrage)
 *   notification-icon.png   96² blanc sur transparent : la petite icône de la barre d'état Android. Sans elle,
 *                           Android affiche un carré gris à la place de l'icône de l'application.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'apps', 'mobile', 'assets');
const FONTS = path.join(ROOT, 'apps', 'web', 'public', 'fonts');
const storeDir = process.argv.includes('--store') ? process.argv[process.argv.indexOf('--store') + 1] : null;

const INK = '#111214';
const CAP = 0.7275; // hauteur de capitale d'Inter, en em

const font = (weight) =>
  `@font-face{font-family:Inter;font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(
    path.join(FONTS, `inter-${weight}.woff2`),
  ).toString('base64')}) format('woff2')}`;
const FONT_CSS = [400, 600, 700].map(font).join('');

/** Un « S » centré dans un carré de côté `size` : la ligne de base se déduit de la hauteur de capitale. */
const letter = (size, fontSize, fill) =>
  `<text x="${size / 2}" y="${size / 2 + (CAP * fontSize) / 2}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${fontSize}" fill="${fill}">S</text>`;

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

async function shoot(file, width, height, body, { transparent = false } = {}) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<style>${FONT_CSS}html,body{margin:0;padding:0;background:${transparent ? 'transparent' : '#fff'};width:${width}px;height:${height}px;overflow:hidden}</style>${body}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  console.log('✔', path.relative(ROOT, file));
}

try {
  // iOS : plein cadre, sans transparence ni coins arrondis (le système applique son propre masque).
  await shoot(path.join(ASSETS, 'icon.png'), 1024, 1024, svg(1024, `<rect width="1024" height="1024" fill="${INK}"/>${letter(1024, 640, '#fff')}`));

  // Android adaptatif : le fond (`backgroundColor` d'app.json = INK) est séparé du premier plan.
  // Zone sûre = disque central de 66 % ; le « S » (≈ 0,6 em de large, 0,73 em de haut) y tient à 560.
  await shoot(path.join(ASSETS, 'adaptive-icon.png'), 1024, 1024, svg(1024, letter(1024, 560, '#fff')), { transparent: true });

  // Écran de démarrage : la pastille de la marque sur fond blanc (fond réglé dans app.json).
  await shoot(
    path.join(ASSETS, 'splash.png'),
    1024,
    1024,
    svg(1024, `<rect x="112" y="112" width="800" height="800" rx="176" fill="${INK}"/>${letter(1024, 500, '#fff')}`),
    { transparent: true },
  );

  // Petite icône de notification : blanc sur transparent, seule la forme compte (Android en fait un pochoir).
  await shoot(path.join(ASSETS, 'notification-icon.png'), 96, 96, svg(96, letter(96, 84, '#fff')), { transparent: true });

  if (storeDir) {
    mkdirSync(storeDir, { recursive: true });
    // Play Store : icône 512 × 512 (Google applique son masque, on livre plein cadre).
    await shoot(path.join(storeDir, 'icone-play-store-512.png'), 512, 512, svg(512, `<rect width="512" height="512" fill="${INK}"/>${letter(512, 320, '#fff')}`));

    // Play Store : image de présentation 1024 × 500 (obligatoire). Marque et promesse, rien d'autre.
    await shoot(
      path.join(storeDir, 'image-de-presentation-1024x500.png'),
      1024,
      500,
      `<div style="width:1024px;height:500px;background:${INK};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;font-family:Inter">
         <div style="font-size:128px;line-height:1;letter-spacing:-4px;color:#fff"><span style="font-weight:600">Salon</span> <span style="font-weight:400;color:#9aa0a6">DZ</span></div>
         <div style="font-size:34px;font-weight:400;color:#c9cdd2;letter-spacing:-0.3px">Réservez votre coiffeur, barbier ou institut.</div>
       </div>`,
    );
  }
} finally {
  await browser.close();
}
