/**
 * Contrôle des MARGES SYSTÈME : aucun contenu ne doit passer sous la barre d'état ni sous la
 * barre de navigation du téléphone.
 *
 *   pnpm --filter @salondz/web build   (une fois)
 *   node scripts/check-safe-areas.mjs
 *
 * POURQUOI CE CONTRÔLE EXISTE : la réserve des marges vivait dans `AppFrame`, un composant que
 * tout le monde n'emprunte pas. Les écrans affichés AVANT d'y entrer — une erreur de garde, un
 * plantage, le chargement — s'affichaient sous la barre d'état, à moitié illisibles. Le défaut
 * ne se voit pas sur un ordinateur, où les marges valent zéro : il faut les simuler.
 *
 * Le contrôle est structurel, pas visuel : on mesure la position réelle de chaque élément qui
 * porte du texte et on refuse qu'il empiète sur les bandes réservées.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps', 'web', 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`construire d'abord le site : ${DIST} est vide`);

/** Marges d'un téléphone réel : encoche en haut, barre de gestes en bas. */
const HAUT = 59;
const BAS = 34;
const LARGEUR = 430;
const HAUTEUR = 932;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

// Serveur statique minimal : toute adresse inconnue rend index.html, comme les règles du site.
const serveur = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  let fichier = path.join(DIST, rel);
  if (!fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) fichier = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] ?? 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
});
await new Promise((f) => serveur.listen(0, f));
const BASE = `http://localhost:${serveur.address().port}`;

const browser = await pw.chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: LARGEUR, height: HAUTEUR },
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
});
/**
 * Les mêmes variables que pose `MainActivity` sur l'appareil, injectées par une FEUILLE DE STYLE.
 * Un script d'initialisation ne suffit pas : Playwright l'exécute sur le document d'avant
 * l'analyse du HTML, que le parseur remplace ensuite — la propriété posée en ligne disparaît, et
 * le contrôle s'exécute alors avec des marges nulles, c'est-à-dire sans rien vérifier du tout.
 */
const MARGES = `:root{--sat:${HAUT}px;--sab:${BAS}px}`;

const page = await ctx.newPage();
let fautes = 0;

/**
 * Tout élément qui porte du texte visible et qui empiète sur une bande réservée.
 *
 * Le contrôle se fait DEUX FOIS : en haut de page, puis tout en bas. En haut, on vérifie que rien
 * ne se cache derrière la barre d'état. Tout en bas, on vérifie que la FIN du contenu dégage la
 * barre de navigation — c'est là que le défaut se voit, pas au milieu d'un défilement où il est
 * normal que le texte passe sous les barres.
 */
async function mesurer() {
  return page.evaluate(
    ([haut, bas, hauteur]) => {
      const mauvais = [];
      for (const el of document.querySelectorAll('body *')) {
        const texte = (el.textContent ?? '').trim();
        // On ne juge que les FEUILLES porteuses de texte : un conteneur peut légitimement
        // s'étendre d'un bord à l'autre, c'est ce qu'on lit dedans qui ne doit pas être couvert.
        if (!texte || el.children.length > 0) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Hors de l'écran : il faudra faire défiler pour l'atteindre, ce n'est pas un recouvrement.
        if (r.bottom <= 0 || r.top >= hauteur) continue;
        if (r.top < haut) mauvais.push(`HAUT ${Math.round(r.top)}px « ${texte.slice(0, 40)} »`);
        else if (r.bottom > hauteur - bas) mauvais.push(`BAS ${Math.round(hauteur - r.bottom)}px « ${texte.slice(0, 40)} »`);
      }
      return [...new Set(mauvais)];
    },
    [HAUT, BAS, HAUTEUR],
  );
}

async function controler(nom, chemin) {
  await page.goto(BASE + chemin, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: MARGES });
  await page.waitForTimeout(2200); // animation d'ouverture comprise

  const haut = (await mesurer()).filter((m) => m.startsWith('HAUT'));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const bas = (await mesurer()).filter((m) => m.startsWith('BAS'));
  const intrus = [...haut, ...bas];

  if (intrus.length) {
    fautes += intrus.length;
    console.log(`✖ ${nom} (${chemin}) — ${intrus.length} élément(s) sous une barre système`);
    for (const i of intrus.slice(0, 6)) console.log('    ', i);
  } else {
    console.log(`✔ ${nom} (${chemin})`);
  }
}

try {
  await controler("page d'accueil", '/intro');
  await controler('connexion', '/connexion');
  await controler('inscription', '/inscription');
  await controler('portail professionnels', '/pro/bienvenue');
  await controler('aide', '/aide');
  await controler('confidentialité', '/confidentialite');
  await controler('adresse inconnue', '/cette-page-nexiste-pas');

  console.log(fautes === 0 ? '\n✔ aucun contenu sous les barres système' : `\n✖ ${fautes} intrusion(s)`);
  process.exitCode = fautes === 0 ? 0 : 1;
} finally {
  await browser.close();
  serveur.close();
}
