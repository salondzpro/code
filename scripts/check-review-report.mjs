/**
 * Vérifie EN PRODUCTION le signalement d'un avis (migration 0047), exigé par Apple (1.2) et Google Play :
 *
 *   node --env-file=.env scripts/check-review-report.mjs
 *
 * 1. Toute personne connectée peut signaler un avis — le professionnel visé compris — sauf son AUTEUR.
 * 2. Signaler deux fois est sans effet (un signalement par personne et par avis) et n'est pas une erreur.
 * 3. Un motif inconnu est refusé ; sans compte, on n'entre pas.
 * 4. L'administration lit la file, MASQUE l'avis avec un motif, et classe le signalement ; l'autre est classé
 *    « sans suite ». Un avis masqué ne peut plus être signalé.
 * 5. Un compte ordinaire ne lit jamais la file.
 *
 * Tout est jetable (quatre comptes `@salondz.test`, nettoyés dans un `finally`) : aucun compte réel n'est touché.
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
  const email = `check-report-${label}-${RUN}@salondz.test`;
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
  const [pro, author, reporter, admin] = await Promise.all([
    user('pro', 'pro', 'Karim Signalement'),
    user('author', 'client', 'Auteur Avis'),
    user('reporter', 'client', 'Lectrice Signalement'),
    user('admin', 'client', 'Admin Signalement'),
  ]);

  const salon = await call('POST', '/pro/salon', pro.token, {
    name: `Signalement Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (salon.status !== 201) throw new Error(`salon : ${salon.status} ${salon.text.slice(0, 200)}`);
  const svc = await call('POST', '/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  await call('PATCH', '/pro/salon', pro.token, { isPublished: true });

  // Un avis réel : rendez-vous pris, passé en « terminé » (horaires posés en base), puis noté par l'API.
  let bookingId = null;
  for (let day = 3; day <= 9 && !bookingId; day++) {
    const b = await call('POST', '/bookings', author.token, { salonId: salon.json.id, serviceId: svc.json.id, startsAt: `${dateKeyDZ(day)}T10:00:00+01:00` });
    if (b.status === 201) bookingId = b.json.id;
  }
  if (!bookingId) throw new Error('impossible de réserver');
  const past = await db
    .from('bookings')
    .update({ status: 'completed', starts_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), ends_at: new Date(Date.now() - 3 * 86_400_000 + 1_800_000).toISOString() })
    .eq('id', bookingId);
  if (past.error) throw past.error;
  const review = await call('POST', `/bookings/${bookingId}/review`, author.token, { rating: 1, comment: `Avis de contrôle ${RUN}` });
  if (review.status !== 201) throw new Error(`avis : ${review.status} ${review.text.slice(0, 200)}`);
  const reviewId = review.json.id;
  console.log(`salon jetable : ${salon.json.slug}`);

  console.log('\n1. Qui peut signaler');
  ok((await call('POST', `/reviews/${reviewId}/report`, reporter.token, { reason: 'false' })).status === 204, 'une lectrice connectée signale (204)');
  ok((await call('POST', `/reviews/${reviewId}/report`, pro.token, { reason: 'offensive', message: 'Cette personne n’est jamais venue.' })).status === 204, 'le professionnel visé signale aussi (204)');
  const own = await call('POST', `/reviews/${reviewId}/report`, author.token, { reason: 'other' });
  ok(own.status === 400 && own.json?.error?.code === 'OWN_REVIEW', `l'auteur ne peut pas signaler son propre avis (${own.status} ${own.json?.error?.code})`);

  console.log('\n2. Un signalement par personne et par avis');
  ok((await call('POST', `/reviews/${reviewId}/report`, reporter.token, { reason: 'false' })).status === 204, 'refaire le geste n’est pas une erreur (204)');
  const rows = await db.from('review_reports').select('id').eq('review_id', reviewId);
  ok((rows.data ?? []).length === 2, `deux signalements en base, pas trois (${rows.data?.length})`);

  console.log('\n3. Refus');
  ok((await call('POST', `/reviews/${reviewId}/report`, reporter.token, { reason: 'nimporte' })).status === 400, 'motif inconnu → 400');
  ok((await call('POST', `/reviews/${reviewId}/report`, undefined, { reason: 'false' })).status === 401, 'sans compte → 401');

  console.log('\n4. Administration');
  ok((await call('GET', '/admin/reports', reporter.token)).status === 403, 'un compte ordinaire ne lit pas la file (403)');
  const donne = await db.from('platform_admins').insert({ user_id: admin.id, level: 'support' });
  if (donne.error) throw donne.error;
  const file = await call('GET', '/admin/reports', admin.token);
  const mine = (file.json?.items ?? []).filter((r) => r.reviewId === reviewId);
  ok(file.status === 200 && mine.length === 2, `la file contient les deux signalements (${mine.length})`);
  ok(mine[0]?.reviews?.comment === `Avis de contrôle ${RUN}` && !!mine[0]?.reporter?.fullName, 'chaque ligne porte l’avis et qui le signale');
  const hide = await call('POST', `/admin/reviews/${reviewId}/hide`, admin.token, { reason: `Avis contraire aux règles ${RUN}` });
  ok(hide.status === 200, `avis masqué avec un motif (${hide.status})`);
  ok((await call('POST', `/admin/reports/${mine[0].id}/close`, admin.token, { outcome: 'handled', note: 'Avis masqué' })).status === 204, 'signalement classé « traité » (204)');
  ok((await call('POST', `/admin/reports/${mine[1].id}/close`, admin.token, { outcome: 'rejected' })).status === 204, 'l’autre classé « sans suite » (204)');
  const apres = await call('GET', '/admin/reports', admin.token);
  ok(!(apres.json?.items ?? []).some((r) => r.reviewId === reviewId), 'la file ne les montre plus');
  ok((await call('POST', `/reviews/${reviewId}/report`, reporter.token, { reason: 'false' })).status === 404, 'un avis masqué ne se signale plus (404)');
  const journal = await db.from('admin_audit').select('action').eq('admin_id', admin.id);
  const actions = (journal.data ?? []).map((a) => a.action);
  ok(actions.includes('report_handled') && actions.includes('report_rejected'), 'les deux classements sont au journal');
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  if (made.length) {
    await db.from('admin_audit').delete().in('admin_id', made);
    await db.from('platform_admins').delete().in('user_id', made);
    for (const id of made) await db.auth.admin.deleteUser(id);
  }
  console.log(`\nNettoyage : ${made.length} compte(s) jetable(s) supprimé(s).`);
}

if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log('\nToutes les vérifications passent.');
