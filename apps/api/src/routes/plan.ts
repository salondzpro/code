/**
 * `salondz.com/moi` : le plan de mise en production (`docs/PRODUCTION.md`, source de vérité) lisible en
 * ligne par le propriétaire, derrière un code d'accès court (`PLAN_ACCESS_CODE`). Le site réécrit `/moi`
 * vers cette route (même mécanisme que l'aperçu de partage). Rien d'indexable, rien de mis en cache :
 * le document décrit l'état de la production et la liste de ce qui reste à faire.
 *
 * Le fichier est copié dans `dist/` à la construction (build.mjs, Dockerfile) ; en développement on lit
 * directement `docs/PRODUCTION.md` du dépôt.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Jeton du cookie : dérivé du code et du secret du cron (jamais le code lui-même). */
const token = (code: string) => createHash('sha256').update(`moi:${code}:${config.INTERNAL_CRON_TOKEN}`).digest('hex');
const sameToken = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function loadPlan(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, 'PRODUCTION.md'), resolve(here, '../../../../docs/PRODUCTION.md'), resolve(process.cwd(), 'docs/PRODUCTION.md'), resolve(process.cwd(), '../../docs/PRODUCTION.md')];
  for (const p of candidates) {
    try {
      return await readFile(p, 'utf8');
    } catch {
      /* suivant */
    }
  }
  throw new Error('PRODUCTION.md introuvable');
}

/** Mise en forme en ligne : code, gras, barré, liens. Le texte est échappé AVANT les balises. */
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');
}

/** Markdown → HTML pour ce document : titres, paragraphes, listes, tableaux, filets. */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const isTable = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i]!;
    if (!l.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!;
      const id = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(l)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (isTable(l) && i + 1 < lines.length && isSep(lines[i + 1]!)) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTable(lines[i]!)) rows.push(cells(lines[i++]!));
      out.push(
        `<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l);
    if (li) {
      const ordered = /\d/.test(li[2]!);
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]!);
        if (!m || /\d/.test(m[2]!) !== ordered) break;
        let text = m[3]!;
        i++;
        // Lignes de continuation (indentées, sans puce).
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) text += ' ' + lines[i++]!.trim();
        const num = ordered ? /^(\d+)\./.exec(m[2]!)?.[1] : undefined;
        items.push(`<li${num ? ` value="${num}"` : ''}>${inline(text)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    // Paragraphe : lignes consécutives non vides et non structurées.
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4})\s/.test(lines[i]!) && !isTable(lines[i]!) && !/^(\s*)([-*]|\d+\.)\s+/.test(lines[i]!)) para.push(lines[i++]!.trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const CSS = `
:root{color-scheme:light;--ink:#111214;--muted:#5f6368;--line:#e4e5e7;--soft:#f5f5f6;--accent:#1c8a5a}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:56rem;margin:0 auto;padding:1.5rem 1rem 4rem}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 .25rem;letter-spacing:-.02em}h2{font-size:1.25rem;margin:2.25rem 0 .75rem;padding-top:1.25rem;border-top:1px solid var(--line)}h3{font-size:1.05rem;margin:1.5rem 0 .5rem}
p{margin:.5rem 0}ul,ol{padding-inline-start:1.4rem;margin:.5rem 0}li{margin:.35rem 0}li::marker{color:var(--muted)}
code{font:.9em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:.1em .35em}
s{color:var(--muted)}a{color:var(--accent)}
.tbl{overflow-x:auto;margin:.75rem 0;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;min-width:32rem;font-size:.95em}
th,td{text-align:start;vertical-align:top;padding:.55rem .7rem;border-bottom:1px solid var(--line)}th{background:var(--soft);font-weight:600}tr:last-child td{border-bottom:0}
.meta{color:var(--muted);font-size:.9em;margin:0 0 1.5rem}
.gate{max-width:22rem;margin:6rem auto;padding:0 1rem}.gate h1{font-size:1.4rem}.gate p{color:var(--muted)}
input{width:100%;font:inherit;font-size:1.25rem;letter-spacing:.2em;padding:.7rem .9rem;border:1px solid var(--line);border-radius:6px;margin:.75rem 0}
button{width:100%;font:inherit;font-weight:600;padding:.8rem;border:0;border-radius:6px;background:var(--ink);color:#fff}
.err{color:#b3261e;font-weight:600}
`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

const planRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/moi', { schema: { querystring: z.object({ code: z.string().max(40).optional() }) } }, async (req, reply) => {
    reply.removeHeader('content-security-policy');
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'private, no-store');
    reply.header('X-Robots-Tag', 'noindex, nofollow');

    const expected = token(config.PLAN_ACCESS_CODE);
    const cookie = /(?:^|;\s*)moi=([a-f0-9]{64})/.exec(req.headers.cookie ?? '')?.[1];
    const opened = !!cookie && sameToken(cookie, expected);

    // Code soumis : bon → cookie (30 jours) et retour sur /moi sans le code dans l'adresse ; mauvais → formulaire.
    if (req.query.code !== undefined && !opened) {
      if (sameToken(token(req.query.code.trim()), expected)) {
        reply.header('Set-Cookie', `moi=${expected}; Path=/moi; Max-Age=2592000; HttpOnly; SameSite=Lax${config.isProd ? '; Secure' : ''}`);
        return reply.redirect('/moi', 303);
      }
      req.log.warn({ ip: req.ip }, 'plan: mauvais code');
      return reply.status(401).send(page('Salon DZ', gate(true)));
    }
    if (!opened) return reply.status(401).send(page('Salon DZ', gate(false)));

    const md = await loadPlan();
    const updated = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Algiers' }).format(new Date());
    return page(
      'Salon DZ — reste à faire',
      `<main><p class="meta">Salon DZ · document interne · affiché le ${esc(updated)} · <code>docs/PRODUCTION.md</code> dans le dépôt fait foi</p>${renderMarkdown(md)}</main>`,
    );
  });
};

function gate(wrong: boolean): string {
  return `<form class="gate" method="get" action="/moi"><h1>Salon DZ</h1><p>Document interne : entrez le code d'accès.</p>${
    wrong ? '<p class="err">Code incorrect.</p>' : ''
  }<input name="code" inputmode="numeric" autocomplete="one-time-code" autofocus aria-label="Code d'accès"><button type="submit">Ouvrir</button></form>`;
}

export default planRoutes;
