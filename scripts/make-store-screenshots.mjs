/**
 * Prépare les visuels Google Play (fiche « Graphismes ») à partir des captures DÉJÀ existantes
 * (apps/mobile/store-assets/android/*.png, 1080×2400, prises depuis l'application) : Google refuse un
 * écart de plus de 2:1 entre les côtés (2400/1080 = 2,22 > 2), d'où le recadrage. Aucune nouvelle capture,
 * aucun serveur : uniquement du découpage/de la composition d'images déjà en place (Playwright, pas de
 * dépendance d'image supplémentaire).
 *
 *   node scripts/make-store-screenshots.mjs
 *
 * Produit, sous apps/mobile/store-assets/android/ :
 *   icone-application-512.png            (déjà généré par make-app-icons.mjs --store)
 *   image-de-presentation-1024x500.png   (déjà généré par make-app-icons.mjs --store)
 *   telephone/1..5-*.png                 recadrées en 1080×1920 (16:9, sous la limite Google)
 *   tablette-7-pouces/1..5-*.png         même image, centrée sur fond de marque 1200×1920
 *   tablette-10-pouces/1..5-*.png        même image, centrée sur fond de marque 1600×2560
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'apps', 'mobile', 'store-assets', 'android');
const INK = '#111214';

const PHONE_W = 1080;
const PHONE_H = 1920; // recadrage haut de l'existant (1080×2400) : bandeau + contenu, pied coupé.
const TABLETS = {
  'tablette-7-pouces': { w: 1200, h: 1920 },
  'tablette-10-pouces': { w: 1600, h: 2560 },
};

const files = fs.readdirSync(SRC).filter((f) => /^\d-.*\.png$/.test(f));
if (files.length === 0) throw new Error(`Aucune capture source dans ${SRC}`);

for (const dir of ['telephone', ...Object.keys(TABLETS)]) {
  fs.mkdirSync(path.join(SRC, dir), { recursive: true });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();

async function shootHtml(file, width, height, body) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:${INK}}</style>${body}`);
  await page.waitForTimeout(80);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height } });
}

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

for (const f of files) {
  const src = dataUri(path.join(SRC, f));

  // Téléphone : recadrage haut (object-position top) en 1080×1920, sans étirement.
  const phoneOut = path.join(SRC, 'telephone', f);
  await shootHtml(phoneOut, PHONE_W, PHONE_H, `<img src="${src}" style="width:${PHONE_W}px;height:auto;object-fit:cover;object-position:top;display:block">`);
  console.log('✔ téléphone', f);
  const phoneSrc = dataUri(phoneOut);

  // Tablettes : l'app n'a pas de mise en page tablette dédiée ; la capture téléphone (déjà recadrée
  // à un ratio correct) est centrée à 90 % de hauteur sur un fond de marque plutôt qu'étirée en pleine
  // largeur, ce qui la rendrait illisible.
  for (const [dir, { w, h }] of Object.entries(TABLETS)) {
    const imgH = Math.round(h * 0.9);
    const imgW = Math.round(PHONE_W * (imgH / PHONE_H));
    const out = path.join(SRC, dir, f);
    await shootHtml(
      out,
      w,
      h,
      `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center"><img src="${phoneSrc}" style="width:${imgW}px;height:${imgH}px;border-radius:28px;box-shadow:0 40px 120px rgba(0,0,0,.5)"></div>`,
    );
    console.log('✔', dir, f);
  }
}

await browser.close();
