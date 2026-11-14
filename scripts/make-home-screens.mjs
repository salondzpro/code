// Écrans de l'application montrés sur /home : capturés sur salondz.com (comptes de démonstration), en WebP.
// À relancer quand un de ces écrans change : node scripts/make-home-screens.mjs
import pw from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const B = 'https://salondz.com';
const OUT = fileURLToPath(new URL('../apps/web/public/home', import.meta.url));
const b = await pw.chromium.launch({ channel: 'chrome' });
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000); return p;
};
const conv = await (await b.newContext()).newPage();
const save = async (p, name) => {
  await p.waitForTimeout(1800);
  const png = await p.screenshot({ type: 'png' });
  const url = await conv.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 585; c.height = Math.round(img.height * 585 / img.width);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.84);
  }, png.toString('base64'));
  fs.writeFileSync(`${OUT}/${name}.webp`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(name, Math.round(fs.statSync(`${OUT}/${name}.webp`).size / 1024) + ' ko');
};
const login = async (p, base, email) => {
  await p.goto(B + base, { waitUntil: 'networkidle' });
  await p.fill('input[type=email]', email);
  await p.getByRole('button', { name: /Continuer/ }).click();
  await p.fill('input[type=password]', email);
  await p.getByRole('button', { name: /Se connecter/ }).first().click();
};
// client
let p = await mk();
await login(p, '/acces?next=%2F', 'client@salondz.com');
await p.waitForURL((u) => u.pathname === '/'); await p.waitForTimeout(2500);
await save(p, 'client-accueil');
const href = await p.evaluate(() => [...document.querySelectorAll('a[href^="/s/"]')].map((a) => a.getAttribute('href'))[0]);
await p.goto(B + href, { waitUntil: 'networkidle' }); await save(p, 'client-salon');
await p.goto(B + href + '/prestations', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Choisir/ }).first().click(); await p.waitForTimeout(1500);
await p.locator('button.slot, button[class*=slot]').first().click().catch(() => {});
await save(p, 'client-quand');
await p.goto(B + '/rendez-vous', { waitUntil: 'networkidle' }); await save(p, 'client-rdv');
// pro
p = await mk();
await login(p, '/pro/acces', 'pro-femme@salondz.com');
await p.waitForURL((u) => u.pathname.startsWith('/pro')); await p.waitForTimeout(3000);
await p.goto(B + '/pro', { waitUntil: 'networkidle' }); await save(p, 'pro-accueil');
await p.goto(B + '/pro/agenda', { waitUntil: 'networkidle' }); await save(p, 'pro-agenda');
await p.goto(B + '/pro/reservations', { waitUntil: 'networkidle' }); await save(p, 'pro-demandes');
await p.goto(B + '/pro/rappels', { waitUntil: 'networkidle' }); await save(p, 'pro-rappels');
await p.goto(B + '/pro/ma-page', { waitUntil: 'networkidle' }); await save(p, 'pro-mapage');
await p.goto(B + '/pro/clients', { waitUntil: 'networkidle' }); await save(p, 'pro-clients');
await b.close();
