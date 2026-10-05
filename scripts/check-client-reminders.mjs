/**
 * Vérifie EN PRODUCTION les deux rappels envoyés au CLIENT avant son rendez-vous :
 *
 *   node --env-file=.env scripts/check-client-reminders.mjs
 *
 * Ils sont passés de « la veille + 2 h avant » à « 1 h avant + 30 min avant » (migration 0050), et
 * les colonnes qui les marquent ont été RENOMMÉES. Rien, sur le service publié, ne prouve que la
 * base et l'API s'accordent : un tick qui ne trouve aucun rendez-vous à rappeler répond la même
 * chose qu'un tick cassé. D'où ce contrôle, qui fabrique les rendez-vous attendus.
 *
 * Ce qui doit être vrai :
 *   1. un rendez-vous confirmé qui commence dans ~1 h reçoit UN rappel « dans 1 h », et pas l'autre ;
 *   2. un rendez-vous qui commence dans ~30 min reçoit UN rappel « dans 30 min » ;
 *   3. un second passage du cron n'en produit pas de doublon ;
 *   4. un rendez-vous DÉPLACÉ redevient à rappeler (déclencheur `reset_reminder_on_move`) ;
 *   5. un client qui a coupé les rappels n'en reçoit aucun, mais son rendez-vous est marqué traité —
 *      sinon le cron le réexaminerait à chaque passage, pour rien ;
 *   6. les anciennes colonnes n'existent plus : si elles traînaient, un vieux déploiement pourrait
 *      continuer d'écrire dedans sans que personne ne le voie.
 *
 * Tout est jetable : deux comptes et un salon créés pour l'occasion, supprimés dans un `finally`
 * (adresses en `@salondz.test`, que `scripts/test-cleanup.mjs` sait aussi retrouver). Les rendez-vous
 * sont créés par l'API à une heure d'ouverture, puis REPLACÉS en base — le cron regarde l'heure
 * réelle, et demander « dans 32 minutes » à l'API est refusé la nuit.
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

const dateKeyDZ = (plusDays) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(Date.now() + plusDays * 86_400_000));
const inMin = (m) => new Date(Date.now() + m * 60_000).toISOString();

let proId = null;
let clientId = null;
let muetId = null;
try {
  // ------------------------------------------------------------------ comptes jetables
  // Le rôle ne suffit pas à distinguer les adresses : il y a DEUX clients, celui qui reçoit les
  // rappels et celui qui les a coupés.
  const creer = async (cle, role, nom) => {
    const email = `check-rappels-${cle}-${RUN}@salondz.test`;
    const r = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: nom } });
    if (r.error) throw r.error;
    return r.data.user.id;
  };
  proId = await creer('pro', 'pro', 'Karim Rappel');
  clientId = await creer('client', 'client', 'Yacine Rappel');
  muetId = await creer('muet', 'client', 'Amel Silencieuse');
  // Le réglage « Rappels de rendez-vous » : l'un l'a, l'autre l'a coupé.
  await db.from('profiles').update({ reminders_enabled: true }).in('id', [clientId]);
  await db.from('profiles').update({ reminders_enabled: false }).eq('id', muetId);

  const login = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `check-rappels-pro-${RUN}@salondz.test`, password: PASSWORD }),
    })
  ).json();
  const token = login.access_token;
  if (!token) throw new Error('connexion du professionnel impossible');

  const salon = await call('POST', '/v1/pro/salon', token, {
    name: `Rappels Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`création du salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const staffId = salon.json.staff[0].id;
  const svc = await call('POST', '/v1/pro/services', token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  const serviceId = svc.json?.id;
  if (!serviceId) throw new Error(`prestation : ${svc.status} ${svc.text.slice(0, 200)}`);
  console.log(`salon jetable : ${salon.json.slug}`);

  // ------------------------------------------------------------------ rendez-vous
  async function booking(label, hour) {
    const r = await call('POST', '/v1/pro/bookings', token, {
      serviceId, staffId, clientName: `Client ${label}`, startsAt: `${dateKeyDZ(3)}T${hour}:00+01:00`,
    });
    if (r.status !== 201) throw new Error(`rendez-vous ${label} : ${r.status} ${r.text.slice(0, 200)}`);
    return r.json.id;
  }
  /**
   * Replace le rendez-vous à `startMin` minutes d'ici et le rattache à un compte client.
   * Les rendez-vous ne durent que 10 minutes ici : trois d'entre eux doivent tenir dans les fenêtres
   * de rappel sans se chevaucher, et la contrainte d'exclusion de la base — celle qui interdit la
   * double réservation — s'applique aussi à nous.
   */
  const place = async (id, startMin, owner) => {
    const patch = { starts_at: inMin(startMin), ends_at: inMin(startMin + 10) };
    if (owner) patch.client_id = owner;
    const r = await db.from('bookings').update(patch).eq('id', id);
    if (r.error) throw r.error;
  };
  const marqueurs = async (id) => (await db.from('bookings').select('reminder_1h_sent_at, reminder_30m_sent_at').eq('id', id).single()).data ?? {};
  const tick = async () => (await fetch(`${API}/internal/cron/tick`, { method: 'POST', headers: { authorization: `Bearer ${INTERNAL_CRON_TOKEN}` } })).json();
  const rappels = async (id) => {
    const r = await db.from('notifications').select('title, body, user_id').eq('booking_id', id).eq('type', 'booking_reminder');
    if (r.error) throw r.error;
    return (r.data ?? []).filter((n) => n.user_id !== proId);
  };

  const uneHeure = await booking('1h', '10:00');
  const demiHeure = await booking('30min', '14:00');
  const coupe = await booking('coupe', '16:00');
  await place(demiHeure, 30, clientId); //   30 → 40  : fenêtre « 30 min » (25–40)
  await place(uneHeure, 56, clientId); //    56 → 66  : fenêtre « 1 h » (55–70)
  await place(coupe, 68, muetId); //         68 → 78  : même fenêtre, mais rappels coupés

  // ------------------------------------------------------------------ 1 & 2
  console.log('\n1. Les deux rappels partent, chacun dans sa fenêtre');
  const t1 = await tick();
  ok((t1.reminders1h ?? 0) >= 1, `le cron annonce ${t1.reminders1h} rappel(s) « 1 h »`);
  ok((t1.reminders30m ?? 0) >= 1, `le cron annonce ${t1.reminders30m} rappel(s) « 30 min »`);

  const n1 = await rappels(uneHeure);
  ok(n1.length === 1, `rendez-vous dans 1 h : une notification (${n1.length})`);
  ok(/dans 1 h/.test(n1[0]?.title ?? ''), `titre : « ${n1[0]?.title} »`);
  ok((n1[0]?.body ?? '').includes(salon.json.name), `le salon est nommé : « ${n1[0]?.body} »`);

  const n2 = await rappels(demiHeure);
  ok(n2.length === 1, `rendez-vous dans 30 min : une notification (${n2.length})`);
  ok(/dans 30 min/.test(n2[0]?.title ?? ''), `titre : « ${n2[0]?.title} »`);

  const m1 = await marqueurs(uneHeure);
  ok(!!m1.reminder_1h_sent_at, 'le marqueur « 1 h » est posé');
  ok(!m1.reminder_30m_sent_at, 'le rappel « 30 min » n’est PAS encore parti (il n’est pas l’heure)');

  // ------------------------------------------------------------------ 3
  console.log('\n2. Envoi unique');
  await tick();
  ok((await rappels(uneHeure)).length === 1, 'un second passage du cron n’ajoute pas de doublon');
  ok((await rappels(demiHeure)).length === 1, 'idem pour le rappel de 30 min');

  // ------------------------------------------------------------------ 4
  console.log('\n3. Un rendez-vous déplacé redevient à rappeler');
  // On libère d'abord la fenêtre des 30 minutes : le rendez-vous qui s'y trouve la bloquerait, la
  // contrainte d'exclusion de la base s'appliquant aussi à nous.
  await place(demiHeure, 240);
  await place(uneHeure, 30);
  const apresDeplacement = await marqueurs(uneHeure);
  ok(apresDeplacement.reminder_1h_sent_at === null && apresDeplacement.reminder_30m_sent_at === null, 'le déplacement remet les deux marqueurs à zéro');
  await tick();
  const n3 = await rappels(uneHeure);
  ok(n3.length === 2, `un rappel part pour le nouveau créneau (${n3.length} au total)`);
  ok(n3.some((n) => /dans 30 min/.test(n.title)), 'et c’est bien celui de 30 min, puisque le rendez-vous est proche');

  // ------------------------------------------------------------------ 5
  console.log('\n4. Un client qui a coupé les rappels');
  ok((await rappels(coupe)).length === 0, 'aucune notification');
  ok(!!(await marqueurs(coupe)).reminder_1h_sent_at, 'son rendez-vous est tout de même marqué traité');

  // ------------------------------------------------------------------ 6
  console.log('\n5. Les anciennes colonnes ont disparu');
  const ancienne = await db.from('bookings').select('reminder_2h_sent_at').limit(1);
  ok(!!ancienne.error, `« reminder_2h_sent_at » n’existe plus (${ancienne.error?.code ?? 'elle répond encore !'})`);
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  // Le professionnel part en premier : son salon emmène les rendez-vous, et plus rien ne référence
  // alors les comptes clients.
  if (proId) await db.auth.admin.deleteUser(proId);
  for (const id of [clientId, muetId]) if (id) await db.auth.admin.deleteUser(id);
  console.log('\nNettoyage : comptes jetables supprimés (le salon et ses rendez-vous partent avec).');
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
