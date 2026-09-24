/**
 * Envoi direct à Firebase (FCM HTTP v1), pour l'APPLICATION MOBILE (coque Capacitor).
 *
 * Trois canaux cohabitent désormais dans `push_tokens`, et se reconnaissent à la FORME du jeton :
 *   - abonnement navigateur : du JSON (`lib/webpush.ts`) ;
 *   - jeton Expo : `ExponentPushToken[…]`, hérité de l'ancienne application ;
 *   - jeton Firebase : tout le reste, c'est-à-dire ce module.
 *
 * L'authentification se fait par un jeton d'accès Google obtenu à partir de la clé de service
 * (`FCM_SERVICE_ACCOUNT`, JSON). Sans cette variable, l'envoi est simplement désactivé : les
 * notifications restent visibles dans l'application et le reste du service fonctionne.
 */
import { createSign } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    return parsed.client_email && parsed.private_key && parsed.project_id ? parsed : null;
  } catch {
    return null;
  }
}

const account = readServiceAccount();
export const fcmEnabled = account !== null;

/** Un jeton Firebase n'est ni du JSON (navigateur) ni un jeton Expo : il ne reste que lui. */
export function isFcmToken(token: string): boolean {
  return !token.startsWith('{') && !token.startsWith('ExponentPushToken');
}

let cached: { token: string; expiresAt: number } | null = null;

/** Jeton d'accès Google, signé avec la clé de service. Gardé en mémoire jusqu'à son échéance. */
async function accessToken(): Promise<string | null> {
  if (!account) return null;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claim = b64({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export type FcmMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Envoie une notification. Retourne `false` quand le jeton est refusé DÉFINITIVEMENT (application
 * désinstallée, jeton renouvelé) : l'appelant le retire alors de la base, comme pour les autres canaux.
 */
export async function sendFcm(log: FastifyBaseLogger, msg: FcmMessage): Promise<boolean> {
  if (!account) return true;
  const auth = await accessToken();
  if (!auth) {
    log.warn('fcm: jeton d’accès indisponible');
    return true;
  }
  // Les valeurs de `data` doivent être des chaînes : Firebase refuse tout le reste.
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(msg.data ?? {})) {
    if (v !== undefined && v !== null) data[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: msg.token,
        notification: { title: msg.title, body: msg.body },
        data,
        android: { priority: 'HIGH', notification: { channel_id: 'bookings', sound: 'default' } },
      },
    }),
  });

  if (res.ok) return true;
  const detail = await res.text().catch(() => '');
  // 404 (UNREGISTERED) et 400 (jeton invalide) sont définitifs ; le reste est passager.
  const gone = res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(detail);
  log.warn({ status: res.status, detail: detail.slice(0, 200) }, 'fcm: envoi refusé');
  return !gone;
}
