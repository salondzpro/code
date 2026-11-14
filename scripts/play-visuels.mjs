/**
 * Remplace les VISUELS de la fiche Google Play (14 nov. 2026) : captures téléphone, tablette 7 et
 * 10 pouces, et image de présentation 1024×500, dans CHAQUE langue de la fiche.
 *
 *   node scripts/play-visuels.mjs            → « Salon DZ » (dz.salondz.app)
 *   node scripts/play-visuels.mjs --pro      → « Salon DZ Pro » (pro.salondz.app)
 *   node scripts/play-visuels.mjs --verifier → dit ce qui est en ligne, n'envoie rien
 *
 * Les fichiers viennent de `apps/web/android/store/<client|pro>/` (produits par
 * `make-store-visuals.mjs`), dans l'ordre des noms : c'est l'ordre d'affichage. Tout passe par UNE
 * modification (« edit ») : on retire les anciennes images d'un type, on envoie les nouvelles, puis on
 * valide d'un coup. Une erreur en route abandonne la modification : la fiche n'est jamais à moitié.
 * Même compte de service que `play-publier.mjs` (`secrets/`).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PRO = process.argv.includes('--pro');
const VERIFIER = process.argv.includes('--verifier');
const PAQUET = PRO ? 'pro.salondz.app' : 'dz.salondz.app';
const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'apps', 'web', 'android', 'store', PRO ? 'pro' : 'client');
const TYPES = [
  { type: 'phoneScreenshots', dossier: 'telephone' },
  { type: 'sevenInchScreenshots', dossier: 'tablette-7' },
  { type: 'tenInchScreenshots', dossier: 'tablette-10' },
  { type: 'featureGraphic', fichier: 'image-de-presentation-1024x500.png' },
];

const SECRETS = path.join(ROOT, 'secrets');
const compte = ['play-service-account.json', 'fcm-service-account.json'].map((f) => path.join(SECRETS, f)).find((f) => fs.existsSync(f));
if (!compte) throw new Error('aucun compte de service dans secrets/');
const sa = JSON.parse(fs.readFileSync(compte, 'utf8'));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const t0 = Math.floor(Date.now() / 1000);
const corps = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: t0, exp: t0 + 3600 });
const jwt = corps + '.' + crypto.sign('RSA-SHA256', Buffer.from(corps), sa.private_key).toString('base64url');
const jet = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
if (!jet.access_token) throw new Error('jeton refusé : ' + JSON.stringify(jet));

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUET}`;
const UP = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PAQUET}`;
async function g(method, url, body, type) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + jet.access_token, ...(type ? { 'Content-Type': type } : body ? { 'Content-Type': 'application/json' } : {}) },
    body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url.replace(API, '').replace(UP, '')} → ${r.status} ${j.error?.message ?? ''}`);
  return j;
}

const edit = await g('POST', `${API}/edits`);
const E = `${API}/edits/${edit.id}`;
try {
  const langues = ((await g('GET', `${E}/listings`)).listings ?? []).map((l) => l.language);
  console.log(`${PAQUET} · langues de la fiche : ${langues.join(', ')}`);
  for (const lang of langues) {
    for (const t of TYPES) {
      const enLigne = (await g('GET', `${E}/listings/${lang}/${t.type}`)).images ?? [];
      if (VERIFIER) {
        console.log(`  ${lang} · ${t.type} : ${enLigne.length} image(s)`);
        continue;
      }
      const fichiers = t.fichier ? [path.join(SOURCE, t.fichier)] : fs.readdirSync(path.join(SOURCE, t.dossier)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(SOURCE, t.dossier, f));
      if (!fichiers.length || !fichiers.every((f) => fs.existsSync(f))) throw new Error(`visuels manquants pour ${t.type} dans ${SOURCE}`);
      await g('DELETE', `${E}/listings/${lang}/${t.type}`);
      for (const f of fichiers) await g('POST', `${UP}/edits/${edit.id}/listings/${lang}/${t.type}?uploadType=media`, fs.readFileSync(f), 'image/png');
      console.log(`  ✔ ${lang} · ${t.type} : ${enLigne.length} → ${fichiers.length}`);
    }
  }
  if (VERIFIER) {
    await g('DELETE', E);
    console.log('rien envoyé');
  } else {
    await g('POST', `${E}:commit`);
    console.log(`✔ visuels de ${PAQUET} remplacés`);
  }
} catch (e) {
  await g('DELETE', E).catch(() => {});
  console.log('✖', e.message, '— modification abandonnée, la fiche est intacte');
  process.exit(1);
}
