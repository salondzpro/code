/**
 * Vérifie EN PRODUCTION qu'un administrateur peut BLOQUER un professionnel et ENTRER dans son espace,
 * et que le jeton qui l'y fait entrer est étroit :
 *
 *   node --env-file=.env scripts/check-admin-control.mjs
 *
 * Ce qui doit être vrai, et que rien d'autre ne prouve sur le service publié :
 *
 * 1. Sans accès d'administrateur, aucun jeton ne se délivre.
 * 2. Avec le jeton, `GET /pro/salon` rend le salon du PRO et son identité — sans lui, rien. C'est cette
 *    route qui décide si l'espace pro s'ouvre ; en l'oubliant, l'administrateur est renvoyé vers
 *    l'inscription d'un salon.
 * 3. Écrire à sa place s'applique chez le pro, et laisse une ligne au journal (entrée comprise).
 * 4. Le jeton est PERSONNEL : un autre compte, même administrateur, ne s'en sert pas ; un jeton
 *    falsifié est refusé en 403 (jamais 401, qui déconnecterait l'administrateur).
 * 5. Bloquer : motif exigé, salon gelé → la réservation est refusée avec un VRAI message
 *    (`SALON_SUSPENDED`, pas un 500), masqué → il sort de la recherche et sa page se ferme, levé →
 *    tout revient. Un client suspendu → `CLIENT_SUSPENDED`.
 * 6. Retirer l'accès de l'administrateur coupe son jeton en cours.
 *
 * Tout est jetable : deux comptes et un salon créés pour l'occasion, supprimés dans un `finally`
 * (les adresses en `@salondz.test` sont aussi ce que `scripts/test-cleanup.mjs` sait retrouver si le
 * processus est tué en route). Aucun compte réel n'est touché.
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
  if (cond) console.log(`  ✔ ${msg}`);
  else {
    failures++;
    console.log(`  ✘ ${msg}`);
  }
};

const call = async (method, path, token, body, extra = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 204 ou pas du JSON */
  }
  return { status: res.status, json, text };
};

async function createUser(label, role, fullName) {
  const email = `check-control-${label}-${RUN}@salondz.test`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;
  made.push(data.user.id);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`connexion ${label} : ${JSON.stringify(json).slice(0, 200)}`);
  return { id: data.user.id, email, token: json.access_token };
}

const dateKeyDZ = (plusDays) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date(Date.now() + plusDays * 86_400_000));

let admin;
let pro;
let cliente;
let salonId = null;
try {
  console.log(`API : ${API}`);
  [pro, admin, cliente] = await Promise.all([
    createUser('pro', 'pro', 'Karim Contrôle'),
    createUser('admin', 'client', 'Admin Contrôle'),
    createUser('cliente', 'client', 'Cliente Contrôle'),
  ]);

  // Un salon publié, réservable, appartenant au pro jetable.
  const cree = await call('POST', '/pro/salon', pro.token, {
    name: `Contrôle Barber ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '12 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  });
  if (cree.status !== 201) throw new Error(`création du salon : ${cree.status} ${cree.text.slice(0, 200)}`);
  salonId = cree.json.id;
  const slug = cree.json.slug;
  const svc = await call('POST', '/pro/services', pro.token, { name: 'Coupe', durationMinutes: 30, priceDa: 800 });
  const serviceId = svc.json?.id;
  if (!serviceId) throw new Error(`création de la prestation : ${svc.status} ${svc.text.slice(0, 200)}`);
  const pub = await call('PATCH', '/pro/salon', pro.token, { isPublished: true });
  if (pub.status !== 200) throw new Error(`publication : ${pub.status} ${pub.text.slice(0, 200)}`);
  console.log(`salon jetable : ${slug}`);

  console.log('\n1. La porte est fermée sans accès');
  const ferme = await call('POST', `/admin/salons/${salonId}/control`, admin.token);
  ok(ferme.status === 403, `pas administrateur → ${ferme.status} (403 attendu)`);

  const donne = await db.from('platform_admins').insert([
    { user_id: admin.id, level: 'support' },
    { user_id: pro.id, level: 'support' },
  ]);
  if (donne.error) throw donne.error;

  console.log('\n2. Le jeton ouvre l’espace du professionnel');
  const ouvre = await call('POST', `/admin/salons/${salonId}/control`, admin.token);
  ok(ouvre.status === 200 && !!ouvre.json?.token, `jeton délivré (${ouvre.status})`);
  const minutes = Math.round((new Date(ouvre.json?.expiresAt).getTime() - Date.now()) / 60_000);
  ok(minutes > 100 && minutes <= 120, `valable ${minutes} min (deux heures)`);
  const avec = { 'x-admin-control': ouvre.json?.token ?? '' };

  const sans = await call('GET', '/pro/salon', admin.token);
  ok(sans.status === 200 && sans.json?.salon === null, 'sans le jeton : aucun salon (l’administrateur n’en a pas)');
  const vue = await call('GET', '/pro/salon', admin.token, undefined, avec);
  ok(vue.json?.salon?.id === salonId, 'avec le jeton : le salon du professionnel');
  ok(vue.json?.owner?.id === pro.id && vue.json?.owner?.email === pro.email, 'avec le jeton : l’identité du professionnel');
  const stats = await call('GET', '/pro/stats', admin.token, undefined, avec);
  ok(stats.status === 200, `les autres routes /pro suivent (${stats.status})`);
  const proVoit = await call('GET', '/pro/salon', pro.token);
  ok(proVoit.json?.owner === undefined, 'le vrai propriétaire ne reçoit pas de bloc « owner »');

  console.log('\n3. Écrire à sa place, avec trace');
  const description = `Corrigé avec le support ${RUN}`;
  const ecrit = await call('PATCH', '/pro/salon', admin.token, { description }, avec);
  ok(ecrit.status === 200, `modification acceptée (${ecrit.status})`);
  const chezPro = await call('GET', '/pro/salon', pro.token);
  ok(chezPro.json?.salon?.description === description, 'la modification est bien chez le professionnel');
  const creeAdmin = await call('POST', '/pro/salon', admin.token, {
    name: `Ne doit pas exister ${RUN}`, wilayaCode: 16, city: 'Alger Centre', address: '1 rue Test',
    phone: '05 51 23 45 67', genderTarget: 'men', categoryIds: ['barbier'],
  }, avec);
  ok(creeAdmin.status === 409 && creeAdmin.json?.error?.code === 'SALON_EXISTS', 'jamais de salon créé au nom de l’administrateur');
  let journal = [];
  for (let i = 0; i < 30 && !(journal.includes('salon_control_start') && journal.includes('acted_as_salon')); i++) {
    const r = await db.from('admin_audit').select('action').eq('admin_id', admin.id).eq('target_id', salonId);
    journal = (r.data ?? []).map((x) => x.action);
    if (!journal.includes('acted_as_salon')) await new Promise((res) => setTimeout(res, 200));
  }
  ok(journal.includes('salon_control_start'), 'l’entrée est au journal');
  ok(journal.includes('acted_as_salon'), 'l’écriture faite à sa place est au journal');

  console.log('\n4. Le jeton est personnel et daté');
  const vole = await call('GET', '/pro/salon', pro.token, undefined, avec);
  ok(vole.status === 403 && vole.json?.error?.code === 'CONTROL_INVALID', `un autre administrateur ne s’en sert pas (${vole.status} ${vole.json?.error?.code})`);
  const curieuse = await call('GET', '/pro/salon', cliente.token, undefined, avec);
  ok(curieuse.status === 403, `un simple compte non plus (${curieuse.status})`);
  const bidon = await call('GET', '/pro/salon', admin.token, undefined, { 'x-admin-control': 'pas.un.jeton' });
  ok(bidon.status === 403 && bidon.json?.error?.code === 'CONTROL_INVALID', `jeton falsifié → 403 CONTROL_INVALID (${bidon.status})`);

  console.log('\n5. Bloquer le professionnel');
  const suspend = `/admin/salons/${salonId}/suspend`;
  const court = await call('POST', suspend, admin.token, { level: 'frozen', reason: 'court' });
  ok(court.status === 400, `motif trop court refusé (${court.status})`);
  const motif = `Litige en cours ${RUN}`;
  const gele = await call('POST', suspend, admin.token, { level: 'frozen', reason: motif });
  ok(gele.status === 200, `salon gelé (${gele.status})`);
  const page = await call('GET', `/salons/${slug}`);
  ok(page.status === 200, 'gelé : la page reste en ligne');
  const startsAt = `${dateKeyDZ(5)}T11:00:00+01:00`;
  const refus = await call('POST', '/bookings', cliente.token, { salonId, serviceId, startsAt });
  ok(refus.status === 409 && refus.json?.error?.code === 'SALON_SUSPENDED', `gelé : réservation refusée avec un vrai message (${refus.status} ${refus.json?.error?.code})`);
  const moiPro = await call('GET', '/me', pro.token);
  ok(moiPro.json?.salon?.suspendedReason === motif, 'le professionnel lit le motif dans son espace');
  ok((await call('GET', '/pro/salon', pro.token)).json?.salon?.isPublished === true, 'son intention de publier n’est pas réécrite');

  const masque = await call('POST', suspend, admin.token, { level: 'hidden', reason: motif });
  ok(masque.status === 200, `salon masqué (${masque.status})`);
  ok((await call('GET', `/salons/${slug}`)).status === 404, 'masqué : sa page ne s’ouvre plus');
  const cherche = await call('GET', `/salons?wilaya=16&category=barbier&q=${encodeURIComponent(`Contrôle Barber ${RUN}`)}`);
  ok(!(cherche.json?.items ?? []).some((s) => s.id === salonId), 'masqué : il sort de la recherche');

  const leve = await call('POST', `/admin/salons/${salonId}/unsuspend`, admin.token, {});
  ok(leve.status === 200, `suspension levée (${leve.status})`);
  ok((await call('GET', `/salons/${slug}`)).status === 200, 'levée : la page revient');

  const cs = await call('POST', `/admin/profiles/${cliente.id}/suspend`, admin.token, { reason: motif });
  ok(cs.status === 200, `client suspendu (${cs.status})`);
  const cRefus = await call('POST', '/bookings', cliente.token, { salonId, serviceId, startsAt });
  ok(cRefus.status === 403 && cRefus.json?.error?.code === 'CLIENT_SUSPENDED', `client suspendu : réservation refusée avec un vrai message (${cRefus.status} ${cRefus.json?.error?.code})`);
  await call('POST', `/admin/profiles/${cliente.id}/unsuspend`, admin.token, {});

  console.log('\n6. Retirer l’accès coupe le jeton');
  await db.from('platform_admins').update({ disabled_at: new Date().toISOString() }).eq('user_id', admin.id);
  const coupe = await call('GET', '/pro/salon', admin.token, undefined, avec);
  ok(coupe.status === 403, `jeton en cours, accès retiré → ${coupe.status} (403 attendu)`);
} catch (err) {
  failures++;
  console.error('\nÉCHEC :', err?.message ?? err);
} finally {
  // Rien de jetable ne doit rester en production, même si l'on est arrivé ici par une erreur.
  if (salonId)
    await db.from('salons').update({ suspended_at: null, suspension_level: null, suspended_reason: null, suspended_by: null }).eq('id', salonId);
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
