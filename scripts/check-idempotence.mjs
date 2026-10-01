/**
 * L'idempotence tient-elle VRAIMENT ? Contre la production, avec un compte jetable.
 *
 *   node --env-file=.env scripts/check-idempotence.mjs
 *
 * Trois cas, qui sont exactement ceux d'un réseau qui lâche :
 *   1. même clé, même corps        → la réponse d'origine est rejouée, rien n'est recréé ;
 *   2. même clé, corps différent   → 422 : ce n'est pas une reprise, c'est une faute d'appel ;
 *   3. aucune clé                  → la requête passe comme avant (l'idempotence est offerte).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.salondz.com/v1';
const SB = process.env.VITE_SUPABASE_URL;
const CLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const texte = fs.readFileSync(path.join(ROOT, 'secrets', 'store-review.txt'), 'utf8');
const [, email, mdp] = /(\S+@salondz\.com)\s*\/\s*(\S+)/.exec(texte) ?? [];
const auth = await (
  await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: mdp }),
  })
).json();
if (!auth.access_token) throw new Error('connexion impossible : ' + JSON.stringify(auth).slice(0, 200));

const appel = (corps, cle) =>
  fetch(`${API}/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
      ...(cle ? { 'Idempotency-Key': cle } : {}),
    },
    body: JSON.stringify(corps),
  });

const k = `verif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nom = `Relecteur Client`;

const a = await appel({ fullName: nom }, k);
console.log(`1er envoi            ${a.status}`);
const b = await appel({ fullName: nom }, k);
console.log(`reprise, même corps  ${b.status} · rejouée : ${b.headers.get('idempotency-replayed') ?? 'non'}`);
const c = await appel({ fullName: 'Autre nom' }, k);
console.log(`même clé, autre corps ${c.status} · ${(await c.json().catch(() => ({})))?.error?.code ?? ''}`);
const d = await appel({ fullName: nom }, null);
console.log(`sans clé             ${d.status}`);

const ok = a.status === 200 && b.headers.get('idempotency-replayed') === 'true' && c.status === 422 && d.status === 200;
console.log(ok ? '\n✔ idempotence vérifiée' : '\n✖ comportement inattendu');
process.exitCode = ok ? 0 : 1;
