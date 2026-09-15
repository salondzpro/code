/**
 * Vérifie EN PRODUCTION la chaîne complète des notifications navigateur :
 *
 *   réglage activé → service worker enregistré → abonnement créé → accepté par l'API
 *   → message poussé réellement livré au service du navigateur.
 *
 *   node --env-file=.env scripts/check-webpush.mjs
 *
 * Le dernier saut observable est le service de messagerie du navigateur (Google, Mozilla,
 * Apple) : s'il répond 201, le message est pris en charge pour livraison. Ce qui se passe
 * ensuite dépend de l'appareil, et aucun script ne peut l'observer de l'extérieur.
 *
 * DEUX PIÈGES, tous deux rencontrés, tous deux hors de notre code :
 *
 * 1. `browser.newContext()` ouvre l'équivalent d'une navigation privée, et Chrome y désactive
 *    l'API Push sans permettre de le détecter (crbug 41124656). D'où le profil PERSISTANT.
 * 2. En mode sans affichage, l'inscription obtenue auprès de FCM est jugée périmée
 *    immédiatement : l'envoi répond 410 alors que tout est correct. Il faut une fenêtre
 *    réelle pour valider le dernier saut :
 *
 *      CHECK_HEADLESS=0 pnpm check:webpush
 *
 *    Sans affichage, le script valide tout jusqu'à l'acceptation du jeton par l'API, et
 *    s'arrête sur ce 410 — ce n'est alors pas une régression.
 */
import pw from 'playwright-core';
import webpush from 'web-push';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const WEB = process.env.CHECK_WEB_URL ?? 'https://salondz.com';
const DEMO_CLIENT_PHONE = '0603044618';

const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
if (!pub || !priv) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents de .env');
webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contact@salondz.com', pub, priv);

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: res.status, json, text };
};
const r = await call('POST', '/auth/dev-login', undefined, { phone: DEMO_CLIENT_PHONE, code: '1111' });
const token = r.json?.accessToken ?? r.json?.access_token;
if (!token) throw new Error(`connexion : ${r.status}`);
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
const session = {
  access_token: token, refresh_token: '', token_type: 'bearer',
  expires_at: claims.exp, expires_in: claims.exp - Math.floor(Date.now() / 1000),
  user: { id: claims.sub, aud: 'authenticated', role: 'authenticated', email: claims.email, phone: claims.phone ?? '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};

/**
 * Profil PERSISTANT, et non un contexte ordinaire : `browser.newContext()` ouvre l'équivalent
 * d'une navigation privée, et Chrome y désactive l'API Push sans possibilité de la détecter
 * (crbug 41124656). L'abonnement échouait donc avec « permission denied » alors que le code
 * et la permission étaient bons.
 */
const profile = process.env.CHECK_PROFILE_DIR ?? `${process.env.TEMP ?? '.'}/salondz-webpush-profile`;
const ctx = await pw.chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  // Le mode sans affichage de Chrome obtient une inscription FCM que le service juge
  // aussitôt périmée : on laisse la possibilité de vérifier avec une fenêtre réelle.
  headless: process.env.CHECK_HEADLESS !== '0',
  viewport: { width: 412, height: 1000 },
  locale: 'fr-DZ',
  timezoneId: 'Africa/Algiers',
});
await ctx.grantPermissions(['notifications'], { origin: WEB });
await ctx.addInitScript(({ key, session }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session)); }, { key: 'salondz-auth', session });
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().includes('[push]')) console.log('  console:', m.text().slice(0, 220));
});
page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 220)));

let apiAccepted = null;
page.on('response', (res) => {
  if (res.url().includes('/me/push-tokens') && res.request().method() === 'POST') apiAccepted = res.status();
});

await page.goto(`${WEB}/reglages`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const toggle = page.getByLabel('Notifications sur cet appareil');
if (!(await toggle.isVisible().catch(() => false))) {
  console.log('Réglage introuvable : le navigateur ne déclare pas les notifications, ou la clé publique manque au build.');
  await ctx.close();
  process.exit(1);
}
await toggle.click();
await page.waitForTimeout(4000);

const diag = await page.evaluate(async () => {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const key = document.documentElement.getAttribute('data-vapid');
    return { registered: !!reg, scope: reg.scope, key };
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
});
console.log('enregistrement direct du service worker :', JSON.stringify(diag));

const sub = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const s = await reg?.pushManager.getSubscription();
  return s ? JSON.parse(JSON.stringify(s.toJSON())) : null;
});
console.log('service worker enregistré :', !!sub);
console.log('abonnement créé :', sub ? `${sub.endpoint.slice(0, 46)}…` : 'NON');
console.log('API a accepté le jeton :', apiAccepted ?? 'aucune requête observée');

if (!sub) {
  console.log('\nÉCHEC : aucun abonnement navigateur.');
  process.exit(1);
}

// Dernier saut observable : le service de messagerie du navigateur, navigateur OUVERT.
try {
  const res = await webpush.sendNotification(
    sub,
    JSON.stringify({ title: 'Salon DZ', body: 'Contrôle automatique des notifications.', data: {} }),
    { TTL: 60 },
  );
  console.log('service de messagerie du navigateur :', res.statusCode, '(201 = pris en charge)');
  const ok = res.statusCode >= 200 && res.statusCode < 300 && apiAccepted && apiAccepted < 300;
  console.log(ok ? '\nCHAÎNE COMPLÈTE VALIDÉE.' : '\nUn maillon a répondu autrement que prévu.');
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.log('\nÉCHEC de l\'envoi :', err?.statusCode ?? '', String(err?.body ?? err).slice(0, 200));
  process.exit(1);
}
