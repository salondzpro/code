/**
 * Textes de la fiche Google Play de « Salon DZ » (dz.salondz.app) : titre, description courte et
 * phrase d'ouverture de la description longue, pour que la recherche du Play Store trouve l'application
 * avec les mots que les clientes tapent (coiffeur, barbier, salon, Alger, Oran…).
 *
 *   node scripts/play-fiche.mjs             → écrit les textes en français (idempotent)
 *   node scripts/play-fiche.mjs --verifier  → affiche ce qui est en ligne, n'envoie rien
 *
 * Même compte de service que `play-visuels.mjs` (`secrets/`). Les textes sont aussi dans docs/STORES.md § 1.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const VERIFIER = process.argv.includes('--verifier');
const PAQUET = 'dz.salondz.app';
const ROOT = path.resolve(import.meta.dirname, '..');

const TITRE = 'Salon DZ – coiffeur et barbier';
const COURTE = 'Réservez coiffeur, barbier, institut ou ongles en Algérie, sans appeler.';
const OUVERTURE =
  'Salon DZ, c’est la réservation de salon en ligne en Algérie : coiffeur, barbier, esthétique, ongles, ' +
  'cils et institut à Alger, Oran, Constantine et partout en Algérie.';

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
async function g(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + jet.access_token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url.replace(API, '')} → ${r.status} ${j.error?.message ?? ''}`);
  return j;
}

const edit = await g('POST', `${API}/edits`);
const E = `${API}/edits/${edit.id}`;
try {
  const { listings } = await g('GET', `${E}/listings`);
  const lang = (listings ?? []).find((l) => l.language === 'fr-FR') ? 'fr-FR' : 'fr';
  const actuel = await g('GET', `${E}/listings/${lang}`);

  if (VERIFIER) {
    console.log('titre actuel      :', actuel.title);
    console.log('courte actuelle   :', actuel.shortDescription);
    console.log('ouverture présente:', actuel.fullDescription?.includes(OUVERTURE) ? 'oui' : 'non');
    await g('DELETE', E);
    process.exit(0);
  }

  // Idempotent : la phrase d'ouverture n'est ajoutée qu'une fois.
  const longue = actuel.fullDescription?.includes(OUVERTURE)
    ? actuel.fullDescription
    : `${OUVERTURE}\n\n${actuel.fullDescription ?? ''}`;

  await g('PUT', `${E}/listings/${lang}`, { language: lang, title: TITRE, shortDescription: COURTE, fullDescription: longue });
  await g('POST', `${E}:commit`);
  console.log(`✔ fiche Play « ${PAQUET} » (${lang}) : titre, description courte et ouverture écrits`);
} catch (e) {
  await g('DELETE', E).catch(() => {});
  throw e;
}
