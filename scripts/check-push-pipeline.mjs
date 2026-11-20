/**
 * Vérifie EN PRODUCTION la chaîne des notifications poussées, pour le CLIENT et le PROFESSIONNEL,
 * sur les trois canaux (application Android = Firebase, application iPhone = Apple, navigateur) :
 *
 *   node --env-file=.env scripts/check-push-pipeline.mjs
 *
 * Sans téléphone : chaque compte jetable reçoit un FAUX appareil de chaque sorte, inscrit par la vraie
 * route (`POST /v1/me/push-tokens`) avec la bonne application (`dz.salondz.app` / `pro.salondz.app`).
 * Un vrai événement (réservation en ligne → le pro ; confirmation → le client) déclenche l'envoi. Si le
 * serveur a bien contacté Google, Apple et le service push du navigateur, avec les bonnes clés et le
 * bon `apns-topic`, chacun répond « appareil inconnu » et le serveur RETIRE le faux appareil. Un faux
 * appareil resté en base = un canal qui n'a pas été tenté (ou une clé refusée).
 *
 * Vérifie aussi la séparation des applications : un appareil de l'application Pro est refusé sur un
 * compte client, et l'inverse. Comptes et salon jetables (`@salondz.test`), supprimés dans un `finally`.
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SECRET_KEY et SUPABASE_PUBLISHABLE_KEY sont requis (--env-file=.env).');
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
const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
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
  const email = `check-push-${label}-${RUN}@salondz.test`;
  const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: fullName } });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  users.push(id);
  const up = await db.from('profiles').update({ full_name: fullName, role, ...(phone ? { phone } : {}) }).eq('id', id);
  if (up.error) throw up.error;
  const login = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  })).json();
  if (!login.access_token) throw new Error(`connexion ${label} impossible`);
  return { id, token: login.access_token };
}
/** Faux appareils, un de chaque sorte, à la forme exacte des vrais. */
const fakeFcm = () => `${crypto.randomBytes(8).toString('base64url')}:APA91b${crypto.randomBytes(100).toString('base64url')}`;
const fakeApns = () => crypto.randomBytes(32).toString('hex');
const fakeWeb = () => {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return JSON.stringify({
    endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomBytes(12).toString('base64url')}:APA91b${crypto.randomBytes(60).toString('base64url')}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
  });
};
const dayKey = () => {
  for (let k = 2; k < 9; k++) {
    const d = new Date(Date.now() + k * 86_400_000);
    if (new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Algiers', weekday: 'short' }).format(d) !== 'Fri')
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d);
  }
};
const settle = () => new Promise((r) => setTimeout(r, 8000));
const remaining = async (uid) => (await db.from('push_tokens').select('token, platform, app_id').eq('user_id', uid)).data ?? [];

try {
  const day = dayKey();
  const pro = await account('pro', 'pro', 'Karim Push');
  const client = await account('client', 'client', 'Amel Push', '+213550990101');
  const salon = await call('POST', '/v1/pro/salon', pro.token, {
    name: `Push Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test', phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const svc = await call('POST', '/v1/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  if (!svc.json?.id) throw new Error(`prestation : ${svc.status}`);
  await db.from('salons').update({ is_published: true, auto_confirm: false }).eq('id', salon.json.id);

  console.log('\n1. Séparation des applications à l\'inscription d\'un appareil');
  const crossPro = await call('POST', '/v1/me/push-tokens', pro.token, { token: fakeFcm(), platform: 'android', appId: 'dz.salondz.app' });
  ok(crossPro.status === 403, `appareil de l'application CLIENT sur un compte pro : refusé (${crossPro.status})`);
  const crossClient = await call('POST', '/v1/me/push-tokens', client.token, { token: fakeApns(), platform: 'ios', appId: 'pro.salondz.app' });
  ok(crossClient.status === 403, `appareil de l'application PRO sur un compte client : refusé (${crossClient.status})`);

  console.log('\n2. Inscription des appareils (Android, iPhone, navigateur)');
  const reg = async (who, appId) => {
    const r = [
      await call('POST', '/v1/me/push-tokens', who.token, { token: fakeFcm(), platform: 'android', appId, deviceName: 'Application Android' }),
      await call('POST', '/v1/me/push-tokens', who.token, { token: fakeApns(), platform: 'ios', appId, deviceName: 'Application iPhone' }),
      await call('POST', '/v1/me/push-tokens', who.token, { token: fakeWeb(), platform: 'web', deviceName: 'Chrome · Windows' }),
    ];
    return r.map((x) => x.status);
  };
  const rp = await reg(pro, 'pro.salondz.app');
  ok(rp.every((s) => s === 204), `pro : Android, iPhone et navigateur inscrits (${rp.join(', ')})`);
  const rc = await reg(client, 'dz.salondz.app');
  ok(rc.every((s) => s === 204), `client : Android, iPhone et navigateur inscrits (${rc.join(', ')})`);
  const dev = await call('GET', '/v1/me/push-devices', pro.token);
  ok(dev.json?.app === 2 && dev.json?.web === 1, `le pro voit 2 appareils d'application et 1 navigateur (${JSON.stringify(dev.json)})`);

  console.log('\n3. Le client réserve en ligne → le PRO est prévenu sur ses appareils');
  const bk = await call('POST', '/v1/bookings', client.token, { salonId: salon.json.id, serviceIds: [svc.json.id], startsAt: `${day}T10:00:00+01:00` });
  ok(bk.status === 201, `réservation créée (${bk.status})`);
  await settle();
  const np = (await db.from('notifications').select('type, push_outcome, push_error').eq('user_id', pro.id)).data ?? [];
  ok(np.some((n) => n.type === 'booking_created'), `notification « nouvelle réservation » créée pour le pro (${np.map((n) => n.type).join(', ')})`);
  console.log('    résultat enregistré :', JSON.stringify(np));
  const leftPro = await remaining(pro.id);
  console.log('    appareils restants :', JSON.stringify(leftPro.map((t) => t.platform)));
  ok(!leftPro.some((t) => t.platform === 'android'), 'Firebase (Android, application Pro) contacté : faux appareil retiré');
  ok(!leftPro.some((t) => t.platform === 'ios'), 'Apple (iPhone, topic pro.salondz.app) contacté : faux appareil retiré');
  ok(!leftPro.some((t) => t.platform === 'web'), 'push navigateur contacté : faux abonnement retiré');

  console.log('\n4. Le pro confirme → le CLIENT est prévenu sur ses appareils');
  const conf = await call('POST', `/v1/pro/bookings/${bk.json?.id}/status`, pro.token, { status: 'confirmed' });
  ok(conf.status === 200, `confirmation (${conf.status})`);
  await settle();
  const nc = (await db.from('notifications').select('type, push_outcome').eq('user_id', client.id)).data ?? [];
  ok(nc.some((n) => n.type === 'booking_confirmed'), `notification « confirmé » créée pour le client (${nc.map((n) => n.type).join(', ')})`);
  const leftClient = await remaining(client.id);
  ok(!leftClient.some((t) => t.platform === 'android'), 'Firebase (Android, application client) contacté : faux appareil retiré');
  ok(!leftClient.some((t) => t.platform === 'ios'), 'Apple (iPhone, topic dz.salondz.app) contacté : faux appareil retiré');
  ok(!leftClient.some((t) => t.platform === 'web'), 'push navigateur contacté : faux abonnement retiré');

  await call('POST', `/v1/pro/bookings/${bk.json?.id}/cancel`, pro.token, { reason: 'Nettoyage' });
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  for (const id of users.reverse()) await db.auth.admin.deleteUser(id).catch(() => undefined);
  console.log('\nNettoyage : comptes jetables supprimés.');
}
if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
