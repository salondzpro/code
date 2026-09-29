/**
 * Les comptes que le relecteur d'Apple va utiliser fonctionnent-ils VRAIMENT ?
 *
 *   node --env-file=.env scripts/check-review-accounts.mjs
 *
 * On se connecte exactement comme lui : e-mail et mot de passe, contre la production. Un compte
 * de revue qui ne s'ouvre pas, c'est un refus garanti et deux semaines perdues.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const texte = fs.readFileSync(path.join(ROOT, 'secrets', 'store-review.txt'), 'utf8');
const comptes = [...texte.matchAll(/(\S+@salondz\.com)\s*\/\s*(\S+)/g)].map((m) => ({ email: m[1], mdp: m[2] }));
if (!comptes.length) throw new Error('aucun compte trouvé dans secrets/store-review.txt');

const URL_SB = process.env.VITE_SUPABASE_URL;
const CLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API = 'https://api.salondz.com';

for (const c of comptes) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: c.mdp }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) {
    console.log('✖', c.email, '→', r.status, j.error_description ?? j.msg ?? JSON.stringify(j).slice(0, 120));
    continue;
  }
  // La session s'ouvre : reste à savoir si le profil est complet, sinon l'application renvoie
  // le relecteur sur « complétez votre profil » au lieu de lui montrer le produit.
  // `/v1/me` répond `{ profile, salon, standing }` : le profil est IMBRIQUÉ. Le lire à plat
  // renverrait « profil incomplet » sur des comptes parfaitement valables.
  const me = await fetch(`${API}/v1/me`, { headers: { Authorization: `Bearer ${j.access_token}` } });
  const { profile: p, salon } = await me.json().catch(() => ({}));
  const manque = [!p?.fullName && 'nom', !p?.phone && 'téléphone', p?.suspendedAt && 'COMPTE SUSPENDU'].filter(Boolean);
  console.log(
    '✔', c.email.padEnd(30), `rôle ${p?.role ?? '?'}`.padEnd(14),
    p?.role === 'pro' ? (salon ? `salon « ${salon.name} »` : 'AUCUN SALON') : '',
    manque.length ? `· À CORRIGER : ${manque.join(', ')}` : '· prêt pour la revue',
  );
}
