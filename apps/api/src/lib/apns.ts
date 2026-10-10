/**
 * Envoi direct à Apple (APNs), pour l'application iPhone.
 *
 * POURQUOI PAS FIREBASE COMME SUR ANDROID : la coque iOS n'embarque pas Firebase (Capacitor 8 en
 * Swift Package Manager, aucun Pod Firebase). Le greffon rend donc le jeton APNs BRUT de l'appareil,
 * et c'est à Apple qu'il faut parler. Ajouter Firebase à iOS pour n'en tirer qu'un relais vers APNs
 * coûterait une dépendance native, une clé de plus à tenir, et un saut supplémentaire.
 *
 * Quatre canaux cohabitent maintenant dans `push_tokens`, reconnus à la FORME du jeton :
 *   - abonnement navigateur : du JSON (`lib/webpush.ts`) ;
 *   - jeton Expo : `ExponentPushToken[…]`, hérité de l'ancienne application ;
 *   - jeton APNs : exactement 64 caractères hexadécimaux — ce module ;
 *   - jeton Firebase : tout le reste (`lib/fcm.ts`).
 *
 * APNs impose HTTP/2 : `fetch` ne le parle pas, d'où `node:http2`. La connexion est gardée ouverte
 * et rouverte si Apple la ferme — ouvrir une connexion TLS par notification serait ruineux.
 */
import http2 from 'node:http2';
import { createSign } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

/** Identifiant de l'application : APNs s'en sert pour router vers la bonne app. */
const TOPIC = process.env.APNS_TOPIC ?? 'dz.salondz.app';
const KEY_ID = process.env.APNS_KEY_ID ?? '';
const TEAM_ID = process.env.APNS_TEAM_ID ?? '';

/**
 * La clé `.p8` est un PEM multiligne, ce qui se transporte mal dans une variable d'environnement.
 * On accepte donc les deux formes : le PEM tel quel, ou son encodage base64 (à préférer sur Render).
 */
function readKey(): string | null {
  const raw = process.env.APNS_KEY;
  if (!raw) return null;
  const pem = raw.includes('-----BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  return pem.includes('-----BEGIN') ? pem : null;
}

const key = readKey();
export const apnsEnabled = key !== null && KEY_ID !== '' && TEAM_ID !== '';

/** Un jeton APNs, ce sont 32 octets : 64 caractères hexadécimaux, et rien d'autre. */
export function isApnsToken(token: string): boolean {
  return /^[0-9a-f]{64}$/i.test(token);
}

// ---------------------------------------------------------------------------------------------
// Jeton d'autorisation. Apple refuse un jeton rafraîchi trop souvent (moins de 20 min) ET un jeton
// de plus d'une heure : on vise le milieu.
// ---------------------------------------------------------------------------------------------
let cached: { value: string; renewAt: number } | null = null;

function authToken(): string | null {
  if (!key) return null;
  if (cached && cached.renewAt > Date.now()) return cached.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: KEY_ID })}.${b64({ iss: TEAM_ID, iat: now })}`;
  // `ieee-p1363` : APNs attend la signature ECDSA en r||s, pas en DER.
  const signature = createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }, 'base64url');
  cached = { value: `${unsigned}.${signature}`, renewAt: Date.now() + 45 * 60_000 };
  return cached.value;
}

// ---------------------------------------------------------------------------------------------
// Connexions. Deux serveurs existent : la production (TestFlight, App Store) et le bac à sable
// (applications posées depuis Xcode). Un jeton ne dit pas d'où il vient, alors on essaie la
// production puis, si Apple répond « ce jeton n'est pas d'ici », le bac à sable.
//
// MAIS notre clé est limitée à la PRODUCTION : le bac à sable répond `BadEnvironmentKeyInToken`
// (vérifié le 29 sept. 2026 par `scripts/check-apns.mjs`). Le premier refus de cette nature coupe
// le repli pour de bon — sinon un jeton réellement mort, refusé en production puis « inconnu » du
// bac à sable, serait conservé indéfiniment au lieu d'être supprimé de la base.
// ---------------------------------------------------------------------------------------------
const PROD = 'https://api.push.apple.com';
const BAC_A_SABLE = 'https://api.sandbox.push.apple.com';
let bacASableUtilisable = true;
const sessions = new Map<string, http2.ClientHttp2Session>();

function session(hote: string): http2.ClientHttp2Session {
  const existante = sessions.get(hote);
  if (existante && !existante.closed && !existante.destroyed) return existante;
  const s = http2.connect(hote);
  s.on('error', () => sessions.delete(hote));
  s.on('close', () => sessions.delete(hote));
  sessions.set(hote, s);
  return s;
}

type Reponse = { status: number; reason?: string };

function poster(hote: string, token: string, corps: Buffer, autorisation: string, topic: string): Promise<Reponse> {
  return new Promise((resolve, reject) => {
    const flux = session(hote).request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${autorisation}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      // 10 = tout de suite. Un rappel de rendez-vous arrivé une heure trop tard ne sert à rien.
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'content-type': 'application/json',
      'content-length': corps.length,
    });
    let status = 0;
    let charge = '';
    flux.setTimeout(10_000, () => flux.close(http2.constants.NGHTTP2_CANCEL));
    flux.on('response', (entetes) => {
      status = Number(entetes[':status'] ?? 0);
    });
    flux.on('data', (m: Buffer) => {
      charge += m.toString();
    });
    flux.on('error', reject);
    flux.on('end', () => {
      let reason: string | undefined;
      try {
        reason = charge ? (JSON.parse(charge) as { reason?: string }).reason : undefined;
      } catch {
        reason = charge || undefined;
      }
      resolve({ status, reason });
    });
    flux.end(corps);
  });
}

/** Refus DÉFINITIFS : le jeton ne vaudra jamais plus rien, il doit être retiré de la base. */
const MORTS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic', 'TopicDisallowed']);

/**
 * Envoie une notification à un iPhone.
 * `false` seulement quand le jeton est DÉFINITIVEMENT mort — l'appelant le supprime alors. Une
 * panne d'Apple ou de réseau rend `true` : on ne jette pas un jeton valable sur un incident passager.
 */
export async function sendApns(
  log: FastifyBaseLogger,
  msg: {
    token: string;
    /**
     * Application visée (`apns-topic`) : celle qui a enregistré le jeton — `dz.salondz.app` (grand
     * public) ou `pro.salondz.app` (professionnelle). Un jeton APNs ne dit pas d'où il vient, et
     * Apple refuse un topic qui n'est pas celui de l'application (`TopicDisallowed`). Absent : le
     * topic par défaut, celui des jetons enregistrés avant la migration 0051.
     */
    topic?: string;
    title: string;
    body: string;
    badge?: number;
    data?: Record<string, unknown>;
  },
): Promise<boolean> {
  const autorisation = authToken();
  if (!autorisation) return true;
  const topic = msg.topic || TOPIC;

  const corps = Buffer.from(
    JSON.stringify({
      // Pas de `content-available` : il n'a d'effet qu'avec le mode d'arrière-plan
      // « remote-notification », que l'application ne déclare pas. Le mettre quand même ne
      // réveillerait rien et ferait poser des questions à la revue.
      aps: {
        alert: { title: msg.title, body: msg.body },
        sound: 'default',
        // Pastille sur l'icône : le NOMBRE exact de notifications non lues, pas un incrément.
        // Apple pose la valeur telle quelle, donc elle redescend seule quand on les lit.
        ...(msg.badge === undefined ? {} : { badge: msg.badge }),
      },
      ...(msg.data ?? {}),
    }),
  );

  const essayer = async (hote: string): Promise<Reponse | null> => {
    try {
      return await poster(hote, msg.token, corps, autorisation, topic);
    } catch (err) {
      log.error({ err, hote }, 'apns envoi impossible');
      return null;
    }
  };

  const rep = await essayer(PROD);
  if (!rep) return true; // panne réseau : on garde le jeton, on réessaiera au prochain tour
  if (rep.status === 200) return true;

  // Jeton inconnu de la production : il vient peut-être d'une application posée depuis Xcode.
  if (rep.reason === 'BadDeviceToken' && bacASableUtilisable) {
    const bis = await essayer(BAC_A_SABLE);
    if (bis?.status === 200) return true;
    if (bis?.reason === 'BadEnvironmentKeyInToken') {
      bacASableUtilisable = false;
      log.info('apns: clé limitée à la production, le bac à sable ne sera plus tenté');
    } else if (bis) {
      return !MORTS.has(bis.reason ?? '');
    }
  }

  log.warn({ status: rep.status, reason: rep.reason }, 'apns refus');
  return !MORTS.has(rep.reason ?? '');
}
