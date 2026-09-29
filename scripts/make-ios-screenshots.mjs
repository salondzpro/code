/**
 * Captures d'écran iPhone pour l'App Store, en 1290×2796 exactement (6,7 pouces).
 *
 *   node scripts/make-ios-screenshots.mjs                 → contre la production
 *   node scripts/make-ios-screenshots.mjs --url http://localhost:9000
 *
 * POURQUOI ON PEUT LES PRENDRE DEPUIS LE SITE : depuis la bascule Capacitor, l'application mobile
 * EST le site embarqué dans une coque native. Un rendu du site à la taille d'un iPhone est donc
 * l'application au pixel près — ce n'était pas vrai du temps d'Expo, où les deux interfaces
 * étaient distinctes (docs/STORES.md § 4 le disait, cette note remplace l'avertissement).
 *
 * Deux détails qui font la différence entre une capture juste et une capture fausse :
 *   - 430×932 points × 3 = 1290×2796. La densité est réglée à 3, pas la taille de la fenêtre :
 *     mettre 1290 px de large donnerait la mise en page d'une TABLETTE, pas celle d'un téléphone.
 *   - Les marges de sécurité de l'iPhone (encoche 59 pt, barre d'accueil 34 pt) sont injectées dans
 *     les mêmes variables CSS que celles posées par le natif, pour que l'en-tête et la barre
 *     d'onglets se placent exactement où elles se placeront sur l'appareil.
 *
 * Le contenu vient de la DÉMONSTRATION (`client@salondz.com`, `pro-homme@salondz.com`, mot de passe
 * identique à l'adresse) : un monde complet et déterministe, alors que la vraie place de marché ne
 * contient encore qu'un salon.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'apps', 'web', 'ios', 'store', 'captures-6-7');

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const BASE = arg('--url', 'https://salondz.com').replace(/\/$/, '');

/** iPhone 15 Pro Max : 430×932 points, densité 3 → 1290×2796 pixels. */
const LARGEUR = 430;
const HAUTEUR = 932;
const DENSITE = 3;
/** Marges de sécurité réelles d'un iPhone à Dynamic Island, en points. */
const HAUT = 59;
const BAS = 34;

fs.mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: LARGEUR, height: HAUTEUR },
  deviceScaleFactor: DENSITE,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  timezoneId: 'Africa/Algiers',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
});
// Les mêmes variables que MainActivity pose côté Android : la feuille de style les lit en priorité
// sur env(safe-area-inset-*), qui vaut 0 dans un navigateur de bureau.
await ctx.addInitScript(
  ([haut, bas]) => {
    const poser = () => {
      const s = document.documentElement.style;
      s.setProperty('--sat', haut + 'px');
      s.setProperty('--sab', bas + 'px');
    };
    poser();
    document.addEventListener('DOMContentLoaded', poser);
  },
  [HAUT, BAS],
);

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

const calme = async (ms = 900) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
};

/** Une capture, nommée dans l'ordre où l'App Store les affichera. */
let n = 0;
async function prendre(nom) {
  n += 1;
  const fichier = path.join(OUT, `${n}-${nom}.png`);
  await page.screenshot({ path: fichier, clip: { x: 0, y: 0, width: LARGEUR, height: HAUTEUR } });
  const b = fs.readFileSync(fichier);
  const taille = `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`;
  if (taille !== `${LARGEUR * DENSITE}×${HAUTEUR * DENSITE}`) throw new Error(`${nom} : ${taille}, attendu 1290×2796`);
  console.log('✔', path.basename(fichier), taille);
}

/**
 * Ouvre une session de démonstration : l'adresse sert aussi de mot de passe.
 * On VÉRIFIE qu'on a bien quitté l'écran de connexion — sinon les captures suivantes seraient
 * toutes le même formulaire, et le défaut ne se verrait qu'une fois la fiche envoyée à Apple.
 */
async function connexion(adresse) {
  await page.goto(`${BASE}/intro`, { waitUntil: 'domcontentloaded' });
  await calme(2000); // l'animation d'ouverture dure 1,6 s
  await page.locator('input[type="email"], input[name="email"]').first().fill(adresse);
  await page.locator('input[type="password"]').first().fill(adresse);
  await page.locator('form button[type="submit"]').first().click();
  await calme(3000);
  const ou = new URL(page.url()).pathname;
  if (/connexion|intro|inscription/.test(ou)) {
    const erreur = await page.locator('[role="alert"], .err, .error').first().textContent().catch(() => null);
    throw new Error(`connexion refusée pour ${adresse} — resté sur ${ou}${erreur ? ` (${erreur.trim()})` : ''}`);
  }
  console.log(`  session ${adresse} → ${ou}`);
}

try {
  // ------------------------------------------------------------------- côté client
  await connexion('client@salondz.com');
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await calme(1500);
  await prendre('place-de-marche');

  const salon = page.locator('a[href^="/s/"]').first();
  await salon.click();
  await calme(1500);
  await prendre('fiche-salon');

  await page.goto(`${BASE}${new URL(page.url()).pathname.replace(/\/$/, '')}/prestations`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await calme(1500);
  await prendre('choix-du-creneau');

  await page.goto(`${BASE}/rendez-vous`, { waitUntil: 'domcontentloaded' });
  await calme(1500);
  await prendre('mes-rendez-vous');

  // ------------------------------------------------------------------- côté professionnel
  // Il n'existe pas de route de déconnexion : la session vit dans le stockage du navigateur, et
  // c'est lui qu'on vide. Le monde de démonstration est effacé au passage, mais il se régénère à
  // l'identique — il est déterministe.
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await connexion('pro-homme@salondz.com');
  await page.goto(`${BASE}/pro`, { waitUntil: 'domcontentloaded' });
  await calme(1800);
  await prendre('accueil-professionnel');

  await page.goto(`${BASE}/pro/agenda`, { waitUntil: 'domcontentloaded' });
  await calme(1800);
  // L'agenda s'ouvre sur le début de journée, souvent vide. On descend en milieu d'après-midi :
  // une capture d'agenda doit montrer des rendez-vous, pas des heures creuses.
  await page.evaluate(() => {
    const defilant = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 200);
    if (defilant) defilant.scrollTop = defilant.scrollHeight * 0.42;
    else window.scrollBy(0, 600);
  });
  await calme(900);
  await prendre('agenda-professionnel');

  console.log(`\n${n} captures dans ${path.relative(ROOT, OUT)}`);
} finally {
  await browser.close();
}
