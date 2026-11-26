/**
 * IMAGES DE PARTAGE 1200 × 630 (26 nov. 2026, audit de lancement) : ce qu'affichent Facebook,
 * Instagram, WhatsApp et X quand on colle un lien de salondz.com. Avant, l'aperçu montrait la seule
 * icône 512 px (ou une image SVG que les réseaux refusent).
 *   node scripts/make-og-image.mjs   → apps/web/public/og/salondz.png (clientes) et og/pro.png (pros)
 * Charte (claude.css) : fond crème, encre brun foncé, titres Lora, logo « Salon DZ » en Inter ;
 * captures RÉELLES de l'application (`public/home/*.webp`, refaites par make-home-screens.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'public');
const u = (p) => pathToFileURL(path.join(PUB, p)).href;
fs.mkdirSync(path.join(PUB, 'og'), { recursive: true });

const page = (titre, sous, ecrans, pro) => `<!doctype html><html><head><style>
@font-face{font-family:Lora;src:url(${u('fonts/lora-400-600.woff2')});font-weight:400 600}
@font-face{font-family:Poppins;src:url(${u('fonts/poppins-500.woff2')});font-weight:500}
@font-face{font-family:Inter;src:url(${u('fonts/inter-600.woff2')});font-weight:600}
@font-face{font-family:Inter;src:url(${u('fonts/inter-400.woff2')});font-weight:400}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#faf9f5;font-family:Poppins;color:#2f2c28;overflow:hidden;position:relative}
.halo{position:absolute;border-radius:50%;filter:blur(70px)}
.g{position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;gap:26px}
.logo{font-family:Inter;font-size:40px;letter-spacing:-1px}
.logo b{font-weight:600}.logo i{font-style:normal;font-weight:400;color:#9a968c}
.pro{display:inline-block;margin-left:10px;font:600 15px Inter;letter-spacing:.5px;background:#2f2c28;color:#fff;border-radius:8px;padding:5px 9px;vertical-align:middle}
h1{font-family:Lora;font-weight:600;font-size:58px;line-height:1.08;letter-spacing:-1.2px}
p{font-size:24px;line-height:1.4;color:#6b675f}
.url{font-size:20px;color:#2f2c28;border:1.5px solid #e8e6dc;background:#fff;border-radius:999px;padding:10px 20px;align-self:flex-start}
.tel{position:absolute;width:250px;height:540px;border-radius:38px;background:#121214;padding:9px;box-shadow:0 30px 60px -20px rgba(47,44,40,.45)}
.tel img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:30px;display:block}
.t1{right:300px;top:70px;transform:rotate(-4deg)}
.t2{right:56px;top:40px;transform:rotate(3deg)}
</style></head><body>
<div class="halo" style="width:520px;height:520px;right:-60px;top:-80px;background:${pro ? 'rgba(106,155,204,.28)' : 'rgba(240,106,155,.22)'}"></div>
<div class="halo" style="width:420px;height:420px;right:260px;bottom:-200px;background:rgba(201,198,187,.45)"></div>
<div class="g">
  <div class="logo"><b>Salon</b> <i>DZ</i>${pro ? '<span class="pro">PRO</span>' : ''}</div>
  <h1>${titre}</h1>
  <p>${sous}</p>
  <span class="url">salondz.com${pro ? '/professionnels' : ''}</span>
</div>
<div class="tel t1"><img src="${u('home/' + ecrans[0])}"></div>
<div class="tel t2"><img src="${u('home/' + ecrans[1])}"></div>
</body></html>`;

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const [fichier, html] of [
  ['salondz.png', page('Votre salon, réservé en un instant.', 'Coiffeur, barbier, institut de beauté partout en Algérie. 24 h/24, sans appeler.', ['client-salon.webp', 'client-quand.webp'], false)],
  ['pro.png', page('Votre agenda se remplit tout seul.', 'Réservations en ligne, rappels et clientes fidèles. Gratuit pour commencer.', ['pro-agenda.webp', 'pro-accueil.webp'], true)],
]) {
  // Fichier réel : une page vide (setContent) n'a pas le droit de lire polices et captures en file://.
  const tmp = path.join(PUB, 'og', '.tmp.html');
  fs.writeFileSync(tmp, html);
  await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(PUB, 'og', fichier), type: 'png' });
  console.log('og/' + fichier);
}
fs.rmSync(path.join(PUB, 'og', '.tmp.html'), { force: true });
await b.close();
