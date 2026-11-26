/** Clés de `i18n/keys.json` absentes de ar.ts ou en.ts (audit du 26 nov. 2026). `node scripts/i18n-manquants.mjs [--liste]` */
import fs from 'node:fs';
const dir = new URL('../apps/web/src/i18n/', import.meta.url);
const liste = JSON.parse(fs.readFileSync(new URL('keys.json', dir), 'utf8'));
const RE = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm;
const lire = (q, s) => (q === '"' ? JSON.parse(`"${s}"`) : s.replace(/\\(.)/g, '$1'));
for (const l of ['ar', 'en']) {
  const src = fs.readFileSync(new URL(`${l}.ts`, dir), 'utf8');
  const cles = new Set([...src.matchAll(RE)].map((m) => lire(m[1], m[2])));
  const manque = liste.filter((k) => !cles.has(k));
  console.log(`${l}: ${manque.length} manquante(s)`);
  if (process.argv.includes('--liste')) for (const k of manque) console.log('  ' + JSON.stringify(k));
}
