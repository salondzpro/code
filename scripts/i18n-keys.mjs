/**
 * Liste les phrases françaises passées à t('…') dans le web, et celles des dictionnaires
 * qui n'existent plus dans le code (à retirer). Sortie JSON triée sur stdout.
 *   node scripts/i18n-keys.mjs > apps/web/src/i18n/keys.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'apps', 'web', 'src');
const keys = new Map();
const RE = /\bt\(\s*("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'i18n') walk(p);
      continue;
    }
    if (!/\.tsx?$/.test(e.name)) continue;
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(RE)) {
      const raw = m[2] ?? m[3];
      // Décodage des échappements JS (\' et \") sans évaluer autre chose.
      const k = raw.replace(/\\(['"\\])/g, '$1');
      keys.set(k, (keys.get(k) ?? 0) + 1);
    }
  }
}
walk(ROOT);
const list = [...keys.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
process.stdout.write(JSON.stringify(list, null, 0));
console.error(`${list.length} clés`);
