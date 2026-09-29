/**
 * Vérifie que la clé APNs est réellement acceptée par Apple, sans appareil.
 *
 *   node --env-file=.env scripts/check-apns.mjs
 *
 * On envoie à un jeton VOLONTAIREMENT faux. La réponse dit tout :
 *   - `BadDeviceToken`   → la clé, l'équipe et l'application sont bonnes ; seul le jeton est faux.
 *                          C'est le résultat ATTENDU, et la preuve que la chaîne fonctionne.
 *   - `InvalidProviderToken` / 403 → la clé, le Key ID ou le Team ID ne vont pas ensemble.
 *   - `TopicDisallowed`  → la clé n'a pas le droit d'écrire à cette application.
 */
import http2 from 'node:http2';
import fs from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_ID = process.env.APNS_KEY_ID;
const TEAM_ID = process.env.APNS_TEAM_ID;
const TOPIC = process.env.APNS_TOPIC ?? 'dz.salondz.app';
const brut = process.env.APNS_KEY;
if (!brut || !KEY_ID || !TEAM_ID) throw new Error('APNS_KEY, APNS_KEY_ID et APNS_TEAM_ID requis');
const key = brut.includes('-----BEGIN') ? brut.replace(/\n/g, '\n') : Buffer.from(brut, 'base64').toString('utf8');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = `${b64({ alg: 'ES256', kid: KEY_ID })}.${b64({ iss: TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
const jwt = `${unsigned}.${createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }, 'base64url')}`;

const corps = Buffer.from(JSON.stringify({ aps: { alert: { title: 'test', body: 'test' } } }));
const faux = '0'.repeat(64);

for (const hote of ['https://api.push.apple.com', 'https://api.sandbox.push.apple.com']) {
  const s = http2.connect(hote);
  const r = await new Promise((resolve) => {
    const f = s.request({
      ':method': 'POST', ':path': `/3/device/${faux}`,
      authorization: `bearer ${jwt}`, 'apns-topic': TOPIC, 'apns-push-type': 'alert',
      'content-type': 'application/json', 'content-length': corps.length,
    });
    let status = 0, charge = '';
    f.on('response', (h) => { status = Number(h[':status']); });
    f.on('data', (m) => { charge += m; });
    f.on('error', (e) => resolve({ status: 0, reason: e.message }));
    f.on('end', () => resolve({ status, reason: JSON.parse(charge || '{}').reason }));
    f.end(corps);
  });
  s.close();
  const verdict =
    r.reason === 'BadDeviceToken' ? 'clé ACCEPTÉE (seul le jeton bidon est refusé, c’est le résultat attendu)'
    // La clé de Salon DZ est limitée à la production : c'est normal ici, et l'envoi en tient compte.
    : r.reason === 'BadEnvironmentKeyInToken' ? 'clé limitée à la PRODUCTION — sans effet, on n’y envoie pas'
    : r.reason === 'InvalidProviderToken' || r.status === 403 ? 'clé REFUSÉE : vérifier Key ID / Team ID'
    : r.reason === 'TopicDisallowed' ? `la clé n’a pas le droit d’écrire à ${TOPIC}`
    : `réponse inattendue : ${r.status} ${r.reason ?? ''}`;
  console.log(`${hote.replace('https://', '').padEnd(30)} ${r.status} ${String(r.reason ?? '').padEnd(20)} → ${verdict}`);
}
