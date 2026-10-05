/**
 * Vérifie que le SITE PUBLIÉ se comporte correctement quand il est chargé PAR LA COQUE mobile.
 *
 *   node scripts/check-coque.mjs
 *   node scripts/check-coque.mjs --url http://localhost:9000
 *
 * POURQUOI CE CONTRÔLE EXISTE. Depuis le passage de l'application grand public en mode EN LIGNE,
 * la coque ne contient plus les écrans : elle charge salondz.com. Un déploiement met donc à jour
 * l'application de tout le monde — c'est l'avantage — mais il la CASSE aussi pour tout le monde en
 * cas de faute, sans que le Play Store serve de filet. Ce qui se vérifiait au moment de compiler
 * doit désormais se vérifier à chaque déploiement.
 *
 * COMMENT ON SIMULE LA COQUE SANS TÉLÉPHONE. `@capacitor/core` reconnaît Android à la présence de
 * `window.androidBridge`, l'interface JavaScript que la WebView injecte avant les scripts de la
 * page. On la pose, et le site bascule dans son comportement d'application : portail d'entrée au
 * lieu de la page de présentation, position par le greffon natif, notifications natives.
 * Poser `window.Capacitor` ne suffirait pas — le bundle du site le remplace par le sien au
 * chargement, et l'on se croirait sur le web.
 *
 * CE QUE CELA NE PROUVE PAS : que l'application s'ouvre sur un vrai appareil. Les greffons natifs
 * ne répondent pas ici. C'est un contrôle du SITE vu par la coque, pas de la coque elle-même.
 */
import pw from 'playwright-core';

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const BASE = arg('--url', 'https://salondz.com').replace(/\/$/, '');

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
};

const navigateur = await pw.chromium.launch({ channel: 'chrome' });
const erreurs = [];
try {
  const ctx = await navigateur.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Africa/Algiers',
    // La WebView d'Android annonce « Version/4.0 » : c'est ce que verra le serveur.
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'androidBridge', { value: { postMessage: () => undefined }, configurable: true });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => erreurs.push(`exception : ${String(e).slice(0, 200)}`));

  const rempli = () => page.evaluate(() => (document.getElementById('root')?.innerHTML.length ?? 0) > 500);

  console.log(`\n1. La coque est reconnue (${BASE})`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  ok(await page.evaluate(() => window.Capacitor?.isNativePlatform?.() === true), 'le site se sait dans une application native');
  const chemin = new URL(page.url()).pathname;
  // Le site envoie un visiteur sur la page de présentation ; l'application, non : on vient de
  // l'installer, on n'a pas besoin qu'on nous la présente.
  ok(chemin === '/intro', `la racine mène au portail et non à la présentation (${chemin})`);
  ok(await rempli(), 'l’écran est rendu — c’est l’écran blanc du 25 sept. que ce contrôle surveille');

  console.log('\n2. Les écrans d’entrée répondent');
  await page.goto(`${BASE}/connexion?role=client`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  ok(await rempli(), 'l’écran de connexion est rendu');
  ok((await page.locator('form input').count()) >= 2, 'ses champs sont là');

  console.log('\n3. Une session s’ouvre et l’application se charge');
  await page.locator('input[type="email"]').first().fill('client@salondz.com');
  await page.locator('input[type="password"]').first().fill('client@salondz.com');
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  const apres = new URL(page.url()).pathname;
  ok(!/connexion|intro/.test(apres), `on a quitté l’entrée (${apres})`);
  ok(await rempli(), 'la place de marché est rendue');
  const barre = await page.locator('nav, .nvb').count();
  ok(barre > 0, 'la barre d’onglets est en place');

  console.log('\n4. La page de secours est servie');
  const horsLigne = await page.request.get(`${BASE}/hors-ligne.html`);
  ok(horsLigne.ok(), `/hors-ligne.html répond ${horsLigne.status()}`);
  ok((await horsLigne.text()).includes('Pas de connexion'), 'elle annonce la panne de réseau');

  console.log('\n5. Aucune erreur pendant le parcours');
  const uniques = [...new Set(erreurs)];
  ok(uniques.length === 0, uniques.length ? `${uniques.length} erreur(s) :\n      ${uniques.join('\n      ')}` : 'aucune erreur de console ni exception');
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  await navigateur.close();
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec — NE PAS laisser ce déploiement en ligne : il est l’application de tout le monde.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
