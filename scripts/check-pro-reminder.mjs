/**
 * Vérifie EN PRODUCTION le rappel envoyé au PROFESSIONNEL avant un rendez-vous confirmé :
 *
 *   node --env-file=.env scripts/check-pro-reminder.mjs
 *
 * Ce qui doit être vrai, et que rien d'autre ne prouve sur le service publié :
 *
 * 1. Un rendez-vous confirmé qui commence dans la fenêtre du rappel produit UNE notification pour le
 *    propriétaire du salon, marquée `audience: 'pro'` (l'application s'en sert pour ouvrir la fiche côté pro).
 * 2. Un second passage du cron n'en produit pas une deuxième (envoi unique).
 * 3. Un rendez-vous DÉPLACÉ redevient à rappeler (le déclencheur remet le marqueur à zéro).
 * 4. Un rendez-vous pris peu avant l'heure du rappel n'en reçoit pas : le pro vient d'être prévenu par la
 *    réservation elle-même. Il est marqué traité, sans notification.
 *
 * Tout est jetable : un compte et un salon créés pour l'occasion, supprimés dans un `finally`
 * (adresse en `@salondz.test`, que `scripts/test-cleanup.mjs` sait aussi retrouver). Les horaires sont
 * posés directement en base — le cron regarde l'heure réelle, et créer un rendez-vous « dans 25 minutes »
 * par l'API est refusé la nuit (hors horaires d'ouverture).
 */
import { createClient } from '@supabase/supabase-js';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, INTERNAL_CRON_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY || !INTERNAL_CRON_TOKEN) {
  console.error('SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY et INTERNAL_CRON_TOKEN sont requis (--env-file=.env).');
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
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
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

const dateKeyDZ = (plusDays) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(Date.now() + plusDays * 86_400_000));
const inMin = (m) => new Date(Date.now() + m * 60_000).toISOString();

let userId = null;
try {
  const email = `check-reminder-${RUN}@salondz.test`;
  const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role: 'pro', full_name: 'Karim Rappel' } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const login = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json();
  const token = login.access_token;
  if (!token) throw new Error('connexion impossible');

  const salon = await call('POST', '/v1/pro/salon', token, {
    name: `Rappel Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`création du salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const staffId = salon.json.staff[0].id;
  const svc = await call('POST', '/v1/pro/services', token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  const serviceId = svc.json?.id;
  if (!serviceId) throw new Error(`prestation : ${svc.status} ${svc.text.slice(0, 200)}`);

  /** Un rendez-vous confirmé, créé par l'API à un horaire d'ouverture, puis replacé où l'on veut. */
  async function booking(label, day, hour) {
    const r = await call('POST', '/v1/pro/bookings', token, {
      serviceId, staffId, clientName: `Client ${label}`, startsAt: `${dateKeyDZ(day)}T${hour}:00+01:00`,
    });
    if (r.status !== 201) throw new Error(`rendez-vous ${label} : ${r.status} ${r.text.slice(0, 200)}`);
    return r.json.id;
  }
  const place = async (id, startMin, createdMinAgo) => {
    const patch = { starts_at: inMin(startMin), ends_at: inMin(startMin + 30) };
    if (createdMinAgo !== undefined) patch.created_at = inMin(-createdMinAgo);
    const r = await db.from('bookings').update(patch).eq('id', id);
    if (r.error) throw r.error;
  };
  const marker = async (id) => (await db.from('bookings').select('reminder_pro_sent_at').eq('id', id).single()).data?.reminder_pro_sent_at;
  const tick = async () => {
    const r = await fetch(`${API}/internal/cron/tick`, { method: 'POST', headers: { authorization: `Bearer ${INTERNAL_CRON_TOKEN}` } });
    return r.json();
  };
  const reminders = async (id) => {
    const r = await call('GET', '/v1/me/notifications?limit=50', token);
    return (r.json?.items ?? []).filter((n) => n.type === 'booking_reminder' && n.bookingId === id);
  };

  // Deux rendez-vous : un pris de longue date, un pris il y a 10 minutes seulement.
  const early = await booking('ancien', 3, '10:00');
  const late = await booking('recent', 3, '14:00');
  await place(early, 25, 180); //   commence dans 25 min, pris il y a 3 h
  await place(late, 64, 10); //     commence dans 64 min, pris il y a 10 min
  console.log(`salon jetable : ${salon.json.slug}`);

  console.log('\n1. Un rendez-vous dans la fenêtre du rappel');
  const t1 = await tick();
  ok((t1.proReminders ?? 0) >= 1, `le cron a envoyé ${t1.proReminders} rappel(s) au professionnel`);
  const n1 = await reminders(early);
  ok(n1.length === 1, `une notification pour le rendez-vous ancien (${n1.length})`);
  ok(n1[0]?.data?.audience === 'pro', 'elle est marquée audience « pro »');
  ok(/Rendez-vous dans 1 h/.test(n1[0]?.title ?? '') && /Client ancien/.test(n1[0]?.body ?? ''), `texte : « ${n1[0]?.title} — ${n1[0]?.body} »`);

  console.log('\n2. Envoi unique');
  await tick();
  ok((await reminders(early)).length === 1, 'un second passage du cron n’en ajoute pas');

  console.log('\n3. Un rendez-vous déplacé redevient à rappeler');
  ok(!!(await marker(early)), 'marqueur posé après l’envoi');
  await place(early, 33);
  ok((await marker(early)) === null, 'le déplacement remet le marqueur à zéro');
  await tick();
  ok((await reminders(early)).length === 2, 'un nouveau rappel part pour le nouveau créneau');

  console.log('\n4. Un rendez-vous pris peu avant le rappel');
  ok((await reminders(late)).length === 0, 'aucune notification (le pro vient d’être prévenu par la réservation)');
  ok(!!(await marker(late)), 'marqué traité, pour ne pas être réexaminé à chaque passage');
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  if (userId) await db.auth.admin.deleteUser(userId);
  console.log('\nNettoyage : compte jetable supprimé (le salon et ses rendez-vous partent avec).');
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
