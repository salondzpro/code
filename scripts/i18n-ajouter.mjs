/**
 * Ajoute des traductions à ar.ts et en.ts depuis un fichier JSON `{ "phrase française": ["arabe", "anglais"] }`.
 * Une clé déjà présente n'est jamais réécrite.   node scripts/i18n-ajouter.mjs <fichier.json>
 */
import fs from 'node:fs';
const add = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const RE = /^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm;
const lire = (q, s) => (q === '"' ? JSON.parse(`"${s}"`) : s.replace(/\\(.)/g, '$1'));
for (const [i, l] of [[0, 'ar'], [1, 'en']]) {
  const p = new URL(`../apps/web/src/i18n/${l}.ts`, import.meta.url);
  let s = fs.readFileSync(p, 'utf8');
  const have = new Set([...s.matchAll(RE)].map((m) => lire(m[1], m[2])));
  const neuves = Object.entries(add).filter(([k]) => !have.has(k));
  const idx = s.lastIndexOf('}');
  s = s.slice(0, idx) + neuves.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[i])},\n`).join('') + s.slice(idx);
  fs.writeFileSync(p, s);
  console.log(`${l} : ${neuves.length} ajoutée(s)`);
}
