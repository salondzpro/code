/**
 * E-mails transactionnels envoyés par l'API via Resend : confirmation d'inscription, lien de
 * connexion, réinitialisation du mot de passe. Les liens sont générés côté administration
 * Supabase (`generateLink`) et envoyés par NOUS : le SMTP de Supabase et son quota de
 * quelques e-mails par heure ne sont plus dans la boucle.
 *
 * Sans `RESEND_API_KEY`, l'envoi est refusé avec un message clair (EMAIL_UNAVAILABLE).
 * Tant qu'aucun domaine n'est vérifié chez Resend, l'expéditeur `onboarding@resend.dev` ne
 * peut écrire qu'à l'adresse du compte Resend : le message d'erreur le dit tel quel.
 */
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config';
import { AppError } from './errors';

const RESEND = 'https://api.resend.com/emails';

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(log: FastifyBaseLogger, mail: Mail): Promise<void> {
  if (!config.RESEND_API_KEY)
    throw new AppError(503, 'EMAIL_UNAVAILABLE', "L'envoi d'e-mails n'est pas configuré. Réessayez plus tard.");
  const res = await fetch(RESEND, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.RESEND_API_KEY}`, 'content-type': 'application/json' },
    // Les réponses arrivent au support : `noreply@` n'est lu par personne.
    body: JSON.stringify({ from: config.EMAIL_FROM, to: [mail.to], reply_to: config.EMAIL_REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (res.ok) return;
  const body = await res.text();
  log.error({ status: res.status, body: body.slice(0, 500), to: mail.to }, 'resend');
  if (res.status === 403 && /own email address/i.test(body))
    throw new AppError(
      503,
      'EMAIL_DOMAIN_UNVERIFIED',
      "L'envoi d'e-mails n'est pas encore ouvert à toutes les adresses (domaine d'envoi à vérifier). Réessayez plus tard.",
    );
  if (res.status === 429)
    throw new AppError(429, 'EMAIL_QUOTA', "Trop d'e-mails envoyés pour le moment. Réessayez dans quelques minutes.");
  throw new AppError(502, 'EMAIL_FAILED', "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant.");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Gabarit commun : sobre, lisible sur téléphone, un seul bouton. */
function layout(title: string, intro: string, cta: string, url: string, footer: string): { html: string; text: string } {
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5f6;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#17181a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e6e7e9;border-radius:8px">
<tr><td style="padding:28px 24px 8px;font-size:20px;font-weight:600;letter-spacing:-0.3px">Salon<span style="color:#6b6f73;font-weight:300"> DZ</span></td></tr>
<tr><td style="padding:8px 24px 0;font-size:22px;font-weight:600;letter-spacing:-0.4px">${esc(title)}</td></tr>
<tr><td style="padding:12px 24px 0;font-size:15px;line-height:1.5;color:#3d4043">${esc(intro)}</td></tr>
<tr><td style="padding:24px 24px 8px"><a href="${url}" style="display:block;background:#111214;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:16px;padding:14px 16px;border-radius:6px">${esc(cta)}</a></td></tr>
<tr><td style="padding:8px 24px 0;font-size:13px;line-height:1.5;color:#6b6f73">${esc(footer)}</td></tr>
<tr><td style="padding:16px 24px 28px;font-size:12px;line-height:1.5;color:#9a9ea3;word-break:break-all">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${esc(url)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${cta} : ${url}\n\n${footer}`;
  return { html, text };
}

export function confirmationMail(url: string): Omit<Mail, 'to'> {
  return {
    subject: 'Confirmez votre adresse · Salon DZ',
    ...layout(
      'Bienvenue sur Salon DZ',
      'Encore une étape : confirmez votre adresse pour activer votre compte.',
      'Confirmer mon adresse',
      url,
      "Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
    ),
  };
}

export function magicLinkMail(url: string): Omit<Mail, 'to'> {
  return {
    subject: 'Votre lien de connexion · Salon DZ',
    ...layout(
      'Connexion à Salon DZ',
      'Ouvrez ce lien pour vous connecter directement, sans mot de passe.',
      'Me connecter',
      url,
      "Ce lien est valable une heure et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail.",
    ),
  };
}

export function recoveryMail(url: string): Omit<Mail, 'to'> {
  return {
    subject: 'Nouveau mot de passe · Salon DZ',
    ...layout(
      'Choisir un nouveau mot de passe',
      'Vous avez demandé à réinitialiser votre mot de passe. Ouvrez ce lien pour en choisir un nouveau.',
      'Choisir un mot de passe',
      url,
      "Ce lien est valable une heure. Si vous n'avez rien demandé, votre mot de passe reste inchangé.",
    ),
  };
}
