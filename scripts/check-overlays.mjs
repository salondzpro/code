/**
 * CONTRÔLE DES SUPERPOSITIONS (18 nov. 2026, demande du propriétaire : « détecte-les automatiquement »).
 *
 * Parcourt les écrans pro et client de la PRODUCTION (comptes de démonstration, 390 × 844 et 390 × 667)
 * et signale :
 *   1. PAGE : le dernier élément du contenu caché derrière la barre d'action (`.sheet:not(.modal)`)
 *      ou la barre du bas (`.nvb`), une fois la page défilée tout en bas ;
 *   2. FENÊTRE : pour chaque ligne de réglage qui ouvre une fenêtre (`.lst-r` bouton), chaque bouton
 *      et champ de la fenêtre doit être le premier élément touché à son centre (rien par-dessus), après
 *      défilement de la fenêtre jusqu'à lui.
 *
 *   node scripts/check-overlays.mjs            (prod)   ·   SITE=http://localhost:9000 node …
 * Sortie : une ligne par défaut trouvé ; code de sortie 1 s'il y en a.
 */
import { chromium } from 'playwright-core';

const SITE = process.env.SITE ?? 'https://salondz.com';
const PAGES = {
  hommes: ['/pro', '/pro/parametres', '/pro/profil/fidelite', '/pro/promotions', '/pro/credits', '/pro/profil/versement', '/pro/profil/regles', '/pro/rendez-vous/nouveau', '/pro/clients', '/pro/salon', '/pro/compte'],
  clienthomme: ['/salons', '/s/karim-barber-club', '/profil', '/reglages', '/compte/informations', '/fidelite', '/rendez-vous'],
};

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : { channel: 'chrome' });
const problems = [];

/** Le dernier élément visible du contenu passe-t-il sous une barre fixe ? */
async function checkPage(page, path) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.sheet:not(.modal), .nvb')].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
    if (!bars.length) return null;
    const top = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
    const main = document.querySelector('.scr') ?? document.querySelector('main') ?? document.body;
    const items = [...main.querySelectorAll('button, a, input, .crd, .lst, p, h1, h2, h3')].filter((e) => {
      if (e.closest('.sheet, .nvb, .dim')) return false;
      const b = e.getBoundingClientRect();
      return b.height > 0 && b.width > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    const last = items.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    if (!last) return null;
    const bottom = last.getBoundingClientRect().bottom;
    return bottom > top + 1 ? { bottom: Math.round(bottom), top: Math.round(top), text: (last.textContent ?? '').trim().slice(0, 40) } : null;
  });
  if (r) problems.push(`PAGE ${page.viewportSize()?.height} ${path} : « ${r.text} » finit à ${r.bottom} px, sous la barre du bas (${r.top} px)`);
}

/** Chaque bouton et champ d'une fenêtre ouverte est-il touchable (rien par-dessus) ? */
async function checkModal(page, label) {
  const modal = page.locator('.sheet.modal').last();
  if (!(await modal.count())) return;
  const n = await modal.locator('button, input, textarea, a').count();
  for (let i = 0; i < n; i++) {
    const el = modal.locator('button, input, textarea, a').nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const ok = await el.evaluate((node) => {
      const b = node.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      if (y < 0 || y > window.innerHeight) return 'hors écran';
      const hit = document.elementFromPoint(x, y);
      return hit && (hit === node || node.contains(hit) || hit.closest('.sheet.modal') === node.closest('.sheet.modal')) ? true : `couvert par ${hit?.className || hit?.tagName}`;
    });
    if (ok !== true) problems.push(`FENÊTRE ${page.viewportSize()?.height} ${label} : « ${((await el.textContent()) ?? (await el.getAttribute('aria-label')) ?? '').trim().slice(0, 30)} » ${ok}`);
  }
}

// Deux hauteurs : un grand téléphone, et Safari barres visibles / petit iPhone (le défaut du 18 nov.
// n'apparaissait qu'en dessous de ~700 px de hauteur utile).
for (const height of [844, 667])
for (const [acct, paths] of Object.entries(PAGES)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript((k) => {
    localStorage.setItem('salondz:demo', k);
    localStorage.setItem('salondz:locale:choisie', '1');
    localStorage.setItem('salondz:push:off', '1');
  }, acct);
  const page = await ctx.newPage();
  for (const path of paths) {
    try {
      await page.goto(SITE + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      await page.getByRole('button', { name: 'Plus tard' }).click({ timeout: 800 }).catch(() => {});
      await checkPage(page, path);
      const rows = page.locator('button.lst-r');
      const count = Math.min(await rows.count(), 8);
      for (let i = 0; i < count; i++) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const row = rows.nth(i);
        if (!(await row.isVisible().catch(() => false))) continue;
        const label = `${path} › ${((await row.textContent()) ?? '').trim().slice(0, 30)}`;
        await row.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
        await checkModal(page, label);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(300);
        if (page.url() !== SITE + path) await page.goto(SITE + path, { waitUntil: 'networkidle' });
      }
      console.log(`✔ ${height} ${acct} ${path}`);
    } catch (err) {
      problems.push(`ERREUR ${path} : ${err.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} défaut(s) :`);
  for (const p of problems) console.log(`✖ ${p}`);
  process.exit(1);
}
console.log('\nAucune superposition détectée.');
