/**
 * Vérifie EN PRODUCTION la pastille rouge des demandes à confirmer :
 *
 *   node --env-file=.env scripts/check-pending-badge.mjs
 *
 * 0 demande → aucune pastille ; 1 puis 2 → le compte suit SANS actualiser (temps réel) ;
 * une confirmation le fait baisser ; la pastille se voit depuis les autres écrans pro.
 *
 * Le salon de démonstration confirme automatiquement : le contrôle coupe la confirmation
 * automatique, et la REMET DANS TOUS LES CAS (bloc `finally`) — la laisser coupée
 * changerait le comportement du salon de démo pour de bon. Les rendez-vous de test sont
 * annulés PAR LE SALON : une annulation cliente compterait dans l'anti-abus.
 */
import pw from 'playwright-core';

const API = 'https://salondz-api.onrender.com';
const WEB = 'https://salondz.onrender.com';
const OUT = process.argv[2] ?? null;

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
  try {
    json = JSON.parse(text);
  } catch {
    /* pas du JSON */
  }
  return { status: res.status, json, text };
};
const login = async (phone) => {
  const r = await call('POST', '/auth/dev-login', undefined, { phone, code: '1111' });
  const t = r.json?.accessToken ?? r.json?.access_token;
  if (!t) throw new Error(`connexion ${phone} : ${r.status}`);
  return t;
};
const dateKey = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(Date.now() + d * 86400000));

const client = await login('0603044618');
const pro = await login('0603044619');
const salon = (await call('GET', '/pro/salon', pro)).json?.salon;
const serviceId = (await call('GET', `/salons/${salon.slug}`)).json?.services?.find((x) => x.isActive !== false)?.id;

// Session pro injectée dans le navigateur.
const c = JSON.parse(Buffer.from(pro.split('.')[1], 'base64url').toString('utf8'));
const session = {
  access_token: pro,
  refresh_token: '',
  token_type: 'bearer',
  expires_at: c.exp,
  expires_in: c.exp - Math.floor(Date.now() / 1000),
  user: {
    id: c.sub,
    aud: 'authenticated',
    role: 'authenticated',
    email: c.email,
    phone: c.phone ?? '',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

const b = await pw.chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-DZ',
  timezoneId: 'Africa/Algiers',
});
await ctx.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
  key: 'salondz-auth',
  session,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e).slice(0, 200)));
const readBadge = () =>
  page.evaluate(() => {
    const d = document.querySelector('.nvd');
    const item = [...document.querySelectorAll('.nvi')].find((n) => n.getAttribute('href') === '/pro/reservations');
    const cs = d ? getComputedStyle(d) : null;
    return {
      pastille: d ? d.textContent.trim() : 'aucune',
      couleur: cs ? cs.backgroundColor : '',
      libelle: item?.getAttribute('aria-label') ?? item?.getAttribute('title') ?? '',
    };
  });

/** Rendez-vous créés par le contrôle : annulés dans le `finally`, quoi qu'il arrive. */
const created = [];
let ok = false;
try {
  // Confirmation automatique coupée : sans cela le salon de démo n'a jamais de demande.
  const off = await call('PATCH', '/pro/salon', pro, { autoConfirm: false });
  console.log('confirmation automatique coupée :', off.status);
  const bookOne = async (day) => {
    let slot = null;
    for (let d = day; d <= day + 6 && !slot; d++) {
      const av = await call('GET', `/salons/${salon.id}/availability?serviceId=${serviceId}&date=${dateKey(d)}`);
      slot = av.json?.slots?.find((x) => !created.includes(x.startsAt))?.startsAt ?? null;
    }
    const r = await call('POST', '/bookings', client, {
      salonId: salon.id,
      serviceId,
      startsAt: slot,
      beneficiary: { fullName: 'Contrôle Pastille', phone: '0770000003' },
    });
    if (r.status !== 201) throw new Error(`réservation refusée : ${r.status} ${r.text.slice(0, 200)}`);
    created.push(r.json.id);
    return r.json;
  };

  await page.goto(`${WEB}/pro`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('aucune demande :', JSON.stringify(await readBadge()));
  if (OUT) await page.screenshot({ path: `${OUT}/bd0-sans.png` });

  const b1 = await bookOne(1);
  console.log('demande 1 créée, statut :', b1.status);
  // Sans actualiser : l'événement temps réel doit faire apparaître la pastille.
  await page.waitForTimeout(4000);
  console.log('une demande (sans actualiser) :', JSON.stringify(await readBadge()));
  if (OUT) await page.screenshot({ path: `${OUT}/bd1-une.png` });

  await bookOne(2);
  await page.waitForTimeout(4000);
  console.log('deux demandes :', JSON.stringify(await readBadge()));
  if (OUT) await page.screenshot({ path: `${OUT}/bd2-deux.png` });

  // Une confirmation doit faire baisser le compte.
  await call('POST', `/pro/bookings/${created[0]}/status`, pro, { status: 'confirmed' });
  await page.waitForTimeout(4000);
  console.log('après une confirmation :', JSON.stringify(await readBadge()));

  // La pastille suit aussi sur les autres écrans de l'espace pro.
  await page.goto(`${WEB}/pro/profil`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  console.log('depuis Profil :', JSON.stringify(await readBadge()));
  if (OUT) await page.screenshot({ path: `${OUT}/bd3-profil.png` });

  ok = true;
} finally {
  // TOUJOURS : sans cette remise en état, le salon de démonstration resterait en
  // confirmation manuelle et garderait des demandes de test.
  for (const id of created) await call('POST', `/pro/bookings/${id}/cancel`, pro, { reason: 'Contrôle' });
  const back = await call('PATCH', '/pro/salon', pro, { autoConfirm: true });
  console.log('confirmation automatique rétablie :', back.status);
  await b.close();
}
console.log(ok ? '\nPASTILLE VALIDÉE.' : '\nContrôle interrompu.');
process.exit(ok ? 0 : 1);
