/**
 * Enregistre `pro.salondz.app` dans le projet Firebase et écrit son `google-services.json`.
 *
 *   node --env-file=.env scripts/firebase-app-pro.mjs
 *
 * POURQUOI : le greffon Google Services REFUSE de compiler si l'`applicationId` ne figure pas dans
 * `google-services.json` (« No matching client found »). La variante professionnelle a son propre
 * identifiant, il lui faut donc sa propre entrée Firebase — et c'est aussi ce qui lui donne ses
 * notifications, celles dont un professionnel a le plus besoin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAQUET = 'pro.salondz.app';
const compte = JSON.parse(process.env.FCM_SERVICE_ACCOUNT ?? '{}');
if (!compte.client_email) throw new Error('FCM_SERVICE_ACCOUNT absent : node --env-file=.env …');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const claim = b64({
  iss: compte.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
});
const nonSigne = `${b64({ alg: 'RS256', typ: 'JWT' })}.${claim}`;
const signature = createSign('RSA-SHA256').update(nonSigne).sign(compte.private_key, 'base64url');
const rep = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${nonSigne}.${signature}` }),
});
const { access_token: jeton } = await rep.json();
if (!jeton) throw new Error('jeton Google refusé : ' + JSON.stringify(await rep.text()).slice(0, 200));

const api = async (method, url, body) => {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const PROJET = `projects/${compte.project_id}`;
const liste = await api('GET', `https://firebase.googleapis.com/v1beta1/${PROJET}/androidApps`);
if (liste.status !== 200) {
  console.log('✖ lecture des applications Android :', liste.status, JSON.stringify(liste.json).slice(0, 300));
  process.exit(1);
}
for (const a of liste.json.apps ?? []) console.log(' ', a.packageName, a.appId);

let app = (liste.json.apps ?? []).find((a) => a.packageName === PAQUET);
if (!app) {
  const creation = await api('POST', `https://firebase.googleapis.com/v1beta1/${PROJET}/androidApps`, {
    packageName: PAQUET,
    displayName: 'Salon DZ Pro',
  });
  if (creation.status !== 200) {
    console.log('✖ création :', creation.status, JSON.stringify(creation.json).slice(0, 400));
    process.exit(1);
  }
  // L'opération est asynchrone : on attend qu'elle rende l'application.
  for (let i = 0; i < 20 && !app; i++) {
    await new Promise((f) => setTimeout(f, 3000));
    const r = await api('GET', `https://firebase.googleapis.com/v1beta1/${PROJET}/androidApps`);
    app = (r.json?.apps ?? []).find((a) => a.packageName === PAQUET);
  }
  if (!app) {
    console.log('✖ application créée mais introuvable après 60 s');
    process.exit(1);
  }
  console.log('✔ application Firebase créée :', app.appId);
}

const config = await api('GET', `https://firebase.googleapis.com/v1beta1/${app.name}/config`);
if (config.status !== 200) {
  console.log('✖ configuration :', config.status, JSON.stringify(config.json).slice(0, 300));
  process.exit(1);
}
const dest = path.join(ROOT, 'apps', 'web', 'android', 'app', 'google-services-pro.json');
fs.writeFileSync(dest, Buffer.from(config.json.configFileContents, 'base64'));
console.log('✔ écrit :', path.relative(ROOT, dest));
