/**
 * Écrans de l'application montrés sur `/home` (page de présentation, racine du site) et sur
 * `/professionnels`, capturés avec les comptes de démonstration, en WebP — DANS LES TROIS LANGUES
 * (14 nov. 2026, demande du propriétaire : « en arabe, des images arabes ; en anglais, en anglais »).
 *
 *   node scripts/make-home-screens.mjs                         → contre salondz.com
 *   node scripts/make-home-screens.mjs --url http://localhost:9000
 *
 * Sorties : `apps/web/public/home/<écran>.webp` (français), `home/ar/<écran>.webp`, `home/en/<écran>.webp`.
 * La page choisit le dossier d'après la langue du visiteur (`Phone` dans `pages/Home.tsx`).
 *
 * Méthode : chaque parcours se fait UNE fois, en français (les libellés des boutons sont connus), puis
 * l'écran atteint est rechargé dans chaque langue (`salondz:locale`) et photographié. Le brouillon de
 * réservation et la session survivent au rechargement : on photographie bien le même écran.
 * À relancer quand un de ces écrans change.
 */
import pw from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const i = process.argv.indexOf('--url');
const B = (i > 0 ? process.argv[i + 1] : 'https://salondz.com').replace(/\/$/, '');
const OUT = fileURLToPath(new URL('../apps/web/public/home', import.meta.url));
const LANGUES = ['fr', 'ar', 'en'];
for (const l of LANGUES) if (l !== 'fr') fs.mkdirSync(`${OUT}/${l}`, { recursive: true });

const b = await pw.chromium.launch({ channel: 'chrome' });
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  // L'accueil pro prépare en arrière-plan la vidéo du salon (WebCodecs), et la refait à chaque
  // changement de langue : le navigateur, occupé, ne rend plus la capture. Sans encodeur, la vidéo
  // n'est simplement pas préparée — l'écran photographié est le même.
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'VideoEncoder', { value: undefined, configurable: true });
    Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true });
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  return p;
};
const conv = await (await b.newContext()).newPage();

async function enregistrer(p, nom, langue) {
  // Le contenu doit être LÀ (texte rendu, plus de squelette de chargement) : sans cette attente,
  // une page rechargée était photographiée vide.
  await p
    .waitForFunction(() => document.body.innerText.trim().length > 120 && !document.querySelector('.sk, .ldbar'), null, { timeout: 30000 })
    .catch(() => undefined);
  await p.waitForTimeout(1800);
  let png;
  for (let essai = 1; ; essai++) {
    try {
      png = await p.screenshot({ type: 'png', timeout: 30000, animations: 'disabled' });
      break;
    } catch (e) {
      if (essai >= 3) throw e;
      await p.waitForTimeout(3000);
    }
  }
  const url = await conv.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 585;
    c.height = Math.round((img.height * 585) / img.width);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.84);
  }, png.toString('base64'));
  const f = langue === 'fr' ? `${OUT}/${nom}.webp` : `${OUT}/${langue}/${nom}.webp`;
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${langue} ${nom}`, Math.round(fs.statSync(f).size / 1024) + ' ko');
}

/** L'écran courant, rechargé et photographié dans chaque langue, puis remis en français. */
async function prendre(p, nom) {
  for (const l of LANGUES) {
    await p.evaluate((x) => {
      localStorage.setItem('salondz:locale', x);
      localStorage.setItem('salondz:locale:choisie', '1');
    }, l);
    await p.reload({ waitUntil: 'networkidle' });
    await enregistrer(p, nom, l);
  }
  await p.evaluate(() => localStorage.setItem('salondz:locale', 'fr'));
}

const login = async (p, base, email) => {
  await p.goto(B + base, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('salondz:locale', 'fr'));
  await p.reload({ waitUntil: 'networkidle' });
  await p.fill('input[type=email]', email);
  await p.getByRole('button', { name: /Continuer/ }).click();
  await p.fill('input[type=password]', email);
  await p.getByRole('button', { name: /Se connecter/ }).first().click();
  await p.waitForURL((u) => !/acces|intro|connexion/.test(u.pathname));
  await p.waitForTimeout(2500);
};

// ---- client : la place de marché vit sur /salons (la racine du site est la page de présentation)
let p = await mk();
await login(p, '/acces?next=%2Fsalons', 'client@salondz.com');
await p.goto(B + '/salons', { waitUntil: 'networkidle' });
await prendre(p, 'client-accueil');
const href = await p.evaluate(() => [...document.querySelectorAll('a[href^="/s/"]')].map((a) => a.getAttribute('href'))[0]);
await p.goto(B + href, { waitUntil: 'networkidle' });
await prendre(p, 'client-salon');
await p.goto(B + href + '/prestations', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Choisir/ }).first().click();
await p.waitForTimeout(1500);
await p.locator('button.slot, button[class*=slot]').first().click().catch(() => {});
await prendre(p, 'client-quand');
await p.goto(B + '/rendez-vous', { waitUntil: 'networkidle' });
await prendre(p, 'client-rdv');

// ---- pro
p = await mk();
await login(p, '/pro/acces', 'pro-femme@salondz.com');
for (const [nom, url] of [
  ['pro-accueil', '/pro'],
  ['pro-agenda', '/pro/agenda'],
  ['pro-demandes', '/pro/reservations'],
  ['pro-rappels', '/pro/rappels'],
  ['pro-mapage', '/pro/ma-page'],
  ['pro-clients', '/pro/clients'],
]) {
  await p.goto(B + url, { waitUntil: 'networkidle' });
  await prendre(p, nom);
}
await b.close();
