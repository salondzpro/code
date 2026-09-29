/** Petit client de l'API App Store Connect (jeton ES256 signé avec la clé .p8 de secrets/). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KEY_ID = '4HZRQ9GV7F';
export const ISSUER = 'b02ec096-b36d-489d-9348-e4850df4f647';
export const TEAM_ID = 'PRB75K5S58';
export const BUNDLE_ID = 'dz.salondz.app';
export const SECRETS = path.join(ROOT, 'secrets');
const pem = fs.readFileSync(path.join(SECRETS, `AuthKey_${KEY_ID}.p8`), 'utf8');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const body = b64({ iss: ISSUER, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

/**
 * Un appel à l'API d'Apple. Les lectures sont retentées deux fois sur les pannes passagères
 * (429 quand on enchaîne les requêtes, 5xx, coupure réseau) : sans cela, un hoquet au milieu d'un
 * script de remplissage laisse la fiche à moitié écrite, et il faut deviner où il s'est arrêté.
 * Les ÉCRITURES ne sont jamais retentées d'office — rejouer un POST créerait un doublon.
 */
export async function asc(method, p, body) {
  const relancable = method === 'GET';
  for (let essai = 0; ; essai++) {
    let r, json;
    try {
      r = await fetch('https://api.appstoreconnect.apple.com' + p, {
        method,
        headers: { Authorization: 'Bearer ' + token(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      json = await r.json().catch(() => null);
    } catch (err) {
      if (!relancable || essai >= 2) throw err;
      await new Promise((f) => setTimeout(f, 1500 * (essai + 1)));
      continue;
    }
    if (relancable && essai < 2 && (r.status === 429 || r.status >= 500)) {
      await new Promise((f) => setTimeout(f, 1500 * (essai + 1)));
      continue;
    }
    return { status: r.status, json };
  }
}
