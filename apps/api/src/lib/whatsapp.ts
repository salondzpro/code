/**
 * ENVOI DES CODES DE CONNEXION PAR WHATSAPP (API Cloud de Meta, 23 nov. 2026).
 *
 * Le code part dans le modèle d'authentification `code_connexion` (catégorie AUTHENTICATION,
 * bouton « Copier le code »), en français, arabe ou anglais. Tant que ce modèle n'existe pas
 * (compte de test de Meta : création de modèles refusée), on retombe sur un message texte —
 * qui n'arrive que si la personne a écrit au numéro dans les dernières 24 h : c'est un secours de
 * test, pas un mode de fonctionnement.
 *
 * Variables : WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID (et WHATSAPP_TEMPLATE pour un autre nom).
 * Absentes : `whatsappEnabled` est faux et la route répond « indisponible » proprement.
 */
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config';
import { AppError } from './errors';

const GRAPH = 'https://graph.facebook.com/v21.0';

export const whatsappEnabled = () => !!config.WHATSAPP_TOKEN && !!config.WHATSAPP_PHONE_NUMBER_ID;

type Lang = 'fr' | 'ar' | 'en';

const TEXTE: Record<Lang, (code: string) => string> = {
  fr: (c) => `${c} est votre code de connexion Salon DZ. Il expire dans 10 minutes. Ne le communiquez à personne.`,
  ar: (c) => `${c} هو رمز الدخول إلى Salon DZ. ينتهي خلال 10 دقائق. لا تشاركه مع أي أحد.`,
  en: (c) => `${c} is your Salon DZ login code. It expires in 10 minutes. Do not share it.`,
};

/** Indisponible : erreur en français, jamais le message brut de Meta. */
const indisponible = () => new AppError(503, 'WHATSAPP_UNAVAILABLE', 'Envoi WhatsApp indisponible pour le moment. Réessayez dans un instant, ou connectez-vous par e-mail.');

async function post(body: unknown): Promise<{ ok: true } | { ok: false; code?: number; message?: string }> {
  const res = await fetch(`${GRAPH}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return { ok: true };
  const err = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
  return { ok: false, code: err?.error?.code, message: err?.error?.message };
}

/** Envoie le code au numéro `+213…`. Lève une erreur 503 en français si Meta refuse. */
export async function sendWhatsAppCode(log: FastifyBaseLogger, phone: string, code: string, lang: Lang): Promise<void> {
  if (!whatsappEnabled()) throw indisponible();
  const to = phone.replace(/^\+/, '');
  const tpl = await post({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: config.WHATSAPP_TEMPLATE,
      language: { code: lang },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  });
  if (tpl.ok) return;
  log.warn({ code: tpl.code, msg: tpl.message }, 'whatsapp modèle refusé');
  // 132001 : modèle inexistant dans cette langue / ce compte → secours texte (tests).
  if (tpl.code === 132001) {
    const txt = await post({ messaging_product: 'whatsapp', to, type: 'text', text: { body: TEXTE[lang](code) } });
    if (txt.ok) return;
    log.warn({ code: txt.code, msg: txt.message }, 'whatsapp texte refusé');
  }
  throw indisponible();
}
