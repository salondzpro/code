#!/usr/bin/env node
/**
 * Applique les migrations SQL de supabase/migrations/ dans l'ordre, une transaction par fichier.
 * Suivi dans public.schema_migrations. Usage :
 *   node --env-file=.env scripts/db-migrate.mjs           # applique les migrations en attente
 *   node --env-file=.env scripts/db-migrate.mjs --status  # liste l'état
 *   node --env-file=.env scripts/db-migrate.mjs --reset   # DANGER : drop schema public + réapplique
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../supabase/migrations');
const args = new Set(process.argv.slice(2));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant (lance avec: node --env-file=.env scripts/db-migrate.mjs)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  if (args.has('--reset')) {
    if (process.env.ALLOW_DB_RESET !== 'yes') {
      console.error('Refusé : définis ALLOW_DB_RESET=yes pour confirmer le reset complet du schéma public.');
      process.exit(1);
    }
    console.warn('⚠️  Reset du schéma public…');
    await client.query(`
      drop schema public cascade;
      create schema public;
      grant usage on schema public to postgres, anon, authenticated, service_role;
      grant all on schema public to postgres, service_role;
      alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
      alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
      drop trigger if exists on_auth_user_created on auth.users;
      delete from storage.objects where bucket_id in ('salons','avatars');
      delete from storage.buckets where id in ('salons','avatars');
      do $$ declare p record; begin
        for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
          execute format('drop policy if exists %I on storage.objects', p.policyname);
        end loop;
      end $$;
    `);
  }

  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
  `);

  const { rows } = await client.query('select name from public.schema_migrations order by name');
  const applied = new Set(rows.map((r) => r.name));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  if (args.has('--status')) {
    for (const f of files) console.log(`${applied.has(f) ? '✅' : '⏳'} ${f}`);
    process.exit(0);
  }

  let n = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = await readFile(path.join(migrationsDir, f), 'utf8');
    process.stdout.write(`→ ${f} … `);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public.schema_migrations (name) values ($1)', [f]);
      await client.query('commit');
      console.log('ok');
      n++;
    } catch (e) {
      await client.query('rollback');
      console.log('ÉCHEC');
      console.error(e.message);
      if (e.position) {
        const pos = Number(e.position);
        const line = sql.slice(0, pos).split('\n').length;
        console.error(`  (ligne ~${line} de ${f})`);
      }
      process.exit(1);
    }
  }
  console.log(n === 0 ? 'Aucune migration en attente.' : `${n} migration(s) appliquée(s).`);
} finally {
  await client.end();
}
