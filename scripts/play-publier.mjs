/**
 * Publie le dernier .aab sur Google Play, sans passer par Play Console.
 *
 *   node scripts/play-publier.mjs                         → « Salon DZ » (dz.salondz.app), piste production
 *   node scripts/play-publier.mjs --pro                   → « Salon DZ Pro » (pro.salondz.app)
 *   node scripts/play-publier.mjs --piste internal        → test interne au lieu de la production
 *   node scripts/play-publier.mjs --verifier              → teste l'accès, n'envoie rien
 *
 * Le fichier envoyé est le .aab au plus grand numéro de version dans Desktop/salondz-play, là où
 * `build-android.mjs` le dépose. Google refuse un numéro déjà envoyé : rien n'est renvoyé deux fois.
 *
 * ACCÈS (une fois, par le propriétaire — aucune API ne le fait à sa place) :
 *   1. Google Cloud, projet du compte de service : activer « Google Play Android Developer API ».
 *   2. Play Console → Utilisateurs et autorisations → inviter l'adresse du compte de service, avec
 *      « Publier en production » et « Gérer les versions de test » sur les deux applications.
 * Compte de service lu dans `secrets/play-service-account.json`, à défaut `secrets/fcm-service-account.json`.
 *
 * Une version de production passe par l'examen de Google (quelques heures à quelques jours), puis
 * sort seule — sauf si la « publication gérée » est activée dans Play Console.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const arg = (n) => process.argv.includes(n);
const val = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PRO = arg('--pro');
const PAQUET = PRO ? 'pro.salondz.app' : 'dz.salondz.app';
const PISTE = val('--piste', 'production');
const VERIFIER = arg('--verifier');
const NOTES = PRO
  ? 'Notifications : si elles sont coupées sur votre téléphone, l’application le détecte et un bouton vous emmène directement à leur réglage. Corrections et améliorations de stabilité.'
  : 'Notifications : si elles sont coupées sur votre téléphone, l’application le détecte et un bouton vous emmène directement à leur réglage. Vos rappels reprennent dès votre retour.';

const SECRETS = path.resolve(import.meta.dirname, '..', 'secrets');
const fichierCompte = ['play-service-account.json', 'fcm-service-account.json'].map((f) => path.join(SECRETS, f)).find((f) => fs.existsSync(f));
if (!fichierCompte) { console.log('✖ aucun compte de service dans secrets/'); process.exit(1); }
const sa = JSON.parse(fs.readFileSync(fichierCompte, 'utf8'));

async function jeton() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  const u = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 });
  const jwt = u + '.' + crypto.sign('RSA-SHA256', Buffer.from(u), sa.private_key).toString('base64url');
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
  if (!r.access_token) throw new Error('jeton refusé : ' + JSON.stringify(r));
  return r.access_token;
}
const TOKEN = await jeton();
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAQUET}`;
async function g(method, url, body, headers = {}) {
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + TOKEN, ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j.error?.message ?? r.status;
    if (r.status === 403 && /has not been used|disabled/.test(m)) console.log('✖ API Google Play non activée sur le projet du compte de service (étape 1 de l’en-tête).');
    else if (r.status === 401 || r.status === 403) console.log(`✖ ${sa.client_email} n’a pas accès à ${PAQUET} dans Play Console (étape 2 de l’en-tête).`);
    throw new Error(`${method} ${url.replace(BASE, '')} → ${r.status} ${m}`);
  }
  return j;
}

console.log(`${PAQUET} · piste ${PISTE} · compte ${sa.client_email}`);
let edit;
try {
  edit = await g('POST', `${BASE}/edits`);
} catch (e) {
  console.log('✖', e.message);
  process.exit(1);
}
try {
  if (VERIFIER) {
    const pistes = await g('GET', `${BASE}/edits/${edit.id}/tracks`);
    for (const p of pistes.tracks ?? []) for (const rel of p.releases ?? []) console.log(`  ${p.track} · ${rel.status} · ${(rel.versionCodes ?? []).join(',')}`);
    console.log('✔ accès en écriture confirmé (rien envoyé)');
  } else {
    const dossier = path.join(os.homedir(), 'Desktop', 'salondz-play');
    const motif = PRO ? /^salon-dz-pro-.*versionCode(\d+)\.aab$/ : /^salon-dz-\d.*versionCode(\d+)\.aab$/;
    const aab = fs.readdirSync(dossier).map((f) => [f, f.match(motif)?.[1]]).filter(([, n]) => n).sort((a, b) => b[1] - a[1])[0];
    if (!aab) throw new Error('aucun .aab dans ' + dossier);
    console.log(`  envoi de ${aab[0]}…`);
    const up = await g('POST', `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PAQUET}/edits/${edit.id}/bundles?uploadType=media`, fs.readFileSync(path.join(dossier, aab[0])), { 'Content-Type': 'application/octet-stream' });
    console.log(`✔ bundle reçu : versionCode ${up.versionCode}`);
    await g('PUT', `${BASE}/edits/${edit.id}/tracks/${PISTE}`, {
      track: PISTE,
      releases: [{ versionCodes: [String(up.versionCode)], status: 'completed', releaseNotes: [{ language: 'fr-FR', text: NOTES }] }],
    });
    console.log(`✔ version placée sur la piste ${PISTE}`);
    await g('POST', `${BASE}/edits/${edit.id}:commit`);
    console.log(`\n✔ ${PRO ? 'Salon DZ Pro' : 'Salon DZ'} versionCode ${up.versionCode} envoyée sur ${PISTE} — examen de Google, puis publication.`);
    process.exit(0);
  }
} catch (e) {
  console.log('✖', e.message);
  process.exitCode = 1;
}
await fetch(`${BASE}/edits/${edit.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } }).catch(() => undefined);
