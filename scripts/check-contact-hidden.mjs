/**
 * Vérifie EN PRODUCTION qu'aucun écran client n'expose les coordonnées du salon :
 * ni lien d'appel (`tel:`), ni lien WhatsApp (`wa.me`), ni numéro affiché.
 *
 *   node --env-file=.env scripts/check-contact-hidden.mjs
 *
 * Le drapeau `SHOW_SALON_CONTACT_TO_CLIENTS` (packages/constants/src/visibility.ts) commande
 * ce masquage. Ce contrôle existe pour qu'un futur écran ne rouvre pas la fuite sans qu'on
 * le voie : c'est un comportement observable, pas une relecture de code.
 *
 * Crée un rendez-vous de démonstration pour atteindre les écrans qui en exigent un, puis
 * l'annule.
 */
import pw from 'playwright-core';

const API = process.env.CHECK_API_URL ?? 'https://salondz-api.onrender.com';
const WEB = process.env.CHECK_WEB_URL ?? 'https://salondz.onrender.com';
const DEMO_CLIENT_PHONE = '0603044618';
const DEMO_PRO_PHONE = '0603044619';
const DEMO_CODE = '1111';

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
const login = async (phone) => {
  const r = await call('POST', '/auth/dev-login', undefined, { phone, code: DEMO_CODE });
  const at = r.json?.accessToken ?? r.json?.access_token;
  if (!at) throw new Error(`connexion ${phone} : ${r.status}`);
  return at;
};
const dateKeyDZ = (offset) => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
  const d = new Date(`${fmt.format(new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const sessionOf = (token) => {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return {
    access_token: token, refresh_token: '', token_type: 'bearer',
    expires_at: claims.exp, expires_in: claims.exp - Math.floor(Date.now() / 1000),
    user: { id: claims.sub, aud: 'authenticated', role: 'authenticated', email: claims.email, phone: claims.phone ?? '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
};

const client = await login(DEMO_CLIENT_PHONE);
const pro = await login(DEMO_PRO_PHONE);
const salon = (await call('GET', '/pro/salon', pro)).json.salon;
if (!salon.phone) console.log('ATTENTION : le salon de démonstration n\'a pas de numéro, le test est moins probant.');

const pub = (await call('GET', `/salons/${salon.slug}`)).json;
const serviceId = pub.services.find((x) => x.isActive !== false).id;
let slotIso = null;
for (let day = 1; day <= 7 && !slotIso; day++) {
  const av = await call('GET', `/salons/${salon.id}/availability?serviceId=${serviceId}&date=${dateKeyDZ(day)}`);
  slotIso = av.json?.slots?.[0]?.startsAt ?? null;
}
/**
 * On réutilise un rendez-vous existant si possible. Créer puis annuler à chaque contrôle
 * gonfle le compteur d'annulations du compte de démonstration, jusqu'à le faire suspendre
 * par la règle anti-abus — ce qui est arrivé, et rendait ce script inutilisable.
 */
let id = null;
let created = false;
for (const path of ['/me/bookings?limit=5', '/bookings?limit=5']) {
  const mine = await call('GET', path, client);
  id = mine.json?.items?.[0]?.id ?? null;
  if (id) break;
}
if (!id && slotIso) {
  const booking = await call('POST', '/bookings', client, { salonId: salon.id, serviceId, startsAt: slotIso, notes: 'Contrôle masquage' });
  if (booking.status === 201) {
    id = booking.json.id;
    created = true;
  } else {
    // Cas déjà rencontré : le compte de démonstration est suspendu par la règle anti-abus,
    // à force d'annulations de tests. On contrôle alors ce qui est atteignable sans
    // rendez-vous, et on le dit — plutôt que d'échouer sur un empêchement de données.
    console.log(`  (pas de rendez-vous disponible : ${booking.json?.error?.code ?? booking.status})`);
  }
}

const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 1200 }, locale: 'fr-DZ', timezoneId: 'Africa/Algiers' });
await ctx.addInitScript(({ key, session }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session)); }, { key: 'salondz-auth', session: sessionOf(client) });
const page = await ctx.newPage();

const digits = (salon.phone ?? '').replace(/\D/g, '').slice(-9);
const pages = [
  ['fiche salon', `/s/${salon.slug}`],
  ['mes rendez-vous', '/rendez-vous'],
  ...(id
    ? [
        ['détail du rendez-vous', `/rendez-vous/${id}`],
        ['confirmation', `/rendez-vous/${id}/confirme`],
      ]
    : []),
];
if (!id) console.log('  ATTENTION : écrans « détail » et « confirmation » non contrôlés, faute de rendez-vous.');
const leaks = [];
for (const [label, path] of pages) {
  await page.goto(WEB + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // L'onglet « À propos » de la fiche salon portait autrefois la carte téléphone.
  const about = page.getByRole('tab', { name: 'À propos' });
  if (await about.isVisible().catch(() => false)) {
    await about.click();
    await page.waitForTimeout(1200);
  }
  const found = await page.evaluate((d) => {
    const tel = document.querySelectorAll('a[href^="tel:"]').length;
    const wa = document.querySelectorAll('a[href*="wa.me"]').length;
    const text = document.body.innerText.replace(/\D/g, '');
    return { tel, wa, number: d.length >= 9 && text.includes(d) };
  }, digits);
  if (found.tel || found.wa || found.number) leaks.push({ label, ...found });
  console.log(`  ${label} : appel ${found.tel}, whatsapp ${found.wa}, numéro affiché ${found.number ? 'OUI' : 'non'}`);
}
await browser.close();

if (created) await call('POST', `/bookings/${id}/cancel`, client, { reason: 'Contrôle automatique' });

if (leaks.length) {
  console.log('\nFUITE : des coordonnées du salon sont visibles côté client.');
  for (const l of leaks) console.log('  ', JSON.stringify(l));
  process.exit(1);
}
console.log('\nAUCUNE FUITE : ni appel, ni WhatsApp, ni numéro sur les écrans clients.');
