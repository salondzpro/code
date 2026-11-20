/**
 * Notifications NAVIGATEUR de bout en bout, en PRODUCTION, pour le PROFESSIONNEL puis le CLIENT, avec
 * un VRAI abonnement Chrome et sans connexion de test :
 *
 *   node --env-file=.env scripts/check-webpush-roles.mjs
 *
 * 1. Chrome (fenêtre réelle : sans affichage, l'inscription FCM est jugée périmée) ouvre salondz.com,
 *    enregistre le service worker du site et s'abonne avec la clé VAPID publique de production.
 * 2. L'abonnement est inscrit au compte PRO jetable ; un client jetable réserve → la notification
 *    « nouvelle réservation » doit être ACCEPTÉE par le service push (`push_outcome = sent`) ET
 *    s'afficher dans le navigateur (`registration.getNotifications()`).
 * 3. Le même abonnement passe au compte CLIENT ; le pro confirme → « rendez-vous confirmé » doit
 *    arriver de la même façon.
 * Comptes et salon jetables (`@salondz.test`), supprimés dans un `finally`.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import pw from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const WEB = process.env.CHECK_WEB_URL ?? 'https://salondz.com';
const CHROME = process.env.PLAYWRIGHT_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, VAPID_PUBLIC_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY || !VAPID_PUBLIC_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY et VAPID_PUBLIC_KEY sont requis (--env-file=.env).');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const PASSWORD = `Check-${RUN}-Aa1!`;
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
};
const call = async (method, p, token, body) => {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: res.status, json, text };
};
const users = [];
async function account(label, role, fullName, phone) {
  const email = `check-wp-${label}-${RUN}@salondz.test`;
  const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: fullName } });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  users.push(id);
  await db.from('profiles').update({ full_name: fullName, role, ...(phone ? { phone } : {}) }).eq('id', id);
  const login = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  })).json();
  if (!login.access_token) throw new Error(`connexion ${label} impossible`);
  return { id, token: login.access_token };
}
const dayKey = () => {
  for (let k = 2; k < 9; k++) {
    const d = new Date(Date.now() + k * 86_400_000);
    if (new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Algiers', weekday: 'short' }).format(d) !== 'Fri')
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d);
  }
};
const outcome = async (uid, type) => {
  for (let i = 0; i < 15; i++) {
    const r = (await db.from('notifications').select('push_outcome, push_error').eq('user_id', uid).eq('type', type)).data ?? [];
    if (r[0]?.push_outcome) return r[0];
    await new Promise((res) => setTimeout(res, 1000));
  }
  return null;
};

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salondz-wp-'));
let ctx = null;
try {
  const day = dayKey();
  const pro = await account('pro', 'pro', 'Karim Navigateur');
  const client = await account('client', 'client', 'Amel Navigateur', '+213550990201');
  const salon = await call('POST', '/v1/pro/salon', pro.token, {
    name: `Web Push ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test', phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`salon : ${salon.status}`);
  const svc = await call('POST', '/v1/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  await db.from('salons').update({ is_published: true, auto_confirm: false }).eq('id', salon.json.id);

  console.log('\n1. Abonnement réel de Chrome sur salondz.com');
  ctx = await pw.chromium.launchPersistentContext(dir, { executablePath: CHROME, headless: false, args: ['--no-first-run'] });
  await ctx.grantPermissions(['notifications'], { origin: WEB });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${WEB}/home`, { waitUntil: 'load', timeout: 90_000 });
  const sub = await page.evaluate(async (key) => {
    const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4));
    const appKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    return JSON.stringify(s.toJSON());
  }, VAPID_PUBLIC_KEY);
  ok(sub.includes('"endpoint"'), `abonnement obtenu (${JSON.parse(sub).endpoint.slice(0, 40)}…)`);
  const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title));

  console.log('\n2. Navigateur du PROFESSIONNEL');
  const r1 = await call('POST', '/v1/me/push-tokens', pro.token, { token: sub, platform: 'web', deviceName: 'Chrome · Windows' });
  ok(r1.status === 204, `abonnement inscrit au compte pro (${r1.status})`);
  const bk = await call('POST', '/v1/bookings', client.token, { salonId: salon.json.id, serviceIds: [svc.json.id], startsAt: `${day}T10:00:00+01:00` });
  ok(bk.status === 201, `le client réserve (${bk.status})`);
  const o1 = await outcome(pro.id, 'booking_created');
  ok(o1?.push_outcome === 'sent', `notification du pro acceptée par le service push (${JSON.stringify(o1)})`);
  let t1 = [];
  for (let i = 0; i < 10 && !t1.length; i++) {
    await page.waitForTimeout(2000);
    t1 = await shown();
  }
  ok(t1.length > 0, `affichée dans le navigateur : « ${t1.join(' | ')} »`);

  console.log('\n3. Navigateur du CLIENT');
  const r2 = await call('POST', '/v1/me/push-tokens', client.token, { token: sub, platform: 'web', deviceName: 'Chrome · Windows' });
  ok(r2.status === 204, `le même navigateur passe au compte client (${r2.status})`);
  const conf = await call('POST', `/v1/pro/bookings/${bk.json?.id}/status`, pro.token, { status: 'confirmed' });
  ok(conf.status === 200, `le pro confirme (${conf.status})`);
  const o2 = await outcome(client.id, 'booking_confirmed');
  ok(o2?.push_outcome === 'sent', `notification du client acceptée par le service push (${JSON.stringify(o2)})`);
  let t2 = t1;
  for (let i = 0; i < 10 && t2.join() === t1.join(); i++) {
    await page.waitForTimeout(2000);
    t2 = await shown();
  }
  ok(t2.join() !== t1.join(), `affichée dans le navigateur (elle remplace celle du même rendez-vous) : « ${t2.join(' | ')} »`);
  await call('POST', `/v1/pro/bookings/${bk.json?.id}/cancel`, pro.token, { reason: 'Nettoyage' });
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  if (ctx) await ctx.close().catch(() => undefined);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const id of users.reverse()) await db.auth.admin.deleteUser(id).catch(() => undefined);
  console.log('\nNettoyage : navigateur fermé, comptes jetables supprimés.');
}
if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
