/**
 * Vérifie EN PRODUCTION qu'un PROFESSIONNEL peut supprimer son compte et son salon depuis l'application
 * (exigé par Apple 5.1.1 et par Google Play), sans laisser ses clients devant une porte close :
 *
 *   node --env-file=.env scripts/check-pro-deletion.mjs
 *
 * 1. Sans confirmation de fermeture du salon, la suppression est REFUSÉE (`HAS_SALON`) : on ne ferme pas un
 *    salon par accident.
 * 2. Avec `withSalon`, le compte disparaît, la page du salon aussi (404), et la personne qui avait un rendez-vous
 *    à venir en est PRÉVENUE dans l'application (une trace qui survit à la suppression du rendez-vous).
 * 3. Le rendez-vous n'apparaît plus chez le client.
 * 4. Un compte qui a un accès d'administrateur ne peut pas être supprimé : son journal en dépend.
 *
 * Tout est jetable (comptes `@salondz.test`, nettoyés dans un `finally`). Aucun compte réel n'est touché.
 */
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
const made = [];
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
};

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 204 */
  }
  return { status: res.status, json, text };
};

async function user(label, role, fullName) {
  const email = `check-deletion-${label}-${RUN}@salondz.test`;
  const c = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: fullName } });
  if (c.error) throw c.error;
  made.push(c.data.user.id);
  const login = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json();
  if (!login.access_token) throw new Error(`connexion ${label}`);
  return { id: c.data.user.id, token: login.access_token };
}

const dateKeyDZ = (plusDays) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(Date.now() + plusDays * 86_400_000));

try {
  const [pro, client, admin] = await Promise.all([user('pro', 'pro', 'Karim Fermeture'), user('client', 'client', 'Cliente Fermeture'), user('admin', 'client', 'Admin Fermeture')]);

  const salon = await call('POST', '/pro/salon', pro.token, {
    name: `Fermeture Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const svc = await call('POST', '/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  const serviceId = svc.json?.id;
  await call('PATCH', '/pro/salon', pro.token, { isPublished: true });

  // Un rendez-vous à venir pour la cliente (le premier jour ouvré qui accepte l'horaire).
  let bookingId = null;
  for (let day = 3; day <= 9 && !bookingId; day++) {
    const b = await call('POST', '/bookings', client.token, { salonId: salon.json.id, serviceId, startsAt: `${dateKeyDZ(day)}T10:00:00+01:00` });
    if (b.status === 201) bookingId = b.json.id;
  }
  if (!bookingId) throw new Error('impossible de réserver un rendez-vous pour la cliente');
  console.log(`salon jetable : ${salon.json.slug}`);

  console.log('\n1. Pas de fermeture par accident');
  const sans = await call('DELETE', '/me', pro.token);
  ok(sans.status === 409 && sans.json?.error?.code === 'HAS_SALON', `sans confirmation → ${sans.status} ${sans.json?.error?.code}`);
  ok((await call('GET', `/salons/${salon.json.slug}`)).status === 200, 'le salon est toujours là');

  console.log('\n2. Suppression du compte ET du salon');
  const avec = await call('DELETE', '/me', pro.token, { withSalon: true });
  ok(avec.status === 204, `suppression acceptée (${avec.status})`);
  ok((await call('GET', `/salons/${salon.json.slug}`)).status === 404, 'la page du salon n’existe plus');
  const gone = await db.auth.admin.getUserById(pro.id);
  ok(!gone.data?.user, 'le compte du professionnel n’existe plus');
  const notif = await call('GET', '/me/notifications?limit=50', client.token);
  const prevenue = (notif.json?.items ?? []).find((n) => n.type === 'booking_cancelled' && /fermé son compte/.test(n.body));
  ok(!!prevenue, `la cliente est prévenue dans l’application : « ${prevenue?.body ?? 'rien reçu'} »`);

  console.log('\n3. Le rendez-vous a disparu chez la cliente');
  const rdv = await call('GET', '/me/bookings?scope=upcoming', client.token);
  ok(!(rdv.json?.items ?? []).some((b) => b.id === bookingId), 'plus de rendez-vous à venir chez ce salon');

  console.log('\n4. Un compte administrateur ne se supprime pas');
  const donne = await db.from('platform_admins').insert({ user_id: admin.id, level: 'support' });
  if (donne.error) throw donne.error;
  const refuse = await call('DELETE', '/me', admin.token);
  ok(refuse.status === 409 && refuse.json?.error?.code === 'ADMIN_ACCOUNT', `refusé : ${refuse.status} ${refuse.json?.error?.code}`);
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  if (made.length) {
    await db.from('admin_audit').delete().in('admin_id', made);
    await db.from('platform_admins').delete().in('user_id', made);
    for (const id of made) await db.auth.admin.deleteUser(id);
  }
  console.log(`\nNettoyage : ${made.length} compte(s) jetable(s) traité(s).`);
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
