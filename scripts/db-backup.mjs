// Sauvegarde gratuite de la base (pg_dump) dans ./backups, en attendant le plan Supabase Pro.
//   pnpm db:backup            → backups/salondz-AAAA-MM-JJ-HHMM.dump (format custom, compressé)
//   pg_restore --list fichier → vérifier ; restauration : pg_restore -d "$DATABASE_URL_CIBLE" --clean --if-exists fichier
// Lit DATABASE_URL dans .env. Cherche pg_dump dans le PATH puis dans l'installation PostgreSQL de Windows.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquante (lancer avec --env-file=.env).');
  process.exit(1);
}
const candidates = ['pg_dump', ...[18, 17, 16].map((v) => `C:/Program Files/PostgreSQL/${v}/bin/pg_dump.exe`)];
const bin = candidates.find((c) => c === 'pg_dump' ? spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0 : existsSync(c));
if (!bin) {
  console.error('pg_dump introuvable : installer PostgreSQL (client) ou l’ajouter au PATH.');
  process.exit(1);
}
mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const out = join('backups', `salondz-${stamp}.dump`);
// Schéma public + auth (utilisateurs) : ce sont les données de Salon DZ. Les schémas gérés par la
// plateforme (storage, realtime, extensions) sont recréés par le projet cible.
const args = ['--format=custom', '--no-owner', '--no-privileges', '--schema=public', '--schema=auth', '--file', out, url];
const r = spawnSync(bin, args, { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('pg_dump a échoué.');
  process.exit(r.status ?? 1);
}
const size = statSync(out).size;
console.log(`✔ ${out} (${(size / 1024).toFixed(0)} Ko)`);
const all = readdirSync('backups').filter((f) => f.endsWith('.dump')).sort();
if (all.length > 14) console.log(`${all.length} sauvegardes dans ./backups : pensez à archiver les plus anciennes ailleurs (disque externe, cloud personnel).`);
