/**
 * Test de bout en bout de l'app MOBILE rendue par Expo web (react-native-web) dans Chromium
 * headless (playwright-core), contre l'API locale et le VRAI projet Supabase.
 *
 * Prérequis : `pnpm dev:api` (port 8787) et, depuis `apps/mobile` :
 *   CI=1 EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start --web --port 8082 --clear
 * (ajouter `http://localhost:8082` à `CORS_ORIGINS` du `.env`).
 * Lancer   : `pnpm --filter @salondz/mobile test:e2e` (`--keep` conserve les comptes créés).
 *
 * Navigateur : `PLAYWRIGHT_CHROME=<chemin chrome.exe>` sinon le canal Chrome installé.
 * Variables  : `MOBILE_WEB` (défaut http://localhost:8082), `API_URL` (défaut http://localhost:8787).
 *
 * Parcours : salon publié via l'API → cliente : prestations (2) → quand → coordonnées → récapitulatif →
 * confirmation → mes rendez-vous → pro : détail du rendez-vous → cliente : annulation.
 * Les sessions Supabase sont injectées dans `localStorage` (clé `sb-<ref>-auth-token`), comme le fait
 * l'app sur le web ; les écrans natifs (OTP, permissions) ne sont pas couverts ici.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');
const WEB = process.env.MOBILE_WEB ?? 'http://localhost:8082';
const API = process.env.API_URL ?? 'http://localhost:8787';
const KEEP = process.argv.includes('--keep');

fs.mkdirSync(SHOTS, { recursive: true });
for (const f of fs.readdirSync(SHOTS)) fs.rmSync(path.join(SHOTS, f), { force: true });

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: PUB, SUPABASE_SECRET_KEY: SECRET } = process.env;
if (!SUPABASE_URL || !PUB || !SECRET) throw new Error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY manquants (lancer via pnpm --filter @salondz/mobile test:e2e)');
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).host.split('.')[0]}-auth-token`;

const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = Date.now().toString(36);
const PASSWORD = `Smoke-${RUN}-Aa1!`;

async function createUser(label, role, fullName) {
  const email = `msmoke-${label}-${RUN}@salondz.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: fullName } });
  if (error) throw error;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error(`login failed: ${JSON.stringify(session)}`);
  return { id: data.user.id, email, session, token: session.access_token };
}

async function api(method, p, token, body) {
  const res = await fetch(`${API}/v1${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// ---- reporting ----
const report = { steps: [], consoleErrors: [], consoleWarnings: [], pageErrors: [], httpErrors: [], failed: [] };
function attach(page, who) {
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push({ who, text: m.text().slice(0, 400), url: page.url() });
    else if (m.type() === 'warning') report.consoleWarnings.push({ who, text: m.text().slice(0, 200), url: page.url() });
  });
  page.on('pageerror', (e) => report.pageErrors.push({ who, text: String(e).slice(0, 400), url: page.url() }));
  page.on('response', (r) => {
    if (r.status() >= 400) report.httpErrors.push({ who, status: r.status(), url: r.url(), page: page.url() });
  });
  page.on('dialog', (d) => d.accept());
}
let n = 0;
let current = null;
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`) });
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
    if (current) await current.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-FAIL-${name.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => undefined);
  }
}

const health = await fetch(`${API}/health`).catch(() => null);
if (!health?.ok) throw new Error(`API injoignable sur ${API} : lancer pnpm dev:api`);

// ---- main ----
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME, headless: true } : { channel: 'chrome', headless: true });
const users = {};
let bookingId = null;
try {
  [users.pro, users.client] = await Promise.all([createUser('pro', 'pro', 'Karim Mobile'), createUser('client', 'client', 'Inès Mobile')]);
  console.log('users:', users.pro.email, users.client.email);

  // Salon publié via l'API (l'onboarding pro est couvert par le test web).
  const salon = await api('POST', '/pro/salon', users.pro.token, {
    name: `Studio Mobile ${RUN}`,
    wilayaCode: 16,
    city: 'Hydra',
    address: '14 rue des Frères Bouadou',
    phone: '05 55 88 22 11',
    genderTarget: 'unisex',
    categoryIds: ['coiffure'],
    description: 'Salon de test du parcours mobile.',
  });
  await api('POST', '/pro/services', users.pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 900, categoryId: 'coiffure', isActive: true });
  await api('POST', '/pro/services', users.pro.token, { name: 'Barbe', durationMinutes: 20, priceDa: 500, categoryId: 'coiffure', isActive: true });
  await api('PUT', '/pro/salon/hours', users.pro.token, { hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opensAt: '09:00', closesAt: '19:00', isClosed: false })) });
  await api('PATCH', '/pro/salon', users.pro.token, { isPublished: true });
  // Marché choisi (sinon l'app renvoie vers « Que recherchez-vous ? ») et téléphone pré-rempli.
  await api('PATCH', '/me', users.client.token, { phone: '05 66 12 48 79', market: 'men' });
  console.log('salon:', salon.slug);

  const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-DZ', timezoneId: 'Africa/Algiers', isMobile: true, hasTouch: true };
  const withSession = async (session) => {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: STORAGE_KEY, session });
    return ctx;
  };

  const cliCtx = await withSession(users.client.session);
  const cli = await cliCtx.newPage();
  attach(cli, 'client');
  cli.setDefaultTimeout(25_000);
  current = cli;

  await step('client: prestations (2 sélectionnées)', async () => {
    // Premier chargement : Metro compile le bundle web (peut prendre plus d'une minute).
    await cli.goto(`${WEB}/s/${salon.slug}/prestations`, { waitUntil: 'load', timeout: 180_000 });
    await cli.getByRole('button', { name: /Coupe/ }).first().click({ timeout: 120_000 });
    await cli.getByRole('button', { name: /Barbe/ }).first().click();
    await cli.getByText(/2 prestations/).waitFor();
    await shot(cli, 'prestations');
    await cli.getByRole('button', { name: 'Choisir un créneau' }).click();
  });

  await step('client: quand (premier créneau libre)', async () => {
    await cli.getByText('Quand ?').waitFor();
    const free = cli.getByRole('button', { name: /^\d\d:\d\d$/, disabled: false });
    for (let tries = 0; tries < 3 && (await free.count()) === 0; tries++) {
      await cli.waitForTimeout(1500);
      if ((await free.count()) > 0) break;
      await cli.getByRole('button', { name: 'Semaine suivante' }).click();
      await cli.getByRole('button', { name: /^(Dim|Lun|Mar|Mer|Jeu|Ven|Sam) \d+$/, disabled: false }).first().click();
      await cli.waitForTimeout(1500);
    }
    await free.first().waitFor();
    await shot(cli, 'quand');
    await free.first().click();
    await cli.getByRole('button', { name: /^Continuer · / }).click();
  });

  await step('client: coordonnées', async () => {
    await cli.getByText('Vos coordonnées', { exact: true }).waitFor();
    await shot(cli, 'coordonnees');
    await cli.getByRole('button', { name: 'Vérifier' }).click();
  });

  await step('client: récapitulatif → confirmation', async () => {
    await cli.getByText('Récapitulatif').waitFor();
    // Les écrans précédents restent montés (pile de navigation) mais masqués : ne viser que le visible.
    await cli.getByText('Coupe', { exact: true }).locator('visible=true').first().waitFor();
    await cli.getByText('Barbe', { exact: true }).locator('visible=true').first().waitFor();
    await shot(cli, 'recap');
    await cli.getByRole('button', { name: 'Confirmer la réservation' }).click();
    await cli.waitForURL(/\/rdv\/[0-9a-f-]{36}\/confirme/, { timeout: 30_000 });
    bookingId = cli.url().match(/\/rdv\/([0-9a-f-]{36})\/confirme/)[1];
    await cli.waitForTimeout(1200);
    await shot(cli, 'confirme');
  });

  await step('API : la réservation existe (2 prestations, confirmée)', async () => {
    if (!bookingId) throw new Error('pas de réservation');
    const b = await api('GET', `/bookings/${bookingId}`, users.client.token);
    if (b.status !== 'confirmed') throw new Error(`statut ${b.status}`);
    if ((b.items?.length ?? 0) !== 2) throw new Error(`items ${b.items?.length}`);
    if (b.durationMinutes !== 50 || b.priceDa !== 1400) throw new Error(`durée/prix ${b.durationMinutes}/${b.priceDa}`);
  });

  await step('client: mes rendez-vous', async () => {
    await cli.goto(`${WEB}/rendez-vous`, { waitUntil: 'load' });
    await cli.getByText(salon.name).first().waitFor();
    await shot(cli, 'rendez-vous');
  });

  const proCtx = await withSession(users.pro.session);
  const pro = await proCtx.newPage();
  attach(pro, 'pro');
  pro.setDefaultTimeout(25_000);
  current = pro;

  await step('pro: détail du rendez-vous (cliente, actions)', async () => {
    await pro.goto(`${WEB}/pro-rdv/${bookingId}`, { waitUntil: 'load', timeout: 120_000 });
    // Le pro voit « Prénom I. » (vie privée de la cliente).
    await pro.getByText('Inès M.').first().waitFor({ timeout: 60_000 });
    await pro.getByRole('button', { name: 'Reporter' }).waitFor();
    await pro.getByRole('button', { name: 'Annuler', exact: true }).waitFor();
    await shot(pro, 'pro-rdv');
  });

  await step('pro: agenda', async () => {
    await pro.goto(`${WEB}/agenda`, { waitUntil: 'load' });
    await pro.getByText('Agenda').first().waitFor();
    await shot(pro, 'pro-agenda');
  });

  current = cli;
  await step('client: annulation (feuille + confirmation)', async () => {
    await cli.goto(`${WEB}/rdv/${bookingId}`, { waitUntil: 'load' });
    await cli.getByRole('button', { name: 'Annuler', exact: true }).click();
    await cli.getByText('Annuler ce rendez-vous ?').waitFor();
    await shot(cli, 'annuler-sheet');
    await cli.getByRole('button', { name: 'Annuler le rendez-vous' }).click();
    await cli.getByText('Rendez-vous annulé').waitFor();
    await shot(cli, 'annule');
    const b = await api('GET', `/bookings/${bookingId}`, users.client.token);
    if (b.status !== 'cancelled' || b.cancelledBy !== 'client') throw new Error(`statut ${b.status}/${b.cancelledBy}`);
  });

  await step('pro: notification d\'annulation', async () => {
    const notifs = await api('GET', '/me/notifications', users.pro.token);
    if (!notifs.items.some((x) => x.type === 'booking_cancelled' && x.bookingId === bookingId)) throw new Error('booking_cancelled absente');
  });

  await cliCtx.close();
  await proCtx.close();
} finally {
  await browser.close();
  if (!KEEP) {
    for (const u of Object.values(users)) if (u?.id) await admin.auth.admin.deleteUser(u.id).catch((e) => console.log('cleanup', e.message));
    console.log('cleanup done');
  } else console.log('KEEP: users', users.pro?.email, users.client?.email);
}

report.consoleErrors = report.consoleErrors.filter((e) => !/React DevTools|Download the React DevTools/.test(e.text));
fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n=== RÉSUMÉ (mobile / Expo web) ===');
console.log(`étapes OK : ${report.steps.filter((s) => s.ok).length}/${report.steps.length}`);
console.log(`échecs : ${report.failed.join(' | ') || '-'}`);
console.log(`console errors : ${report.consoleErrors.length} (warnings : ${report.consoleWarnings.length})`);
console.log(`page errors : ${report.pageErrors.length}`);
console.log(`HTTP ≥ 400 : ${report.httpErrors.length}`);
for (const h of report.httpErrors) console.log('  ', h.who, h.status, h.url);
for (const e of report.consoleErrors.slice(0, 5)) console.log('  console:', e.text.slice(0, 160));
const bad = report.failed.length || report.pageErrors.length || report.consoleErrors.length || report.httpErrors.length;
process.exit(bad ? 1 : 0);
