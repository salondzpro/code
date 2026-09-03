/**
 * Test de bout en bout de l'app web dans un vrai navigateur (Chromium headless via
 * playwright-core) contre l'API locale et le VRAI projet Supabase.
 *
 * Prérequis : `pnpm dev:api` (port 8787) et `pnpm dev:web` (port 5173) lancés.
 * Lancer   : `pnpm --filter @salondz/web test:e2e` (ajouter `--keep` pour conserver
 *            les utilisateurs/salon créés, sinon tout est supprimé à la fin).
 *
 * Navigateur : `PLAYWRIGHT_CHROME=<chemin chrome.exe>` sinon le canal Chrome installé.
 * Variables  : `WEB_URL` (défaut http://localhost:5173). Les clés Supabase viennent du
 *              `.env` racine (SUPABASE_SECRET_KEY : création/suppression des comptes jetables).
 *
 * Parcours couvert : accueil/recherche/404/redirections anonymes → pro (onboarding,
 * services, horaires, équipe, publication, réglages, tableau de bord, agenda + RDV de
 * passage) → client (recherche, page salon, réservation avec créneau, annulation, profil,
 * notifications, seconde réservation) → pro (agenda jour/semaine, terminé, demandes) →
 * client (avis visible sur la page publique).
 * Les captures vont dans `apps/web/test/shots/` (ignoré par git).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SHOTS = path.join(HERE, 'shots');
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const KEEP = process.argv.includes('--keep');

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

// ---- env ----
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const SUPABASE_URL = env.SUPABASE_URL;
const PUB = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !PUB || !SECRET) throw new Error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY manquants dans .env');

const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = Date.now().toString(36);
const PASSWORD = `Smoke-${RUN}-Aa1!`;

async function createUser(label, role, fullName) {
  const email = `smoke-${label}-${RUN}@salondz.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error(`login failed: ${JSON.stringify(session)}`);
  return { id: data.user.id, email, session };
}

// ---- dates (Africa/Algiers) ----
const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
const keyOf = (d) => fmtKey.format(d);
const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (key) => new Date(`${key}T12:00:00Z`).getUTCDay();
const today = keyOf(new Date());
let target = addDays(today, 1);
while (dow(target) === 5) target = addDays(target, 1); // vendredi fermé par défaut
const weekStart = (key) => addDays(key, -dow(key));
const targetDayNum = String(Number(target.slice(8, 10)));
console.log(`today=${today} target=${target} (dow ${dow(target)})`);

// ---- reporting ----
const report = { steps: [], consoleErrors: [], pageErrors: [], httpErrors: [], failed: [] };
function attach(page, who) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') report.consoleErrors.push({ who, type: m.type(), text: m.text().slice(0, 400), url: page.url() });
  });
  page.on('pageerror', (e) => report.pageErrors.push({ who, text: String(e).slice(0, 400), url: page.url() }));
  page.on('response', (r) => {
    if (r.status() >= 400) report.httpErrors.push({ who, status: r.status(), url: r.url(), page: page.url() });
  });
  page.on('requestfailed', (r) => {
    // ERR_ABORTED = requête annulée par une navigation, pas une erreur
    if (r.failure()?.errorText !== 'net::ERR_ABORTED') report.httpErrors.push({ who, status: 'FAILED', url: r.url(), err: r.failure()?.errorText, page: page.url() });
  });
  page.on('dialog', (d) => d.accept());
}
let n = 0;
const PAGES = {};
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: true });
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    report.steps.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✔ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    report.steps.push({ name, ok: false, ms: Date.now() - t, error: String(e).slice(0, 600) });
    report.failed.push(name);
    console.log(`✘ ${name}: ${String(e).split('\n')[0]}`);
    const pg = PAGES[name.split(':')[0]];
    if (pg) await pg.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-FAIL-${name.replace(/[^a-z0-9]+/gi, '_')}.png`), fullPage: true }).catch(() => undefined);
  }
}

// ---- main ----
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME, headless: true } : { channel: 'chrome', headless: true });
const users = {};
try {
  [users.pro, users.client] = await Promise.all([createUser('pro', 'pro', 'Karim Smoke'), createUser('client', 'client', 'Amine Smoke')]);
  console.log('users:', users.pro.email, users.client.email);

  const ctxOpts = { viewport: { width: 1280, height: 900 }, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' };
  const anon = await browser.newContext(ctxOpts);
  const proCtx = await browser.newContext(ctxOpts);
  const cliCtx = await browser.newContext(ctxOpts);
  for (const [ctx, u] of [
    [proCtx, users.pro],
    [cliCtx, users.client],
  ]) {
    // Session injectée dans le storage supabase-js (storageKey 'salondz-auth', cf. lib/supabase.ts)
    await ctx.addInitScript(
      ({ key, session }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
      },
      { key: 'salondz-auth', session: u.session },
    );
  }
  const a = await anon.newPage();
  const p = await proCtx.newPage();
  const c = await cliCtx.newPage();
  PAGES.anon = a;
  PAGES.pro = p;
  PAGES.client = c;
  attach(a, 'anon');
  attach(p, 'pro');
  attach(c, 'client');
  for (const pg of [a, p, c]) pg.setDefaultTimeout(25_000);

  const pickTargetDay = async (page) => {
    if (weekStart(target) !== weekStart(today)) await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await page.locator('button[role=option]:not([disabled])').filter({ has: page.locator('span.text-lg', { hasText: new RegExp(`^${targetDayNum}$`) }) }).click();
  };
  const slotButtons = (page) => page.locator('section', { has: page.getByRole('heading', { name: '2. Date et heure' }) }).locator('button[aria-pressed]');

  // ===== Anonyme =====
  await step('anon: accueil', async () => {
    await a.goto(WEB + '/');
    await a.getByRole('heading', { name: /Réservez votre coiffeur/ }).waitFor();
    await shot(a, 'anon-home');
  });
  await step('anon: recherche via formulaire accueil', async () => {
    await a.getByLabel('Recherche').fill('barbe');
    await a.getByLabel('Wilaya').selectOption('16');
    await a.getByRole('button', { name: 'Rechercher' }).click();
    await a.waitForURL(/\/recherche\?q=barbe&wilaya=16/);
    await a.getByRole('heading', { name: 'Salons' }).waitFor();
    await a.locator('text=Aucun salon trouvé').or(a.locator('ul li a.card')).first().waitFor();
    await shot(a, 'anon-search');
  });
  await step('anon: /compte redirige vers connexion', async () => {
    await a.goto(WEB + '/compte/reservations');
    await a.waitForURL(/\/connexion\?next=/);
    await a.getByRole('heading', { name: 'Connexion' }).waitFor();
    await shot(a, 'anon-login');
  });
  await step('anon: connexion pro (formulaire OTP visible)', async () => {
    await a.goto(WEB + '/connexion?role=pro');
    await a.getByRole('heading', { name: 'Espace professionnel' }).waitFor();
  });
  await step('anon: 404', async () => {
    await a.goto(WEB + '/nimporte-quoi');
    await a.locator('body').getByText(/introuvable|404/i).first().waitFor();
  });

  // ===== Pro =====
  let slug = '';
  await step('pro: /pro → onboarding', async () => {
    await p.goto(WEB + '/pro');
    await p.waitForURL(/\/pro\/onboarding/);
    await p.getByRole('heading', { name: 'Créer mon salon' }).waitFor();
    await shot(p, 'pro-onboarding');
  });
  await step('pro: onboarding validation (nom vide → erreur)', async () => {
    await p.getByRole('button', { name: 'Créer mon salon' }).click();
    await p.locator('p.text-danger').first().waitFor();
  });
  await step('pro: création du salon → redirigé vers services', async () => {
    await p.getByLabel('Nom du salon').fill(`Barber Smoke ${RUN}`);
    await p.getByLabel('Wilaya').selectOption('16');
    await p.getByLabel('Commune / quartier').fill('Hydra');
    await p.getByLabel('Adresse').fill('12 rue Didouche Mourad');
    await p.getByLabel('Téléphone du salon').fill('05 51 23 45 67');
    await p.getByRole('button', { name: 'Hommes', exact: true }).click();
    await p.getByRole('button', { name: 'Barbier', exact: true }).click();
    await p.getByRole('button', { name: 'Créer mon salon' }).click();
    await p.waitForURL(/\/pro\/services/);
    await p.getByRole('heading', { name: 'Services' }).waitFor();
    await shot(p, 'pro-services-empty');
  });
  await step('pro: ajout de 2 services', async () => {
    await p.getByRole('button', { name: '+ Ajouter' }).click();
    await p.getByLabel('Nom', { exact: false }).first().fill('Coupe + barbe');
    await p.getByLabel('Durée').selectOption('30');
    await p.getByLabel('Prix (DA)').fill('800');
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await p.getByText('Coupe + barbe').first().waitFor();
    await p.getByRole('button', { name: '+ Ajouter' }).click();
    await p.getByLabel('Nom', { exact: false }).first().fill('Coupe simple');
    await p.getByLabel('Durée').selectOption('20');
    await p.getByLabel('Prix (DA)').fill('500');
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await p.getByText('Coupe simple').first().waitFor();
    await shot(p, 'pro-services');
  });
  await step('pro: modifier un service (prix)', async () => {
    await p.locator('li', { hasText: 'Coupe simple' }).getByRole('button', { name: 'Modifier' }).click();
    await p.getByLabel('Prix (DA)').fill('600');
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await p.locator('li', { hasText: 'Coupe simple' }).getByText('600').waitFor();
  });
  await step('pro: horaires (enregistrer)', async () => {
    await p.goto(WEB + '/pro/horaires');
    await p.getByRole('heading', { name: "Horaires d'ouverture" }).waitFor();
    await p.locator('table tbody tr').nth(0).waitFor();
    const rows = await p.locator('table tbody tr').count();
    if (rows !== 7) throw new Error(`7 lignes attendues, ${rows}`);
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('Horaires enregistrés.').waitFor();
    await shot(p, 'pro-hours');
  });
  await step('pro: équipe (ajout membre)', async () => {
    await p.goto(WEB + '/pro/equipe');
    await p.getByLabel('Nouveau membre').fill('Yacine');
    await p.getByRole('button', { name: 'Ajouter' }).click();
    await p.locator('li', { hasText: 'Yacine' }).waitFor();
    await shot(p, 'pro-team');
  });
  await step('pro: publication', async () => {
    await p.goto(WEB + '/pro/salon');
    await p.getByRole('heading', { name: 'Mon salon' }).waitFor();
    slug = (await p.locator('code').first().innerText()).split('/s/')[1];
    await p.getByRole('button', { name: 'Publier' }).click();
    await p.getByRole('button', { name: 'Dépublier' }).waitFor();
    await shot(p, 'pro-salon-published');
  });
  await step('pro: modifier la description du salon', async () => {
    await p.getByLabel('Description').fill('Barber test smoke.');
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('Modifications enregistrées.').waitFor();
  });
  await step('pro: tableau de bord', async () => {
    await p.goto(WEB + '/pro');
    await p.getByRole('heading', { name: /Bonjour/ }).waitFor();
    await p.getByText("Aujourd'hui").waitFor();
    await shot(p, 'pro-dashboard');
  });
  await step('pro: agenda + RDV de passage', async () => {
    await p.goto(WEB + '/pro/agenda');
    await p.getByRole('heading', { name: 'Agenda' }).waitFor();
    await pickTargetDay(p);
    await p.getByRole('button', { name: '+ Rendez-vous' }).click();
    await p.getByRole('heading', { name: /Ajouter un rendez-vous/ }).waitFor();
    await p.getByLabel('Heure').fill('15:00');
    await p.getByLabel('Client').fill('Walid Passage');
    await p.getByLabel('Téléphone').fill('06 61 11 22 33');
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await p.getByText('Walid Passage').waitFor();
    await shot(p, 'pro-agenda-walkin');
  });

  // ===== Client =====
  await step('client: recherche → salon visible', async () => {
    await c.goto(WEB + '/recherche?wilaya=16&category=barbier');
    await c.locator('ul li a.card', { hasText: 'Barber Smoke' }).first().waitFor();
    await shot(c, 'client-search');
  });
  await step('client: page salon', async () => {
    await c.locator('ul li a.card', { hasText: 'Barber Smoke' }).first().click();
    await c.waitForURL(new RegExp(`/s/${slug}$`));
    await c.getByRole('heading', { name: /Barber Smoke/ }).waitFor();
    await c.getByText('Coupe + barbe').waitFor();
    await c.getByText('Fermé').first().waitFor(); // vendredi
    await shot(c, 'client-salon');
  });
  await step('client: réservation (le créneau du RDV de passage est exclu)', async () => {
    await c.getByRole('link', { name: 'Réserver' }).first().click();
    await c.waitForURL(new RegExp(`/s/${slug}/reserver`));
    await c.getByRole('radio', { name: /Coupe \+ barbe/ }).click();
    await c.getByRole('button', { name: 'Karim Smoke', exact: true }).click(); // même membre que le RDV de passage
    await c.getByRole('heading', { name: '2. Date et heure' }).waitFor();
    await pickTargetDay(c);
    const slots = slotButtons(c);
    await slots.first().waitFor();
    const texts = await slots.allInnerTexts();
    console.log(`  ${texts.length} créneaux`);
    if (texts.includes('15:00') || texts.includes('15:15')) throw new Error(`le créneau du RDV de passage est proposé : ${texts.join(',')}`);
    await slots.first().click();
    await c.getByRole('heading', { name: '3. Confirmation' }).waitFor();
    await shot(c, 'client-booking-step3');
    await c.getByLabel('Téléphone').fill('05 55 66 77 88');
    await c.getByLabel('Remarque (facultatif)').fill('Test smoke');
    await c.getByRole('button', { name: /Confirmer la réservation|Envoyer la demande/ }).click();
    await c.getByRole('heading', { name: /Réservation confirmée|Demande envoyée/ }).waitFor();
    await shot(c, 'client-booking-done');
  });
  await step('client: mes réservations + annulation', async () => {
    await c.getByRole('main').getByRole('link', { name: 'Mes réservations' }).click();
    await c.waitForURL(/\/compte\/reservations/);
    await c.locator('article', { hasText: 'Barber Smoke' }).waitFor();
    await shot(c, 'client-bookings');
    await c.locator('article', { hasText: 'Barber Smoke' }).getByRole('button', { name: 'Annuler' }).click();
    await c.locator('article', { hasText: 'Barber Smoke' }).waitFor({ state: 'detached' }).catch(() => undefined);
    await c.getByRole('tab', { name: 'Passées' }).click();
    await c.locator('article', { hasText: 'Barber Smoke' }).getByText(/Annul/).waitFor();
    await shot(c, 'client-bookings-past');
  });
  await step('client: profil (téléphone repris de la réservation)', async () => {
    await c.goto(WEB + '/compte');
    await c.getByRole('heading', { name: 'Mon compte' }).waitFor();
    const phone = await c.getByLabel('Téléphone').inputValue();
    if (!phone.includes('55')) throw new Error(`téléphone non repris depuis la réservation : "${phone}"`);
    await c.getByLabel('Nom complet').fill('Amine Smoke Modifié');
    await c.getByRole('button', { name: 'Enregistrer' }).click();
    await c.getByText('Profil enregistré.').waitFor();
    await shot(c, 'client-account');
  });
  await step('client: notifications', async () => {
    await c.goto(WEB + '/compte/notifications');
    await c.locator('main h1').first().waitFor();
    await shot(c, 'client-notifications');
  });
  await step('client: seconde réservation (pour l’agenda pro)', async () => {
    await c.goto(WEB + `/s/${slug}/reserver`);
    await c.getByRole('radio', { name: /Coupe simple/ }).click();
    await pickTargetDay(c);
    const slots = slotButtons(c);
    await slots.first().waitFor();
    await slots.nth(2).click();
    await c.getByRole('button', { name: /Confirmer la réservation|Envoyer la demande/ }).click();
    await c.getByRole('heading', { name: /Réservation confirmée|Demande envoyée/ }).waitFor();
  });

  // ===== Pro : agenda / demandes après réservation =====
  await step('pro: agenda montre la réservation client (jour + semaine)', async () => {
    await p.goto(WEB + '/pro/agenda');
    await p.getByRole('heading', { name: 'Agenda' }).waitFor();
    await pickTargetDay(p);
    await p.getByText('Amine Smoke').first().waitFor();
    await shot(p, 'pro-agenda-with-booking');
    await p.getByRole('button', { name: 'Semaine', exact: true }).click();
    await p.getByText('Amine Smoke').first().waitFor();
    await shot(p, 'pro-agenda-week');
  });
  await step('pro: marquer terminé', async () => {
    await p.getByRole('button', { name: 'Jour', exact: true }).click();
    const chip = p.locator('div.rounded-lg:not(.line-through)', { hasText: 'Amine Smoke' }).first();
    await chip.getByRole('button', { name: 'Terminé' }).click();
    await chip.getByRole('button', { name: 'Terminé' }).waitFor({ state: 'detached' });
    await p.locator('div.rounded-lg', { hasText: 'Amine Smoke' }).locator('span', { hasText: 'Terminé' }).first().waitFor();
  });
  await step('pro: demandes en attente (vide, auto-confirmation)', async () => {
    await p.goto(WEB + '/pro/reservations');
    await p.getByText('Tout est à jour').waitFor();
  });
  await step('pro: page publique', async () => {
    await p.goto(WEB + `/s/${slug}`);
    await p.getByRole('heading', { name: /Barber Smoke/ }).waitFor();
  });
  await step('client: laisser un avis, visible sur la page publique', async () => {
    await c.goto(WEB + '/compte/reservations');
    await c.getByRole('tab', { name: 'Passées' }).click();
    const art = c.locator('article', { hasText: 'Coupe simple' });
    await art.waitFor();
    await art.getByPlaceholder('Un mot sur votre visite ?').fill('Très bien');
    await art.getByRole('button', { name: 'Publier' }).click();
    await art.getByText('Merci pour votre avis !').waitFor();
    await c.goto(WEB + `/s/${slug}`);
    await c.getByText('Très bien').waitFor();
    await shot(c, 'client-salon-with-review');
  });

  await anon.close();
  await proCtx.close();
  await cliCtx.close();
} finally {
  await browser.close();
  if (!KEEP) {
    for (const u of Object.values(users)) if (u?.id) await admin.auth.admin.deleteUser(u.id).catch((e) => console.log('cleanup', e.message));
    console.log('cleanup done');
  } else console.log('KEEP: users', users.pro?.email, users.client?.email);
}

report.consoleErrors = report.consoleErrors.filter((e) => !/React DevTools/.test(e.text));
fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n=== RÉSUMÉ ===');
console.log(`étapes OK : ${report.steps.filter((s) => s.ok).length}/${report.steps.length}`);
console.log(`échecs : ${report.failed.join(' | ') || '-'}`);
console.log(`console errors/warnings : ${report.consoleErrors.length}`);
console.log(`page errors : ${report.pageErrors.length}`);
console.log(`HTTP ≥ 400 : ${report.httpErrors.length}`);
for (const h of report.httpErrors) console.log('  ', h.who, h.status, h.url);
const bad = report.failed.length || report.pageErrors.length || report.consoleErrors.length || report.httpErrors.length;
process.exit(bad ? 1 : 0);
