/**
 * Vérifie EN PRODUCTION l'alerte « M'alerter si un créneau se libère » (liste d'attente) :
 *
 *   node --env-file=.env scripts/check-slot-alert.mjs
 *
 * Ce qui doit être vrai, et que rien d'autre ne prouve sur le service publié :
 *
 * 1. Sans compte, on ne peut pas s'inscrire à l'alerte (401) : l'écran envoie à la connexion.
 * 2. Une cliente connectée s'inscrit pour un salon et un jour ; un compte PRO est refusé.
 * 3. Quand un créneau de ce jour se libère (annulation par le salon), TOUTES les inscrites sont
 *    prévenues — une notification chacune, « Un créneau s'est libéré », avec le lien vers ce jour.
 * 4. Une cliente connectée mais NON inscrite, sans rendez-vous, ne reçoit rien.
 * 5. Une cliente qui a déjà un rendez-vous PLUS TARD ce jour-là reçoit « Un créneau plus tôt
 *    s'est libéré ».
 * 6. L'alerte est à usage unique : une seconde libération ne renvoie rien aux inscrites déjà
 *    prévenues (premier arrivé, premier servi) ; l'alerte disparaît de leur liste.
 *
 * Tout est jetable : comptes en `@salondz.test` et salon créés pour l'occasion, supprimés dans un
 * `finally` (`scripts/test-cleanup.mjs` sait aussi les retrouver).
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
let failures = 0;
const ok = (cond, msg) => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✔' : '✘'} ${msg}`);
};

const call = async (method, path, token, body) => {
  const res = await fetch(`${API}${path}`, {
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

const users = [];
/** Compte jetable confirmé + session. */
async function account(label, role, fullName, phone) {
  const email = `check-alert-${label}-${RUN}@salondz.test`;
  const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { role, full_name: fullName } });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  users.push(id);
  const patch = { full_name: fullName, role };
  if (phone) patch.phone = phone;
  const up = await db.from('profiles').update(patch).eq('id', id);
  if (up.error) throw up.error;
  const login = await (
    await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
  ).json();
  if (!login.access_token) throw new Error(`connexion ${label} impossible`);
  return { id, token: login.access_token };
}

/** Un jour ouvert (pas le vendredi, fermé par défaut), dans 2 jours au moins. */
function dayKey() {
  for (let k = 2; k < 9; k++) {
    const d = new Date(Date.now() + k * 86_400_000);
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Algiers', weekday: 'short' }).format(d);
    if (wd !== 'Fri') return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(d);
  }
  throw new Error('aucun jour ouvert');
}

const freedFor = async (token) => {
  const r = await call('GET', '/v1/me/notifications?limit=50', token);
  return (r.json?.items ?? []).filter((n) => n.type === 'slot_freed');
};
/** L'envoi est lancé après la réponse de l'annulation (jamais bloquant) : on attend qu'il ait eu lieu. */
const settle = () => new Promise((r) => setTimeout(r, 4000));

try {
  const day = dayKey();
  const pro = await account('pro', 'pro', 'Karim Alerte');
  const salon = await call('POST', '/v1/pro/salon', pro.token, {
    name: `Alerte Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`création du salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const salonId = salon.json.id;
  const staffId = salon.json.staff[0].id;
  const svc = await call('POST', '/v1/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  const serviceId = svc.json?.id;
  if (!serviceId) throw new Error(`prestation : ${svc.status} ${svc.text.slice(0, 200)}`);
  const pub = await db.from('salons').update({ is_published: true }).eq('id', salonId);
  if (pub.error) throw pub.error;
  console.log(`salon jetable : ${salon.json.slug} · jour testé : ${day}`);

  const a = await account('a', 'client', 'Amel Inscrite', '+213550990001');
  const b = await account('b', 'client', 'Lina Inscrite', '+213550990002');
  const c = await account('c', 'client', 'Sara Non-inscrite', '+213550990003');
  const d = await account('d', 'client', 'Nadia Plus-tard', '+213550990004');

  console.log('\n1. Sans compte');
  const anon = await call('POST', '/v1/me/slot-alerts', undefined, { salonId, day });
  ok(anon.status === 401, `inscription sans compte refusée (${anon.status})`);

  console.log('\n2. Inscription à l\'alerte');
  const ra = await call('POST', '/v1/me/slot-alerts', a.token, { salonId, day, serviceId });
  const rb = await call('POST', '/v1/me/slot-alerts', b.token, { salonId, day });
  ok(ra.status === 201 && rb.status === 201, `deux clientes inscrites (${ra.status}, ${rb.status})`);
  const rp = await call('POST', '/v1/me/slot-alerts', pro.token, { salonId, day });
  ok(rp.status === 403, `un compte professionnel est refusé (${rp.status})`);
  const listA = await call('GET', `/v1/me/slot-alerts?salonId=${salonId}`, a.token);
  ok(listA.json?.items?.some((x) => x.day === day), 'l\'alerte figure dans la liste de la cliente');

  // Le créneau qui va se libérer (10:00), et le rendez-vous en ligne de D, plus tard (16:00).
  const walkIn = async (hour) => {
    const r = await call('POST', '/v1/pro/bookings', pro.token, { serviceId, staffId, clientName: `Passage ${hour}`, startsAt: `${day}T${hour}:00+01:00` });
    if (r.status !== 201) throw new Error(`rendez-vous ${hour} : ${r.status} ${r.text.slice(0, 200)}`);
    return r.json.id;
  };
  const first = await walkIn('10:00');
  const second = await walkIn('11:00');
  const dBooking = await call('POST', '/v1/bookings', d.token, { salonId, serviceIds: [serviceId], startsAt: `${day}T16:00:00+01:00` });
  ok(dBooking.status === 201, `la cliente D a un rendez-vous plus tard ce jour-là (${dBooking.status})`);

  console.log('\n3. Un créneau se libère (annulation par le salon)');
  const cancel1 = await call('POST', `/v1/pro/bookings/${first}/cancel`, pro.token, { reason: 'Test alerte' });
  ok(cancel1.status === 200, `annulation acceptée (${cancel1.status})`);
  await settle();
  const fa = await freedFor(a.token);
  const fb = await freedFor(b.token);
  ok(fa.length === 1, `cliente A inscrite : ${fa.length} notification`);
  ok(fb.length === 1, `cliente B inscrite : ${fb.length} notification`);
  ok(/s’est libéré/.test(fa[0]?.title ?? ''), `titre : « ${fa[0]?.title} »`);
  ok((fa[0]?.data?.url ?? '').includes(`date=${day}`), `le lien mène au bon jour (${fa[0]?.data?.url})`);

  console.log('\n4. Cliente connectée non inscrite');
  ok((await freedFor(c.token)).length === 0, 'aucune notification');

  console.log('\n5. Cliente qui a un rendez-vous plus tard');
  const fd = await freedFor(d.token);
  ok(fd.length === 1 && /plus tôt/.test(fd[0]?.title ?? ''), `« ${fd[0]?.title ?? 'rien'} »`);

  console.log('\n6. Alerte à usage unique');
  await call('POST', `/v1/pro/bookings/${second}/cancel`, pro.token, { reason: 'Test alerte 2' });
  await settle();
  ok((await freedFor(a.token)).length === 1 && (await freedFor(b.token)).length === 1, 'pas de seconde notification aux inscrites');
  const listA2 = await call('GET', `/v1/me/slot-alerts?salonId=${salonId}`, a.token);
  ok(!(listA2.json?.items ?? []).some((x) => x.day === day), 'l\'alerte a disparu de la liste');

  if (dBooking.json?.id) await call('POST', `/v1/pro/bookings/${dBooking.json.id}/cancel`, pro.token, { reason: 'Nettoyage' });
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  for (const id of users.reverse()) await db.auth.admin.deleteUser(id).catch(() => undefined);
  console.log('\nNettoyage : comptes jetables supprimés (le salon et ses rendez-vous partent avec le compte pro).');
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
