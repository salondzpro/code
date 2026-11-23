/**
 * PLANS « ÉCRAN » DES VIDÉOS UGC (23 nov. 2026) — filme les démonstrations de l'application sur
 * salondz.com avec les comptes de DÉMONSTRATION (monde 100 % navigateur : aucune vraie réservation),
 * au format téléphone vertical, pour le montage des vidéos du propriétaire (`/admin/marketing`).
 *
 *   node scripts/marketing-ecrans.mjs [dossier]   → <dossier>/<plan>.webm (Bureau/salondz-marketing/ecrans par défaut)
 *
 * Gestes lents et pauses voulues : une démonstration doit se suivre à l'œil, sans arrêt sur image.
 */
import pw from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = process.argv[2] ?? path.join(os.homedir(), 'Desktop', 'salondz-marketing', 'ecrans');
fs.mkdirSync(OUT, { recursive: true });
const B = 'https://salondz.com';
const TAILLE = { width: 390, height: 844 };
const b = await pw.chromium.launch({ channel: 'chrome' });

/** Un plan = un contexte qui filme, puis la vidéo renommée. */
async function plan(nom, base, email, scenario) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdz-'));
  const ctx = await b.newContext({ viewport: TAILLE, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Africa/Algiers', recordVideo: { dir: tmp, size: TAILLE } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('salondz:location:auto', 'alger');
    } catch {
      /* rien */
    }
  });
  const p = await ctx.newPage();
  // Connexion hors champ : on coupe ensuite le début au montage, mais on la fait vite.
  if (email) {
    await p.goto(B + base, { waitUntil: 'networkidle' });
    await p.fill('input[type=email]', email);
    await p.fill('input[type=password]', email);
    await p.locator('form button[type=submit]').first().click();
    await p.waitForTimeout(2500);
  }
  await p.addStyleTag({ content: 'body:has(.sheet.modal .lucide-bell-ring) .dim,.sheet.modal:has(.lucide-bell-ring){display:none!important}' }).catch(() => undefined);
  try {
    await scenario(p);
  } catch (e) {
    console.log(`  ⚠ ${nom} : ${e.message.split('\n')[0]}`);
  }
  await p.waitForTimeout(800);
  const v = p.video();
  await ctx.close();
  const src = await v.path();
  fs.copyFileSync(src, path.join(OUT, `${nom}.webm`));
  console.log(`✔ ${nom}.webm`);
}

const pause = (p, ms = 900) => p.waitForTimeout(ms);
const defiler = async (p, dy, pas = 6) => {
  for (let i = 0; i < pas; i++) {
    await p.mouse.wheel(0, dy / pas);
    await p.waitForTimeout(90);
  }
};

// 1. Une cliente réserve en 3 touchers (page d'un salon → prestation → heure → confirmer).
await plan('client-reserver', '/acces?next=%2Fsalons', 'client@salondz.com', async (p) => {
  await p.goto(B + '/salons', { waitUntil: 'networkidle' });
  await pause(p, 1500);
  // Côté femmes (la plupart des vidéos parlent aux clientes), puis un salon.
  await p.getByText('Voir Pour Femmes').first().click().catch(() => undefined);
  await pause(p, 1400);
  await defiler(p, 260);
  await pause(p);
  await p.goto(B + '/s/yasmine-beauty-studio', { waitUntil: 'networkidle' });
  await pause(p, 1400);
  await p.locator('.pl-cat-h').first().click();
  await pause(p);
  await p.locator('.pl-choisir').first().click();
  await p.waitForSelector('.pl-slot', { timeout: 30000 });
  await pause(p, 1300);
  await p.locator('.pl-slot').nth(2).click();
  await p.waitForTimeout(2500);
  await defiler(p, 400);
  await pause(p, 900);
  await p.getByRole('button', { name: /Confirmer/ }).last().click();
  await p.waitForTimeout(3500);
});

// 2. La place de marché : chercher, la carte, les créneaux du jour.
await plan('client-chercher', '', null, async (p) => {
  await p.goto(B + '/salons', { waitUntil: 'networkidle' });
  await pause(p, 1500);
  await defiler(p, 500, 10);
  await pause(p, 1200);
  await defiler(p, -500, 10);
  await p.getByRole('button', { name: /Carte/ }).first().click().catch(() => undefined);
  await p.waitForTimeout(3500);
});

// 3. Le pro : accueil, une demande acceptée, l'agenda par couleur.
await plan('pro-demandes-agenda', '/pro/acces', 'pro-femme@salondz.com', async (p) => {
  await p.goto(B + '/pro', { waitUntil: 'networkidle' });
  await pause(p, 1800);
  await p.goto(B + '/pro/reservations', { waitUntil: 'networkidle' });
  await pause(p, 1500);
  const ok = p.locator('button[aria-label*="Confirmer"], button[aria-label*="Accepter"]').first();
  if (await ok.count()) {
    await ok.click();
    await pause(p, 1500);
  }
  await p.goto(B + '/pro/agenda', { waitUntil: 'networkidle' });
  await pause(p, 1500);
  await p.evaluate(() => {
    const d = [...document.querySelectorAll('.pla-wk .ag9-d')];
    const on = d.findIndex((x) => x.classList.contains('on'));
    d[on + 1]?.click();
  });
  await pause(p, 1500);
  await defiler(p, 400, 10);
  await pause(p, 1500);
});

// 4. Les rappels : WhatsApp, SMS, appel, message déjà écrit.
await plan('pro-rappels', '/pro/acces', 'pro-femme@salondz.com', async (p) => {
  await p.goto(B + '/pro/rappels', { waitUntil: 'networkidle' });
  await pause(p, 2200);
  await p.getByRole('tab', { name: /Demain/ }).first().click().catch(() => undefined);
  await pause(p, 2200);
});

// 5. Les offres (Black Friday) côté pro.
await plan('pro-offres', '/pro/acces', 'pro-femme@salondz.com', async (p) => {
  await p.goto(B + '/pro/abonnement', { waitUntil: 'networkidle' });
  await pause(p, 1500);
  await defiler(p, 700, 14);
  await pause(p, 1500);
});

await b.close();
console.log(`\nPlans « Écran » dans ${OUT}`);
