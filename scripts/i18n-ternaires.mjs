/**
 * Textes d'interface AFFICHÉS par une expression JSX (`{x ? 'Envoi…' : 'Ajouter'}`, `{a || 'Texte'}`)
 * sans passer par `t()` — `i18n-codemod.mjs` ne les voit pas, et ils restaient en français en arabe
 * et en anglais (audit du 26 nov. 2026).
 *   node scripts/i18n-ternaires.mjs          → liste
 *   node scripts/i18n-ternaires.mjs --fix    → enveloppe dans t() (ajoute l'import si besoin)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'src');
const FIX = process.argv.includes('--fix');
const TEXTE = /[A-Za-zÀ-ÿ]{2,}/;
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['demo', 'i18n'].includes(e.name)) walk(p, o); } else if (p.endsWith('.tsx')) o.push(p);
  }
  return o;
};
let total = 0;
for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const feuilles = (n) => {
    if (ts.isParenthesizedExpression(n)) return feuilles(n.expression);
    if (ts.isConditionalExpression(n)) return [...feuilles(n.whenTrue), ...feuilles(n.whenFalse)];
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(n.operatorToken.kind)) return [n.right];
    return [n];
  };
  const visit = (n) => {
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      for (const l of feuilles(n.expression)) {
        if ((ts.isStringLiteral(l) || ts.isNoSubstitutionTemplateLiteral(l)) && TEXTE.test(l.text) && !/^[a-z-]+$/.test(l.text) && !l.text.includes('{')) hits.push(l);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!hits.length) continue;
  total += hits.length;
  for (const h of hits) console.log(`${path.relative(ROOT, f)}:${sf.getLineAndCharacterOfPosition(h.getStart()).line + 1}  ${h.getText()}`);
  if (FIX) {
    let out = src;
    for (const h of [...hits].sort((a, b) => b.getStart() - a.getStart())) out = out.slice(0, h.getStart()) + `t(${h.getText()})` + out.slice(h.getEnd());
    if (!/import \{[^}]*\bt\b[^}]*\} from '@\/i18n'/.test(out)) {
      const i = out.indexOf('\nimport ');
      out = out.slice(0, i) + "\nimport { t } from '@/i18n';" + out.slice(i);
    }
    fs.writeFileSync(f, out);
  }
}
console.log(`${total} texte(s)`);
