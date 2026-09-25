// Comptes de démonstration (hommes@, femmes@, clienthomme@, clientfemme@ salondz.com).
//   pnpm demo:seed              → ouvre les quatre comptes par l'API (qui construit salons, catalogues,
//                                 historiques) et affiche un résumé ; idempotent
//   pnpm demo:cleanup           → supprime les quatre comptes (cascade : salons, rendez-vous, avis…)
//   pnpm demo:seed --purge-legacy → supprime aussi les anciens comptes de test (*@salondz.test)
// Requiert l'API (locale par défaut, `API_URL=https://api.salondz.com` pour la prod) et `.env`.
import { createClient } from '@supabase/supabase-js';

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 8090}`;
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY manquants (lancer via pnpm demo:seed)');
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Recopiés de packages/constants/src/demo.ts (les paquets TypeScript ne s'importent pas depuis un .mjs).
const EMAILS = ['pro-homme@salondz.com', 'pro-femme@salondz.com', 'client@salondz.com', 'clientfemme@salondz.internal'];

async function findByEmail(email) {
  const { data, error } = await admin.rpc('auth_user_by_email', { p_email: email });
  if (error) throw error;
  return data?.[0] ?? null;
}

async function deleteUser(email) {
  const u = await findByEmail(email);
  if (!u) return false;
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) throw error;
  return true;
}

if (process.argv.includes('--cleanup')) {
  for (const email of EMAILS) console.log(`${(await deleteUser(email)) ? 'supprimé' : 'absent  '} ${email}`);
  process.exit(0);
}

if (process.argv.includes('--purge-legacy')) {
  // Anciens comptes de test et de démonstration : adresses techniques *@salondz.test.
  let page = 1;
  let n = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith('@salondz.test')) {
        const { error: e } = await admin.auth.admin.deleteUser(u.id);
        if (e) throw e;
        n++;
        console.log(`supprimé ${u.email}`);
      }
    }
    if (data.users.length < 200) break;
    page++;
  }
  console.log(`${n} ancien(s) compte(s) supprimé(s)`);
}

const health = await fetch(`${API}/health`).catch(() => null);
if (!health?.ok) throw new Error(`API injoignable sur ${API} : lancer pnpm dev:api`);

for (const email of EMAILS) {
  const res = await fetch(`${API}/v1/auth/dev-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`dev-login ${email} → ${res.status} ${JSON.stringify(json)}`);
  const me = await fetch(`${API}/v1/me`, { headers: { authorization: `Bearer ${json.accessToken}` } }).then((r) => r.json());
  const p = me.profile;
  let detail = '';
  if (json.role === 'pro') {
    const s = await fetch(`${API}/v1/pro/salon`, { headers: { authorization: `Bearer ${json.accessToken}` } }).then((r) => r.json());
    const noPhoto = (s.salon?.services ?? []).filter((x) => !(x.photos ?? []).length).map((x) => x.name);
    detail = `salon « ${s.salon?.name} » (${s.salon?.slug}) · ${s.salon?.services?.length ?? 0} prestations · ${s.salon?.staff?.length ?? 0} membres${noPhoto.length ? ` · SANS PHOTO : ${noPhoto.join(', ')}` : ''}`;
  } else {
    const up = await fetch(`${API}/v1/me/bookings?scope=upcoming`, { headers: { authorization: `Bearer ${json.accessToken}` } }).then((r) => r.json());
    const past = await fetch(`${API}/v1/me/bookings?scope=past`, { headers: { authorization: `Bearer ${json.accessToken}` } }).then((r) => r.json());
    detail = `${(up.items ?? []).length} à venir · ${(past.items ?? []).length} passés`;
  }
  console.log(`✔ ${email} → ${p.fullName} (${p.role}) · ${detail}`);
}
