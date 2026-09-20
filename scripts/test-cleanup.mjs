/**
 * Ramasse les comptes laissés par les suites de test.
 *
 * Les scénarios e2e créent des comptes jetables `e2e-…@salondz.test` / `smoke-…@salondz.test` et
 * les suppriment dans un `finally`. Un `finally` ne s'exécute pas quand le processus est TUÉ — ce
 * qui arrive régulièrement sur une machine de 8 Go (voir CLAUDE.md). Onze salons de test se sont
 * ainsi retrouvés PUBLIÉS sur la place de marché en production, découverts le 20 septembre 2026
 * par le tout nouvel espace d'administration.
 *
 *   node --env-file=.env scripts/test-cleanup.mjs         → liste, ne supprime rien
 *   node --env-file=.env scripts/test-cleanup.mjs --yes   → supprime
 *
 * La suppression du compte emporte le profil, le salon, le catalogue, l'équipe et les rendez-vous
 * (cascades de la migration 0001). Le domaine `@salondz.test` n'existe pas : aucun compte réel ne
 * peut porter cette adresse.
 */
import { createClient } from '@supabase/supabase-js';

const DOMAINE = '@salondz.test';
const vasy = process.argv.includes('--yes');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL et SUPABASE_SECRET_KEY sont nécessaires (node --env-file=.env …).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Tous les comptes, page par page : `listUsers` en rend 50 par défaut. */
async function tousLesComptes() {
  const out = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}

const comptes = (await tousLesComptes()).filter((u) => (u.email ?? '').endsWith(DOMAINE));
if (comptes.length === 0) {
  console.log('Aucun compte de test à ramasser.');
  process.exit(0);
}

const ids = comptes.map((u) => u.id);
const salons = await db.from('salons').select('id, name, slug, is_published').in('owner_id', ids);
if (salons.error) throw salons.error;

console.log(`${comptes.length} compte(s) de test ${DOMAINE} :`);
for (const u of comptes) console.log('  ', u.email, '·', u.created_at?.slice(0, 10));
console.log(`\n${salons.data.length} salon(s) rattaché(s) :`);
for (const s of salons.data) console.log('  ', s.is_published ? 'PUBLIÉ ' : 'brouillon', s.name, '·', s.slug);

if (!vasy) {
  console.log('\nRien n’a été supprimé. Relancer avec --yes pour supprimer.');
  process.exit(0);
}

let ok = 0;
for (const u of comptes) {
  const { error } = await db.auth.admin.deleteUser(u.id);
  if (error) console.log('  échec', u.email, ':', error.message);
  else ok += 1;
}
console.log(`\n${ok}/${comptes.length} compte(s) supprimé(s), salons et rendez-vous compris.`);
