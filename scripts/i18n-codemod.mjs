/**
 * Transformation automatique des textes de l'interface web en appels `t('…')`.
 *
 *   node scripts/i18n-codemod.mjs            → réécrit apps/web/src/**\/*.tsx
 *   node scripts/i18n-codemod.mjs --dry      → liste seulement ce qui serait remplacé
 *   node scripts/i18n-codemod.mjs --keys     → imprime les clés françaises trouvées (t('…'))
 *
 * S'appuie sur l'analyseur TypeScript (pas de regex sur du JSX) : nœuds JsxText contenant des
 * lettres, attributs texte (placeholder, aria-label, title, label, hint, alt, subtitle,
 * description, name), chaînes de certaines propriétés d'objets (label, hint, title, text,
 * subtitle, description, placeholder) et appels setError('…'). Ajoute l'import `t`.
 * Idempotent : un texte déjà dans `t(...)` n'est pas retouché.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'apps', 'web', 'src');
const DRY = process.argv.includes('--dry');
const KEYS = process.argv.includes('--keys');
const ATTRS = new Set(['placeholder', 'aria-label', 'title', 'label', 'hint', 'alt', 'subtitle', 'description']);
const PROPS = new Set(['label', 'hint', 'title', 'text', 'subtitle', 'description', 'placeholder', 'msg']);
const LETTER = /[A-Za-zÀ-ÿ]/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'i18n') continue;
      walk(p, out);
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const decode = (s) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const lit = (s) => JSON.stringify(s);

/** Texte JSX → segments significatifs (JSX supprime les blancs contenant un retour à la ligne aux bords). */
function jsxTextParts(raw) {
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  const core = raw.slice(lead.length, raw.length - trail.length);
  if (!core || !LETTER.test(core)) return null;
  const text = decode(core.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' '));
  const keepLead = lead.length > 0 && !lead.includes('\n');
  const keepTrail = trail.length > 0 && !trail.includes('\n');
  return { text, keepLead, keepTrail, lead, trail };
}

const allKeys = new Set();
let filesChanged = 0;
let replacements = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const parts = jsxTextParts(node.getText(sf));
      if (parts) {
        // Un texte réduit à de la ponctuation ou une unité ne se traduit pas (« · », « DA »).
        if (/^[\s·•–—:,.()\d%+/-]*$/.test(parts.text) || parts.text === 'DA') return;
        const rep =
          (parts.keepLead ? "{' '}" : '') + `{t(${lit(parts.text)})}` + (parts.keepTrail ? "{' '}" : '');
        // Conserver les retours à la ligne des bords pour la lisibilité du code.
        const leadNl = parts.lead.includes('\n') ? parts.lead : '';
        const trailNl = parts.trail.includes('\n') ? parts.trail : '';
        edits.push({ start: node.getStart(sf), end: node.getEnd(), rep: leadNl + rep + trailNl });
        allKeys.add(parts.text);
      }
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf);
      const value = node.initializer.text;
      if (ATTRS.has(name) && LETTER.test(value) && value.length > 1) {
        edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(), rep: `{t(${lit(value)})}` });
        allKeys.add(value);
      }
      return;
    }
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
      const value = node.initializer.text;
      if (PROPS.has(name) && LETTER.test(value) && value.length > 1 && !/^[a-z_]+$/.test(value)) {
        edits.push({ start: node.initializer.getStart(sf), end: node.initializer.getEnd(), rep: `t(${lit(value)})` });
        allKeys.add(value);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      /^(setError|setErr|setMsg|setFlash)$/.test(node.expression.text) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      LETTER.test(node.arguments[0].text)
    ) {
      const a = node.arguments[0];
      edits.push({ start: a.getStart(sf), end: a.getEnd(), rep: `t(${lit(a.text)})` });
      allKeys.add(a.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.rep + out.slice(e.end);
  if (!/from '@\/i18n'/.test(out)) {
    // Après la DERNIÈRE déclaration d'import (fin réelle, même sur plusieurs lignes), en
    // tenant compte du décalage introduit par les remplacements situés avant.
    const imports = sf.statements.filter((s) => ts.isImportDeclaration(s));
    const last = imports[imports.length - 1];
    const shift = last
      ? edits.filter((e) => e.start < last.getEnd()).reduce((a, e) => a + (e.rep.length - (e.end - e.start)), 0)
      : 0;
    const at = last ? last.getEnd() + shift + 1 : 0;
    out = out.slice(0, at) + "import { t } from '@/i18n';\n" + out.slice(at);
  }
  replacements += edits.length;
  filesChanged++;
  if (DRY) console.log(path.relative(ROOT, file), edits.length);
  else fs.writeFileSync(file, out);
}

if (KEYS) {
  for (const k of [...allKeys].sort()) console.log(k);
} else {
  console.log(`${replacements} remplacement(s) dans ${filesChanged} fichier(s)${DRY ? ' (simulation)' : ''}`);
}
