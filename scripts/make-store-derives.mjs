/**
 * Dérive les séries iPhone 6,5 et 5,5 pouces des visuels 6,7 pouces, pour les deux fiches.
 *
 *   node scripts/make-store-derives.mjs          → les deux applications
 *   node scripts/make-store-derives.mjs --pro    → « Salon DZ Pro » seulement
 *   node scripts/make-store-derives.mjs --client → « Salon DZ » seulement
 *
 * POURQUOI : depuis 2024 Apple n'exige QUE la série 6,7 pouces et la réduit lui-même pour les
 * autres iPhone. Mais ses onglets 6,5 et 5,5 pouces restent vides sur la fiche, et un iPhone 8 Plus
 * ou un iPhone 11 — très répandus en Algérie — affiche une réduction automatique dont on ne
 * maîtrise pas le cadrage. On livre donc les trois séries, comme on a livré téléphone, tablette 7 et
 * tablette 10 pouces sur Google Play.
 *
 * COMMENT : pas de nouveau rendu, pas de dépendance d'image. Le volet 6,7 pouces (1290×2796) est
 * affiché dans une page HTML à la largeur cible et photographié par Chrome, qui le réduit proprement.
 *   - 6,5 pouces, 1242×2688 : même rapport à 4 px près — réduction, 2 px rognés en haut et en bas.
 *   - 5,5 pouces, 1242×2208 : plus trapu de 18 %. On rogne un peu AU-DESSUS du titre (la marge y
 *     est généreuse) et surtout SOUS le téléphone (la partie basse de l'écran est déjà coupée par le
 *     bord du volet). Le titre et le haut de l'écran, ce qui se lit, restent entiers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE = path.join(ROOT, 'apps', 'web', 'ios', 'store');

const arg = (n) => process.argv.includes(n);
const APPS = [
  ...(arg('--pro') ? [] : [{ nom: 'Salon DZ', dossier: STORE }]),
  ...(arg('--client') ? [] : [{ nom: 'Salon DZ Pro', dossier: path.join(STORE, 'pro') }]),
];

/** Largeur et hauteur cibles, et ce qu'on rogne en haut sur la source déjà réduite à 1242 px. */
const SERIES = [
  { cle: '6-5', L: 1242, H: 2688, haut: 2 },
  { cle: '5-5', L: 1242, H: 2208, haut: 120 },
];

/** Hauteur de la source une fois ramenée à 1242 px de large (1290×2796 → 1242×2692). */
const H_REDUITE = Math.round((2796 * 1242) / 1290);

const browser = await pw.chromium.launch({ channel: 'chrome' });
let total = 0;
for (const app of APPS) {
  const source = path.join(app.dossier, 'presentation-6-7');
  const fichiers = fs.readdirSync(source).filter((f) => f.endsWith('.png')).sort();
  if (!fichiers.length) throw new Error(`aucun visuel 6,7 pouces dans ${source}`);

  for (const serie of SERIES) {
    const sortie = path.join(app.dossier, `presentation-${serie.cle}`);
    fs.mkdirSync(sortie, { recursive: true });
    if (serie.haut + serie.H > H_REDUITE) throw new Error(`série ${serie.cle} : rognage impossible`);

    const page = await browser.newPage({ viewport: { width: serie.L, height: serie.H }, deviceScaleFactor: 1 });
    for (const nom of fichiers) {
      const png = fs.readFileSync(path.join(source, nom)).toString('base64');
      // Le volet est posé à sa largeur réduite, puis décalé vers le haut de ce qu'on rogne : la
      // fenêtre, aux dimensions exactes de la série, ne garde que la partie visible.
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>
          html,body{margin:0;padding:0;background:#0f1012;overflow:hidden}
          img{position:absolute;left:0;top:-${serie.haut}px;width:${serie.L}px;height:${H_REDUITE}px;display:block}
        </style></head><body><img src="data:image/png;base64,${png}"></body></html>`,
      );
      await page.waitForFunction(() => document.images[0]?.complete);
      const cible = path.join(sortie, nom);
      await page.screenshot({ path: cible, clip: { x: 0, y: 0, width: serie.L, height: serie.H }, omitBackground: false });
      const octets = fs.readFileSync(cible);
      const largeur = octets.readUInt32BE(16);
      const hauteur = octets.readUInt32BE(20);
      if (largeur !== serie.L || hauteur !== serie.H) throw new Error(`${cible} : ${largeur}×${hauteur}, attendu ${serie.L}×${serie.H}`);
      total++;
    }
    await page.close();
    console.log(`✔ ${app.nom} · ${serie.cle} pouces : ${fichiers.length} visuels ${serie.L}×${serie.H} → ${path.relative(ROOT, sortie)}`);
  }
}
await browser.close();
console.log(`\n${total} visuels dérivés.`);
