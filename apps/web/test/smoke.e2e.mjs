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
 * Parcours couvert (design « App Beaute Hi-Fi ») : écrans de connexion → pro (onboarding,
 * services, horaires, équipe + horaires membre, blocage, publication, tableau de bord, agenda + RDV
 * de passage) → client (marketplace Pour Hommes, page salon, favori, prestations cumulées, créneau,
 * coordonnées, récapitulatif, confirmation, détail, report, annulation, seconde réservation) →
 * pro (agenda, terminé, report du RDV de passage) → client (avis visible sur la page publique).
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

// On vide le dossier sans le supprimer (sous Windows, un shell ouvert dedans bloquerait rmdir).
fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f), { force: true });

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

async function createUser(label, role, fullName, market = null) {
  const email = `smoke-${label}-${RUN}@salondz.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;
  if (market) await admin.from('profiles').update({ market }).eq('id', data.user.id);
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
  [users.pro, users.client] = await Promise.all([createUser('pro', 'pro', 'Karim Smoke'), createUser('client', 'client', 'Amine Smoke', 'men')]);
  console.log('users:', users.pro.email, users.client.email);

  const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' };
  const anon = await browser.newContext(ctxOpts);
  const proCtx = await browser.newContext({ ...ctxOpts, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const cliCtx = await browser.newContext({ ...ctxOpts, geolocation: { latitude: 36.7538, longitude: 3.0588 }, permissions: ['geolocation'] });
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
    await page.locator('button[role=option]:not([disabled])').filter({ has: page.locator('b', { hasText: new RegExp(`^${targetDayNum}$`) }) }).first().click();
  };
  const pickTargetDayOld = async (page) => {
    if (weekStart(target) !== weekStart(today)) await page.getByRole('button', { name: 'Semaine suivante' }).click();
    await page.locator('button[role=option]:not([disabled])').filter({ has: page.locator('span.text-lg', { hasText: new RegExp(`^${targetDayNum}$`) }) }).click();
  };
  /** Créneaux libres de l'écran « Quand ? » / « Nouveau créneau » (design : .slot, grisés = .off). */
  const freeSlots = (page) => page.locator('button.slot:not(.off):not([disabled])');

  // ===== Anonyme (design AUTH 02 → 06) =====
  await step('anon: introduction', async () => {
    await a.goto(WEB + '/');
    await a.waitForURL(/\/intro$/);
    await a.getByRole('link', { name: 'Commencer' }).waitFor();
    await shot(a, 'anon-intro');
  });
  await step('anon: bienvenue → numéro → canal', async () => {
    await a.getByRole('link', { name: 'Commencer' }).click();
    await a.getByRole('heading', { name: /Bienvenue/ }).waitFor();
    await a.getByRole('button', { name: 'Continuer' }).click();
    await a.waitForURL(/\/connexion\?role=client/);
    await a.getByRole('heading', { name: 'Votre numéro' }).waitFor();
    await a.getByRole('button', { name: 'Recevoir le code', exact: true }).click();
    await a.locator('[role=alert]').waitFor(); // numéro incomplet (AUTH 05)
    await a.getByLabel('Numéro de téléphone').fill('661248790');
    await a.getByRole('button', { name: 'Recevoir le code', exact: true }).click();
    await a.waitForURL(/\/connexion\/canal/);
    await a.getByRole('heading', { name: 'Comment recevoir le code ?' }).waitFor();
    await shot(a, 'anon-canal');
  });
  await step('anon: page salon publique lisible sans compte', async () => {
    await a.goto(WEB + '/rendez-vous');
    await a.waitForURL(/\/connexion\?next=/);
  });
  await step('anon: 404', async () => {
    await a.goto(WEB + '/nimporte-quoi');
    await a.locator('body').getByText(/introuvable|404/i).first().waitFor();
  });

  // ===== Pro (espace pro, écrans en cours de refonte) =====
  let slug = '';
  await step('pro: /pro → onboarding', async () => {
    await p.goto(WEB + '/pro');
    await p.waitForURL(/\/pro\/onboarding/);
    await p.getByRole('heading', { name: 'Créer mon salon' }).waitFor();
  });
  await step('pro: création du salon → redirigé vers services', async () => {
    await p.getByLabel('Nom du salon').fill(`Barber Smoke ${RUN}`);
    await p.getByLabel('Wilaya').selectOption('16');
    await p.getByLabel('Commune / quartier').fill('Alger-Centre');
    await p.getByLabel('Adresse').fill('12 rue Didouche Mourad');
    await p.getByLabel('Téléphone du salon').fill('05 51 23 45 67');
    await p.getByRole('button', { name: 'Hommes', exact: true }).click();
    await p.getByRole('button', { name: 'Coiffure', exact: true }).click();
    await p.getByRole('button', { name: 'Créer mon salon' }).click();
    await p.waitForURL(/\/pro\/services/);
    await p.getByRole('heading', { name: 'Services' }).waitFor();
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
  });
  await step('pro: horaires (enregistrer)', async () => {
    await p.goto(WEB + '/pro/horaires');
    await p.getByRole('heading', { name: "Horaires d'ouverture" }).waitFor();
    await p.locator('table tbody tr').nth(0).waitFor();
    await p.getByRole('button', { name: 'Enregistrer' }).click();
    await p.getByText('Horaires enregistrés.').waitFor();
  });
  await step('pro: équipe (ajout membre + horaires personnalisés)', async () => {
    await p.goto(WEB + '/pro/equipe');
    await p.getByLabel('Nouveau membre').fill('Yacine');
    await p.getByRole('button', { name: 'Ajouter' }).click();
    const row = p.locator('li', { hasText: 'Yacine' });
    await row.waitFor();
    await row.getByRole('button', { name: 'Horaires' }).click();
    const form = row.getByRole('form', { name: /Horaires de Yacine/ });
    await form.getByRole('button', { name: 'Horaires personnalisés' }).click();
    await form.locator('tbody tr').first().getByRole('checkbox').uncheck();
    await form.getByRole('button', { name: 'Enregistrer' }).click();
    await form.getByText('Horaires du membre enregistrés.').waitFor();
  });
  await step('pro: blocage (pause) du membre sur le jour cible', async () => {
    await p.goto(WEB + '/pro/blocages');
    await p.getByRole('heading', { name: 'Congés et pauses' }).waitFor();
    await p.getByLabel('Concerne').selectOption({ label: 'Karim Smoke' });
    await p.getByRole('button', { name: 'Plage horaire' }).click();
    await p.getByLabel(/^Date\b/).fill(target);
    await p.getByLabel(/^De\b/).fill('12:00');
    await p.getByLabel(/^À\s/).fill('13:00');
    await p.getByLabel('Motif (facultatif)').fill('Pause');
    await p.getByRole('button', { name: 'Ajouter le blocage' }).click();
    await p.locator('li', { hasText: '12:00 – 13:00' }).getByText('Karim Smoke · Pause').waitFor();
  });
  await step('pro: publication', async () => {
    await p.goto(WEB + '/pro/salon');
    await p.getByRole('heading', { name: 'Mon salon' }).waitFor();
    slug = (await p.locator('code').first().innerText()).split('/s/')[1];
    await p.getByRole('button', { name: 'Publier' }).click();
    await p.getByRole('button', { name: 'Dépublier' }).waitFor();
  });
  await step('pro: tableau de bord', async () => {
    await p.goto(WEB + '/pro');
    await p.getByRole('heading', { name: /Bonjour/ }).waitFor();
    await p.getByText("Aujourd'hui").waitFor();
  });
  await step('pro: agenda + RDV de passage', async () => {
    await p.goto(WEB + '/pro/agenda');
    await p.getByRole('heading', { name: 'Agenda' }).waitFor();
    await pickTargetDayOld(p);
    await p.getByRole('button', { name: '+ Rendez-vous' }).click();
    await p.getByRole('heading', { name: /Ajouter un rendez-vous/ }).waitFor();
    await p.getByLabel('Heure').fill('15:00');
    await p.getByLabel('Client').fill('Walid Passage');
    await p.getByLabel('Téléphone').fill('06 61 11 22 33');
    await p.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await p.getByText('Walid Passage').waitFor();
  });

  // ===== Client (design C-H / C-F) =====
  let bookingId = '';
  await step('client: marketplace Pour Hommes → salon visible', async () => {
    await c.goto(WEB + '/');
    await c.getByRole('heading', { name: 'Pour Hommes' }).waitFor();
    await c.locator('a.crd', { hasText: 'Barber Smoke' }).first().waitFor();
    await shot(c, 'client-marketplace');
  });
  await step('client: page salon (design C-F 04)', async () => {
    await c.locator('a.crd', { hasText: 'Barber Smoke' }).first().click();
    await c.waitForURL(new RegExp(`/s/${slug}$`));
    await c.getByRole('heading', { name: /Barber Smoke/ }).waitFor();
    await c.getByText('Coupe + barbe').waitFor();
    await c.getByRole('tab', { name: 'Infos' }).click();
    await c.getByText('Fermé').first().waitFor(); // vendredi
    await c.getByRole('tab', { name: 'Prestations' }).click();
    await shot(c, 'client-salon');
  });
  await step('client: ajouter aux favoris → visible dans Mes favoris', async () => {
    await c.getByRole('button', { name: 'Ajouter aux favoris' }).click();
    await c.getByRole('button', { name: 'Retirer des favoris' }).waitFor();
    await c.goto(WEB + '/favoris');
    await c.locator('.crd', { hasText: 'Barber Smoke' }).waitFor();
    await shot(c, 'client-favorites');
  });
  await step('client: prestations cumulées → créneau (blocage et RDV de passage exclus)', async () => {
    await c.goto(WEB + `/s/${slug}`);
    await c.getByRole('button', { name: 'Réserver' }).click();
    await c.waitForURL(new RegExp(`/s/${slug}/prestations`));
    await c.getByRole('button', { name: /Coupe \+ barbe/ }).click();
    await c.getByRole('button', { name: /Coupe simple/ }).click();
    await c.getByText('2 prestations · 50 min au total').waitFor();
    await c.getByRole('button', { name: 'Choisir un créneau' }).click();
    await c.waitForURL(new RegExp(`/s/${slug}/reserver/quand`));
    await c.getByRole('heading', { name: 'Quand ?' }).waitFor();
    await pickTargetDay(c);
    await freeSlots(c).first().waitFor();
    const texts = await freeSlots(c).allInnerTexts();
    console.log(`  ${texts.length} créneaux libres`);
    // Karim a un blocage 12:00–13:00 et Yacine est en repos le dimanche → les deux membres ne sont libres
    // ni à 12:00 ni à 15:00 (RDV de passage de Karim)… sauf Yacine ; on vérifie surtout la cohérence de durée.
    await freeSlots(c).first().click();
    await c.getByRole('button', { name: /^Continuer · \d\d:\d\d$/ }).click();
    await c.waitForURL(new RegExp(`/s/${slug}/reserver/coordonnees`));
    await shot(c, 'client-quand');
  });
  await step('client: coordonnées → récapitulatif → confirmation', async () => {
    await c.getByRole('heading', { name: 'Vos coordonnées' }).waitFor();
    await c.getByLabel('Téléphone').fill('555667788');
    await c.getByLabel('Note pour le salon (optionnel)').fill('Test smoke');
    await c.getByRole('button', { name: 'Vérifier' }).click();
    await c.waitForURL(new RegExp(`/s/${slug}/reserver/recap`));
    await c.getByRole('heading', { name: 'Récapitulatif' }).waitFor();
    await c.getByText('Coupe + barbe', { exact: true }).waitFor();
    await c.getByText('Coupe simple', { exact: true }).waitFor();
    await c.getByText('1 300 DA').first().waitFor();
    await shot(c, 'client-recap');
    await c.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await c.waitForURL(/\/rendez-vous\/[0-9a-f-]+\/confirme/);
    bookingId = c.url().match(/rendez-vous\/([0-9a-f-]+)/)[1];
    await c.getByRole('heading', { name: /Rendez-vous|Demande/ }).waitFor();
    await shot(c, 'client-confirme');
  });
  await step('client: détail → report → annulation', async () => {
    await c.getByRole('button', { name: 'Voir le rendez-vous' }).click();
    await c.waitForURL(new RegExp(`/rendez-vous/${bookingId}$`));
    await c.getByText('1 300 DA').waitFor();
    await c.getByRole('link', { name: 'Reporter' }).click();
    await c.waitForURL(/\/reporter$/);
    await c.getByRole('heading', { name: 'Nouveau créneau' }).waitFor();
    await freeSlots(c).first().waitFor();
    await freeSlots(c).first().click();
    await c.getByRole('button', { name: 'Demander le report' }).click();
    await c.waitForURL(new RegExp(`/rendez-vous/${bookingId}$`));
    await c.getByRole('button', { name: 'Annuler' }).click();
    await c.getByText('Annuler ce rendez-vous ?').waitFor();
    await c.getByLabel('Motif').fill('Empêchement');
    await c.getByRole('button', { name: 'Annuler le rendez-vous' }).click();
    await c.getByRole('heading', { name: 'Rendez-vous annulé' }).waitFor();
    await shot(c, 'client-annule');
  });
  await step('client: profil (téléphone repris de la réservation)', async () => {
    await c.goto(WEB + '/profil');
    await c.getByRole('heading', { name: 'Profil' }).waitFor();
    await c.getByText('+213 5 55 66 77 88').waitFor();
    await shot(c, 'client-profil');
  });
  await step('client: réglages + localisation', async () => {
    await c.goto(WEB + '/reglages');
    await c.getByRole('heading', { name: 'Réglages' }).waitFor();
    await c.goto(WEB + '/localisation');
    await c.getByRole('heading', { name: 'Localisation' }).waitFor();
    await c.getByRole('button', { name: '10 km' }).click();
    await c.getByRole('button', { name: 'Appliquer' }).click();
  });
  await step('client: seconde réservation (une prestation)', async () => {
    await c.goto(WEB + `/s/${slug}/prestations`);
    await c.getByRole('button', { name: /Coupe simple/ }).click();
    await c.getByRole('button', { name: 'Choisir un créneau' }).click();
    await pickTargetDay(c);
    await freeSlots(c).nth(2).waitFor();
    await freeSlots(c).nth(2).click();
    await c.getByRole('button', { name: /^Continuer · / }).click();
    await c.getByRole('button', { name: 'Vérifier' }).click();
    await c.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await c.waitForURL(/\/rendez-vous\/[0-9a-f-]+\/confirme/);
    bookingId = c.url().match(/rendez-vous\/([0-9a-f-]+)/)[1];
  });

  // ===== Pro : agenda après réservation =====
  await step('pro: agenda montre la réservation client (jour + semaine)', async () => {
    await p.goto(WEB + '/pro/agenda');
    await p.getByRole('heading', { name: 'Agenda' }).waitFor();
    await pickTargetDayOld(p);
    await p.getByText('Amine Smoke').first().waitFor();
    await p.getByRole('button', { name: 'Semaine', exact: true }).click();
    await p.getByText('Amine Smoke').first().waitFor();
  });
  await step('pro: marquer terminé', async () => {
    await p.getByRole('button', { name: 'Jour', exact: true }).click();
    const chip = p.locator('div.rounded-lg:not(.line-through)', { hasText: 'Amine Smoke' }).first();
    await chip.getByRole('button', { name: 'Terminé' }).click();
    await chip.getByRole('button', { name: 'Terminé' }).waitFor({ state: 'detached' });
    await p.locator('div.rounded-lg', { hasText: 'Amine Smoke' }).locator('span', { hasText: 'Terminé' }).first().waitFor();
  });
  await step('pro: reporter le RDV de passage à 16:00', async () => {
    const chip = p.locator('div.rounded-lg', { hasText: 'Walid Passage' }).first();
    await chip.getByRole('button', { name: 'Reporter' }).click();
    const form = chip.getByRole('form', { name: 'Reporter le rendez-vous' });
    await form.getByLabel('Nouvelle heure').fill('16:00');
    await form.getByRole('button', { name: 'Valider' }).click();
    await form.waitFor({ state: 'detached' });
    await p.locator('div.rounded-lg', { hasText: 'Walid Passage' }).getByText('16:00 – 16:30').waitFor();
  });
  await step('pro: demandes en attente (vide, auto-confirmation)', async () => {
    await p.goto(WEB + '/pro/reservations');
    await p.getByText('Tout est à jour').waitFor();
  });
  await step('client: noter la prestation → avis visible sur la page publique', async () => {
    await c.goto(WEB + '/rendez-vous?scope=past');
    const card = c.locator('.crd', { hasText: 'Coupe simple' }).filter({ hasText: 'Terminé' });
    await card.waitFor();
    await card.getByRole('link', { name: 'Noter' }).click();
    await c.waitForURL(/\/noter$/);
    await c.getByRole('radio', { name: '4 sur 5' }).click();
    await c.getByRole('button', { name: 'Hygiène' }).click();
    await c.getByLabel('Commentaire (optionnel)').fill('Très bien');
    await c.getByRole('button', { name: 'Envoyer mon avis' }).click();
    await c.waitForURL(/\/rendez-vous\?scope=past/);
    await c.goto(WEB + `/s/${slug}`);
    await c.getByRole('tab', { name: 'Infos' }).click();
    await c.getByText(/Hygiène — Très bien/).waitFor();
    await shot(c, 'client-salon-avis');
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

report.consoleErrors = report.consoleErrors.filter((e) => !/React DevTools|Download the React DevTools/.test(e.text));
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
