/**
 * ENVOI DES CODES DE CONNEXION PAR WHATSAPP (API Cloud de Meta, 23 nov. 2026).
 *
 * UN SEUL CHEMIN : le modèle d'authentification `code_connexion` (catégorie AUTHENTICATION, bouton
 * « Copier le code »), approuvé par Meta. Plus de message texte de secours en production (24 nov.
 * 2026, incident : Meta ACCEPTE un message texte vers n'importe quel numéro puis ne le livre pas
 * hors de la fenêtre de 24 h — l'écran demandait un code qui n'arrivait jamais). Tant que le modèle
 * n'est pas approuvé, `whatsappReady()` est faux : la route refuse et le site masque le bouton.
 *
 * Suivi de livraison : `sendWhatsAppCode` rend l'identifiant du message (`wamid`) ; les statuts
 * (`sent`, `delivered`, `read`, `failed`) arrivent par le webhook `routes/webhooks.ts`.
 *
 * Variables : WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_WABA_ID (lecture des modèles),
 * WHATSAPP_TEMPLATE (autre nom de modèle). `WHATSAPP_TEXT_FALLBACK=1` rétablit le secours texte
 * (tests seulement, quand on sait que la personne vient d'écrire au numéro).
 */
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config';
import { AppError } from './errors';

const GRAPH = 'https://graph.facebook.com/v21.0';

type Lang = 'fr' | 'ar' | 'en';

const TEXTE: Record<Lang, (code: string) => string> = {
  fr: (c) => `${c} est votre code de connexion Salon DZ. Il expire dans 15 minutes. Ne le communiquez à personne.`,
  ar: (c) => `${c} هو رمز الدخول إلى Salon DZ. ينتهي خلال 15 دقيقة. لا تشاركه مع أي أحد.`,
  en: (c) => `${c} is your Salon DZ login code. It expires in 15 minutes. Do not share it.`,
};

const indisponible = () =>
  new AppError(503, 'WHATSAPP_UNAVAILABLE', 'Connexion par WhatsApp indisponible pour le moment. Connectez-vous par e-mail.');

const configured = () => !!config.WHATSAPP_TOKEN && !!config.WHATSAPP_PHONE_NUMBER_ID;

/** Langues dans lesquelles le modèle est APPROUVÉ, relues chez Meta au plus toutes les 10 min. */
let cache: { langs: string[]; at: number } | null = null;
async function approvedLangs(log?: FastifyBaseLogger): Promise<string[]> {
  if (!configured() || !config.WHATSAPP_WABA_ID) return [];
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.langs;
  try {
    const url = `${GRAPH}/${config.WHATSAPP_WABA_ID}/message_templates?name=${encodeURIComponent(config.WHATSAPP_TEMPLATE)}&fields=name,status,language&limit=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` }, signal: AbortSignal.timeout(8_000) });
    const body = (await res.json().catch(() => null)) as { data?: { name: string; status: string; language: string }[] } | null;
    const langs = (body?.data ?? []).filter((t) => t.name === config.WHATSAPP_TEMPLATE && t.status === 'APPROVED').map((t) => t.language);
    cache = { langs, at: Date.now() };
    return langs;
  } catch (err) {
    log?.warn({ err }, 'whatsapp lecture des modèles');
    return cache?.langs ?? [];
  }
}

/** Le canal est-il prêt (configuré ET modèle approuvé) ? Sert la route et le bouton du site. */
export async function whatsappReady(log?: FastifyBaseLogger): Promise<boolean> {
  if (!configured()) return false;
  if (config.WHATSAPP_TEXT_FALLBACK) return true;
  return (await approvedLangs(log)).length > 0;
}

async function post(body: unknown): Promise<{ ok: true; id: string | null } | { ok: false; code?: number; message?: string }> {
  const res = await fetch(`${GRAPH}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { code?: number; message?: string } } | null;
  if (res.ok) return { ok: true, id: json?.messages?.[0]?.id ?? null };
  return { ok: false, code: json?.error?.code, message: json?.error?.message };
}

/** Envoie le code ; rend l'identifiant du message Meta (suivi de livraison). 503 en français si refus. */
export async function sendWhatsAppCode(log: FastifyBaseLogger, phone: string, code: string, lang: Lang): Promise<string | null> {
  if (!configured()) throw indisponible();
  const to = phone.replace(/^\+/, '');
  const langs = await approvedLangs(log);
  if (langs.length) {
    // La langue de la personne si le modèle y est approuvé, sinon le français, sinon la première.
    const choix = langs.find((l) => l === lang || l.startsWith(`${lang}_`)) ?? langs.find((l) => l.startsWith('fr')) ?? langs[0];
    const tpl = await post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: config.WHATSAPP_TEMPLATE,
        language: { code: choix },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    });
    if (tpl.ok) return tpl.id;
    log.warn({ code: tpl.code, msg: tpl.message }, 'whatsapp modèle refusé');
    // Modèle retiré ou suspendu entre-temps : on relira l'état au prochain appel.
    if (tpl.code === 132001 || tpl.code === 132015 || tpl.code === 132016) cache = null;
    throw indisponible();
  }
  if (config.WHATSAPP_TEXT_FALLBACK) {
    const txt = await post({ messaging_product: 'whatsapp', to, type: 'text', text: { body: TEXTE[lang](code) } });
    if (txt.ok) return txt.id;
    log.warn({ code: txt.code, msg: txt.message }, 'whatsapp texte refusé');
  }
  throw indisponible();
}
