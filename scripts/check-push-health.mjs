/**
 * État RÉEL des notifications en production (lecture seule) :
 *
 *   node --env-file=.env scripts/check-push-health.mjs [jours=14]
 *
 * 1. Appareils inscrits : par canal (application Android / iPhone, navigateur), par application
 *    (Salon DZ / Salon DZ Pro) et par rôle du compte — et les incohérences (jeton de l'application pro
 *    sur un compte client, et l'inverse ; comptes sans aucun appareil).
 * 2. Ce que sont devenues les notifications récentes : envoyée, aucun appareil, refusée, en échec — par
 *    rôle, par type, avec les erreurs les plus fréquentes.
 * Aucune écriture, aucune donnée personnelle affichée (des comptes, jamais des noms).
 */
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL et SUPABASE_SECRET_KEY sont requis (--env-file=.env).');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const DAYS = Number(process.argv[2] ?? 14);

async function all(table, columns, apply = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await apply(db.from(table).select(columns)).range(from, from + 999);
    if (r.error) throw r.error;
    out.push(...r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}
const kind = (t) =>
  t.startsWith('{') ? 'navigateur' : /^ExponentPushToken/.test(t) ? 'expo' : /^[0-9a-f]{64}$/i.test(t) ? 'apns' : 'fcm';
const count = (arr, key) => arr.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const show = (title, obj) => {
  console.log(`\n${title}`);
  for (const [k, v] of Object.entries(obj).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
};

const profiles = await all('profiles', 'id, role');
const role = new Map(profiles.map((p) => [p.id, p.role]));
const tokens = await all('push_tokens', 'user_id, token, platform, app_id, device_name, last_seen_at');

console.log(`Comptes : ${profiles.length} (${Object.entries(count(profiles, (p) => p.role)).map(([k, v]) => `${v} ${k}`).join(', ')})`);
show('Appareils inscrits (canal · application · rôle du compte)', count(tokens, (t) => `${kind(t.token)} · ${t.app_id ?? 'sans app_id'} · ${role.get(t.user_id) ?? '?'}`));

const mismatch = tokens.filter((t) => {
  const r = role.get(t.user_id);
  return (t.app_id === 'pro.salondz.app' && r !== 'pro') || (t.app_id === 'dz.salondz.app' && r === 'pro');
});
console.log(`\nJetons d'une application sur un compte de l'autre type : ${mismatch.length}`);
const fresh = tokens.filter((t) => Date.now() - new Date(t.last_seen_at).getTime() < 30 * 86_400_000);
console.log(`Appareils vus depuis 30 jours : ${fresh.length} sur ${tokens.length}`);
const withDevice = new Set(tokens.map((t) => t.user_id));
for (const r of ['client', 'pro']) {
  const ids = profiles.filter((p) => p.role === r).map((p) => p.id);
  console.log(`Comptes ${r} avec au moins un appareil : ${ids.filter((id) => withDevice.has(id)).length} sur ${ids.length}`);
}

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
const notifs = await all('notifications', 'user_id, type, push_outcome, push_attempts, push_error, pushed_at, read_at, created_at', (q) => q.gte('created_at', since));
console.log(`\nNotifications des ${DAYS} derniers jours : ${notifs.length}`);
show('Résultat de l\'envoi (rôle · résultat)', count(notifs, (n) => `${role.get(n.user_id) ?? '?'} · ${n.push_outcome ?? (n.pushed_at ? 'pris, sans résultat' : 'pas encore envoyée')}`));
show('Par type (type · résultat)', count(notifs, (n) => `${n.type} · ${n.push_outcome ?? '—'}`));
const errs = notifs.filter((n) => n.push_error);
show('Erreurs les plus fréquentes', count(errs, (n) => n.push_error.slice(0, 90)));
const stuck = notifs.filter((n) => !n.pushed_at && Date.now() - new Date(n.created_at).getTime() > 15 * 60_000);
console.log(`\nNotifications jamais prises en charge (plus de 15 min) : ${stuck.length}`);
