/**
 * Prépare la REVUE des boutiques d'applications : un salon de démonstration publié, et deux comptes que les
 * relecteurs d'Apple et de Google utilisent pour essayer l'application (une cliente, un professionnel).
 *
 *   node --env-file=.env scripts/store-review.mjs            → crée ce qui manque, ne touche à rien d'existant
 *   node --env-file=.env scripts/store-review.mjs --reset    → regénère les mots de passe
 *   node --env-file=.env scripts/store-review.mjs --remove   → supprime le salon et les deux comptes
 *
 * Pourquoi : Apple et Google exigent un identifiant de test quand l'accès demande un compte, et une
 * application ouverte sur une place de marché VIDE est refusée (contenu absent). Depuis le nettoyage du 21
 * septembre 2026 la place de marché n'a aucun salon publié.
 *
 * Choix assumés :
 *   • le salon s'appelle « Salon Démonstration » et le dit dans sa description : un vrai client qui le trouve
 *     ne doit pas croire à un vrai salon. Aucun avis n'est fabriqué (un faux avis reste un faux, même sur un
 *     salon de démonstration) ;
 *   • la réservation y est confirmée d'office, pour que le relecteur voie le parcours complet d'un coup ;
 *   • le salon reste publié le temps de la revue, puis on le retire (`--remove`) ou on le laisse jusqu'à ce que
 *     de vrais salons existent : à décider avec le propriétaire, pas ici ;
 *   • les mots de passe sont générés, écrits UNE fois dans `secrets/store-review.txt` (hors git) et jamais
 *     affichés : ce fichier est ce qu'on colle dans « Notes pour la revue » / « Accès à l'application ».
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const API = process.env.CHECK_API_URL ?? 'https://api.salondz.com';
const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('SUPABASE_URL, SUPABASE_SECRET_KEY et SUPABASE_PUBLISHABLE_KEY sont requis (--env-file=.env).');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const reset = process.argv.includes('--reset');
const remove = process.argv.includes('--remove');

const ACCOUNTS = {
  pro: { email: 'relecteur-pro@salondz.com', name: 'Relecteur Pro', phone: '+213550100010', role: 'pro' },
  client: { email: 'relecteur-client@salondz.com', name: 'Relecteur Client', phone: '+213550100011', role: 'client' },
};
const SALON = {
  name: 'Salon Démonstration',
  description:
    'Salon de démonstration de Salon DZ, créé pour présenter l’application. Les rendez-vous pris ici sont des essais : ils ne sont pas honorés.',
  address: 'Adresse de démonstration',
  city: 'Alger Centre',
  wilayaCode: 16,
  lat: 36.7538,
  lng: 3.0588,
  genderTarget: 'unisex',
  categoryIds: ['coiffure', 'barbe', 'coiffure-lissage', 'ongles'],
  phone: '05 50 10 00 10',
};
const SERVICES = [
  { name: 'Coupe homme', durationMinutes: 30, priceDa: 800 },
  { name: 'Coupe + barbe', durationMinutes: 45, priceDa: 1200 },
  { name: 'Barbe', durationMinutes: 20, priceDa: 500 },
  { name: 'Coupe femme', durationMinutes: 45, priceDa: 2000 },
  { name: 'Brushing', durationMinutes: 30, priceDa: 1200 },
  { name: 'Pose de vernis', durationMinutes: 40, priceDa: 1500 },
];
/** Le premier membre est celui que la création du salon fait porter au propriétaire : on le renomme. */
const TEAM = ['Karim', 'Yasmine'];

async function findUser(email) {
  const r = await db.rpc('auth_user_by_email', { p_email: email });
  if (r.error) throw r.error;
  return Array.isArray(r.data) ? r.data[0]?.id : r.data?.id;
}
const password = () => `${randomBytes(9).toString('base64url')}Aa1!`;

async function login(email, pwd) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`connexion ${email} impossible`);
  return j.access_token;
}
async function api(method, p, token, body) {
  const res = await fetch(`${API}/v1${p}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 204 */
  }
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 200)}`);
  return json;
}

if (remove) {
  for (const a of Object.values(ACCOUNTS)) {
    const id = await findUser(a.email);
    if (id) {
      await db.auth.admin.deleteUser(id);
      console.log('supprimé :', a.email);
    }
  }
  console.log('Salon et comptes de revue supprimés (le salon part avec le compte professionnel).');
  process.exit(0);
}

// ---- Comptes : créés au besoin, mot de passe posé seulement à la création (ou avec --reset) ----
const creds = {};
for (const [key, a] of Object.entries(ACCOUNTS)) {
  const id = await findUser(a.email);
  const pwd = password();
  if (!id) {
    const c = await db.auth.admin.createUser({ email: a.email, password: pwd, email_confirm: true, user_metadata: { role: a.role, full_name: a.name } });
    if (c.error) throw c.error;
    creds[key] = pwd;
    console.log('créé :', a.email);
  } else if (reset) {
    const u = await db.auth.admin.updateUserById(id, { password: pwd });
    if (u.error) throw u.error;
    creds[key] = pwd;
    console.log('mot de passe régénéré :', a.email);
  } else {
    console.log('existe déjà :', a.email);
  }
}

if (Object.keys(creds).length) {
  // Un mot de passe déjà posé n'est jamais relisible : le fichier n'est écrit que quand on vient d'en poser.
  const dir = path.join(process.cwd(), 'secrets');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'store-review.txt');
  const unchanged = '(inchangé : relancer avec --reset pour le régénérer)';
  writeFileSync(
    file,
    [
      'Comptes de revue Salon DZ (Apple / Google) — à coller dans « Notes pour la revue » et « Accès à l’application ».',
      'Ne jamais committer ce fichier (dossier secrets/ ignoré par git).',
      '',
      `Cliente       : ${ACCOUNTS.client.email}  /  ${creds.client ?? unchanged}`,
      `Professionnel : ${ACCOUNTS.pro.email}  /  ${creds.pro ?? unchanged}`,
      '',
      'Salon de démonstration publié : « Salon Démonstration », Alger Centre (visible dans la marketplace, réservation confirmée d’office).',
      '',
    ].join('\n'),
  );
  console.log('Identifiants écrits dans', path.relative(process.cwd(), file));
}

// ---- Profils complets (nom et numéro obligatoires : sinon l'application renvoie vers « Vos coordonnées ») ----
const proId = await findUser(ACCOUNTS.pro.email);
const clientId = await findUser(ACCOUNTS.client.email);
for (const [id, a, market] of [[proId, ACCOUNTS.pro, null], [clientId, ACCOUNTS.client, 'men']]) {
  const r = await db.from('profiles').update({ full_name: a.name, phone: a.phone, ...(market ? { market } : {}) }).eq('id', id);
  if (r.error) throw r.error;
}

// ---- Le salon ----
const existing = await db.from('salons').select('id, slug, is_published').eq('owner_id', proId).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data) {
  console.log(`Salon déjà là : ${existing.data.slug} (${existing.data.is_published ? 'publié' : 'brouillon'})`);
} else {
  // On pilote l'API au nom du professionnel avec le mot de passe qu'on vient de poser. Un mot de passe déjà
  // posé n'est jamais relisible : dans ce cas, `--reset` est nécessaire.
  if (!creds.pro) throw new Error('mot de passe du compte professionnel inconnu : relancer avec --reset');
  const token = await login(ACCOUNTS.pro.email, creds.pro);

  const salon = await api('POST', '/pro/salon', token, SALON);
  for (const s of SERVICES) await api('POST', '/pro/services', token, s);
  await api('PATCH', `/pro/staff/${salon.staff[0].id}`, token, { displayName: TEAM[0] });
  for (const name of TEAM.slice(1)) await api('POST', '/pro/staff', token, { displayName: name, allServices: true });

  // Photos : celles de la démonstration, déjà dans le stockage (`salons/demo/…`, licence Unsplash).
  const list = await db.storage.from('salons').list('demo', { limit: 100 });
  const covers = (list.data ?? []).map((f) => f.name).filter((n) => /^cover/.test(n)).slice(0, 2);
  if (covers.length) {
    await api('PUT', '/pro/salon/photos', token, { photos: covers.map((n) => ({ url: `${SUPABASE_URL}/storage/v1/object/public/salons/demo/${n}` })) });
  } else {
    console.log('Aucune photo de démonstration trouvée dans le stockage : le salon est créé sans couverture.');
  }
  // Réservation confirmée d'office : le relecteur voit le parcours complet d'un coup.
  await api('PATCH', '/pro/salon', token, { autoConfirm: true, isPublished: true });
  console.log(`Salon créé et publié : ${salon.slug}`);
}

// ---- Contrôle : le salon est-il visible d'un visiteur ? ----
const res = await fetch(`${API}/v1/salons?wilaya=16&limit=20`);
const found = ((await res.json()).items ?? []).find((s) => s.name === SALON.name);
console.log(found ? `✔ visible dans la marketplace (${found.slug})` : '✘ PAS visible dans la marketplace : à vérifier');
process.exit(found ? 0 : 1);
