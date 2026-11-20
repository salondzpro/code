/**
 * UNE MÊME ADRESSE, DEUX COMPTES (pro et perso), chacun reconnu selon l'application — EN PRODUCTION :
 *
 *   node --env-file=.env scripts/check-same-email.mjs [https://site-à-tester]
 *
 * 1. Inscription CLIENTE par la vraie route (`/auth/signup`), puis inscription PRO avec la MÊME adresse
 *    (`/auth/signup`, rôle pro) : le compte pro vit sous l'adresse interne, le lien part à la vraie.
 * 2. `/auth/email-check` voit chaque compte de SON côté seulement.
 * 3. Séparation stricte côté serveur : le compte client est refusé par l'application Pro
 *    (`X-Salondz-App: pro` → 403 NO_PRO_ACCOUNT), le compte pro par l'application client (403
 *    NO_CLIENT_ACCOUNT), et chacun est refusé sur les routes de l'autre côté.
 * 4. Écrans d'accès (site donné en argument, par défaut salondz.com) : la même adresse ouvre l'espace
 *    PRO dans le portail pro et l'espace CLIENT dans le portail client ; le mot de passe de l'autre
 *    compte est refusé.
 * Comptes jetables (`@salondz.test`), supprimés dans un `finally`.
 */
import { createHash } from 'node:crypto';
import pw from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const WEB = process.argv[2] ?? 'https://salondz.com';
const CHROME = process.env.PLAYWRIGHT_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const EMAIL = `check-same-${RUN}@salondz.test`;
const PW_CLIENT = `Client-${RUN}-Aa1!`;
const PW_PRO = `Pro-${RUN}-Bb2!`;
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
};
const call = async (method, p, token, body, app) => {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(app ? { 'x-salondz-app': app } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: res.status, json, text };
};
const ALIAS = (role) => `${role}-${createHash('sha256').update(EMAIL).digest('hex').slice(0, 24)}@`;
const login = async (email, password) =>
  (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  })).json()).access_token ?? null;
const ids = [];

try {
  console.log(`adresse commune : ${EMAIL}`);
  console.log('\n1. Deux inscriptions avec la même adresse');
  const sc = await call('POST', '/v1/auth/signup', null, { email: EMAIL, password: PW_CLIENT, role: 'client', next: '/', fullName: 'Amel Double', gender: 'female', phone: '+213550990301' });
  ok(sc.status === 200 && sc.json?.opened && sc.json?.login === EMAIL, `compte client créé sous la vraie adresse (${sc.status} ${sc.text.slice(0, 80)})`);
  const sp = await call('POST', '/v1/auth/signup', null, { email: EMAIL, password: PW_PRO, role: 'pro', next: '/pro' });
  ok(sp.status === 204, `inscription pro acceptée avec la même adresse (${sp.status} ${sp.text.slice(0, 120)})`);
  const all = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users;
  const client = all.find((u) => u.email === EMAIL);
  const pro = all.find((u) => u.email?.startsWith(ALIAS('pro')));
  for (const u of [client, pro]) if (u) ids.push(u.id);
  ok(!!client && !!pro && client.id !== pro.id, 'deux comptes distincts : la vraie adresse (client) et l’adresse interne (pro)');
  ok(pro?.user_metadata?.contact_email === EMAIL, 'le compte pro garde la vraie adresse comme contact');
  // Le lien de confirmation part à la vraie adresse ; on le « clique » ici en confirmant le compte.
  if (pro) await db.auth.admin.updateUserById(pro.id, { email_confirm: true });

  console.log('\n2. Chaque portail voit SON compte');
  const ec = await call('POST', '/v1/auth/email-check', null, { email: EMAIL, role: 'client' });
  const ep = await call('POST', '/v1/auth/email-check', null, { email: EMAIL, role: 'pro' });
  ok(ec.json?.status === 'client', `portail client : « ${ec.json?.status} »`);
  ok(ep.json?.status === 'pro', `portail pro : « ${ep.json?.status} »`);

  console.log('\n3. Séparation stricte côté serveur');
  const tc = await login(EMAIL, PW_CLIENT);
  const tp = pro ? await login(pro.email, PW_PRO) : null;
  ok(!!tc && !!tp, 'chaque compte se connecte avec SON mot de passe');
  ok((await call('GET', '/v1/me', tc, undefined, 'client')).status === 200, 'compte client dans l’application client : accepté');
  const cp = await call('GET', '/v1/me', tc, undefined, 'pro');
  ok(cp.status === 403 && cp.text.includes('NO_PRO_ACCOUNT'), `compte client dans l’application Pro : refusé (${cp.status} NO_PRO_ACCOUNT)`);
  ok((await call('GET', '/v1/me', tp, undefined, 'pro')).status === 200, 'compte pro dans l’application Pro : accepté');
  const pc = await call('GET', '/v1/me', tp, undefined, 'client');
  ok(pc.status === 403 && pc.text.includes('NO_CLIENT_ACCOUNT'), `compte pro dans l’application client : refusé (${pc.status} NO_CLIENT_ACCOUNT)`);
  ok((await call('GET', '/v1/me/favorites', tp)).status === 403, 'compte pro sur une route cliente (site) : refusé');
  const sal = await call('GET', '/v1/pro/salon', tc);
  ok(sal.status === 403, `compte client sur une route pro (site) : refusé (${sal.status})`);
  ok((await login(EMAIL, PW_PRO)) === null, 'le mot de passe pro n’ouvre pas le compte client');

  console.log(`\n4. Écrans d’accès (${WEB})`);
  const b = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-web-security'] });
  const essai = async (portail, password) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    const page = await ctx.newPage();
    await page.goto(`${WEB}${portail}`, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForSelector('#pa-email-i', { timeout: 60_000 });
    await page.fill('#pa-email-i', EMAIL);
    await page.fill('#pa-mdp-i', password);
    await page.locator('.pl-auth button[type=submit]').click();
    await page.waitForTimeout(9000);
    const url = page.url();
    const erreur = await page.locator('[role=alert]').first().innerText().catch(() => '');
    await ctx.close();
    return { url, erreur };
  };
  const a1 = await essai('/pro/acces', PW_PRO);
  // Compte pro tout neuf : l'espace pro s'ouvre sur « Vos coordonnées » (nom) avant l'inscription du salon.
  const u1 = new URL(a1.url);
  ok(u1.pathname.startsWith('/pro') || (u1.pathname === '/profil/creer' && (u1.searchParams.get('next') ?? '').startsWith('/pro')), `portail pro + mot de passe pro → espace pro (${u1.pathname}${u1.search})`);
  const a2 = await essai('/acces', PW_CLIENT);
  ok(!new URL(a2.url).pathname.startsWith('/pro') && !new URL(a2.url).pathname.startsWith('/acces'), `portail client + mot de passe client → espace client (${new URL(a2.url).pathname})`);
  const a3 = await essai('/acces', PW_PRO);
  ok(new URL(a3.url).pathname.startsWith('/acces'), `portail client + mot de passe pro → refusé (« ${a3.erreur.slice(0, 70)} »)`);
  await b.close();
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  const all = (await db.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? [];
  for (const u of all.filter((u) => u.email === EMAIL || u.email?.startsWith(ALIAS('pro')) || u.email?.startsWith(ALIAS('client')))) ids.push(u.id);
  for (const id of [...new Set(ids)]) await db.auth.admin.deleteUser(id).catch(() => undefined);
  console.log('\nNettoyage : comptes jetables supprimés.');
}
if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
