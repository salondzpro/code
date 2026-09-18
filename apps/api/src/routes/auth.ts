import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { DEMO_LOGIN_CODE, demoAccountFor } from '@salondz/constants';
import { authGoQuerySchema, devLoginSchema, emailLinkSchema, emailSignupSchema } from '@salondz/validation';
import { config } from '../config';
import { db } from '../lib/supabase';
import { ensureDemoUser, ensureDemoWorld } from '../lib/demo';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { confirmationMail, magicLinkMail, recoveryMail, sendMail } from '../lib/email';

/**
 * Client anonyme (clé publique) : sert uniquement à échanger un code à usage unique (généré par
 * l'admin) contre une vraie session. La clé secrète ne quitte jamais l'API.
 */
const anon = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Comptes de démonstration à accès direct (`DEMO_ACCOUNTS`, @salondz/constants).
 * POST /v1/auth/dev-login { email } — ou { phone, code } pour les anciens numéros (application mobile,
 * scripts) — → vraie session Supabase (access + refresh token). Le front appelle ensuite
 * `supabase.auth.setSession(...)`. Le monde de démonstration (salons, catalogues, historiques) est
 * construit ou complété à chaque connexion. Se désactive avec `TEST_LOGIN_ENABLED=0`.
 */
const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/dev-login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { body: devLoginSchema } },
    async (req, reply) => {
      if (!config.TEST_LOGIN_ENABLED) throw notFound('Ressource');
      const { email, phone, code } = req.body;
      const acct = demoAccountFor(email ?? phone);
      if (!acct) throw unauthorized('Compte de démonstration inconnu.');
      // Ancien chemin par numéro : le code fixe reste exigé.
      if (!email && (code ?? '').replace(/\D/g, '') !== DEMO_LOGIN_CODE) throw unauthorized('Numéro ou code de démonstration invalide.');

      try {
        await ensureDemoUser(acct);
      } catch (err) {
        req.log.error({ err }, 'dev-login ensureDemoUser');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }

      // Code à usage unique généré côté admin, échangé aussitôt contre une session par le client anonyme.
      const link = await db.auth.admin.generateLink({ type: 'magiclink', email: acct.email });
      const otp = link.data?.properties?.email_otp;
      if (link.error || !otp) {
        req.log.error({ err: link.error }, 'dev-login generateLink');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }
      const verified = await anon.auth.verifyOtp({ email: acct.email, token: otp, type: 'email' });
      if (verified.error || !verified.data.session) {
        req.log.error({ err: verified.error }, 'dev-login verifyOtp');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }

      // Salons, catalogues, historiques : prêts avant que la personne n'arrive sur son écran.
      await ensureDemoWorld(req.log);

      reply.header('Cache-Control', 'private, no-store');
      const s = verified.data.session;
      return { accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at ?? null, role: acct.role, phone: acct.phone, email: acct.email };
    },
  );

  // ---------------------------------------------------------------------------------------
  // Connexion par e-mail : les liens sont générés ici (administration Supabase) et envoyés
  // par NOS e-mails (Resend). Le SMTP de Supabase et son quota ne sont plus dans la boucle.
  // Les retours pointent sur le site (`config.webUrl`), jamais sur une URL fournie en clair.
  // ---------------------------------------------------------------------------------------
  const redirect = (path: string, next: string) => {
    const url = new URL(path, config.webUrl);
    url.searchParams.set('next', next);
    return url.toString();
  };
  /** Recherche indexée dans auth.users (fonction SQL réservée à la clé secrète, migration 0037) : pas de liste de tous les comptes. */
  const findUser = async (email: string) => {
    const res = await db.rpc('auth_user_by_email', { p_email: email });
    if (res.error) throw res.error;
    const row = (res.data as { id: string; email: string; email_confirmed_at: string | null; raw_user_meta_data: Record<string, unknown> | null }[] | null)?.[0];
    return row ? { id: row.id, email: row.email, email_confirmed_at: row.email_confirmed_at, user_metadata: row.raw_user_meta_data ?? {} } : null;
  };
  // Envois d'e-mails : limite par adresse visée ET par IP réelle, pour qu'on ne puisse ni bombarder
  // une boîte ni énumérer des comptes en changeant d'adresse à chaque appel.
  const limit = {
    config: {
      rateLimit: {
        max: 6,
        timeWindow: '10 minutes',
        keyGenerator: (req: FastifyRequest) => `mail:${String((req.body as { email?: string } | null)?.email ?? '').toLowerCase()}:${req.ip}`,
      },
    },
  };
  const linkFailed = () => new AppError(500, 'LINK_FAILED', 'Lien impossible à générer. Réessayez dans un instant.');
  /**
   * Le lien envoyé par e-mail est SUR NOTRE DOMAINE (`api.salondz.com/v1/auth/go`), pas sur
   * `…supabase.co` : une adresse sans voyelles de vingt lettres est un signal de spam
   * (règle SpamAssassin URI_NOVOWEL), et un lien vers un domaine inconnu inquiète le lecteur.
   * Cette route redirige vers la vérification Supabase avec le même jeton.
   */
  // Jamais l'en-tête Host en production (un attaquant y mettrait son domaine et recevrait le jeton) :
  // API_PUBLIC_URL est obligatoire là-bas (config.ts) ; le repli ne sert qu'en local.
  const apiOrigin = (req: { protocol: string; headers: { host?: string } }) =>
    config.API_PUBLIC_URL ?? (config.isProd ? config.webUrl : `${req.protocol}://${req.headers.host ?? 'localhost'}`);
  const mailLink = (
    req: { protocol: string; headers: { host?: string } },
    gen: { hashed_token: string; verification_type: string } | null | undefined,
    redirectTo: string,
  ) => {
    if (!gen?.hashed_token) throw linkFailed();
    const url = new URL('/v1/auth/go', apiOrigin(req));
    url.searchParams.set('t', gen.hashed_token);
    url.searchParams.set('type', gen.verification_type);
    url.searchParams.set('r', redirectTo);
    return url.toString();
  };

  /** Relais d'un lien e-mail vers la vérification Supabase (jeton et type inchangés). */
  app.get(
    '/auth/go',
    { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } }, schema: { querystring: authGoQuerySchema } },
    async (req, reply) => {
      const { t, type, r } = req.query;
      // Le retour ne peut être que sur notre site : jamais une URL fournie ailleurs.
      const redirect = new URL(r, config.webUrl);
      if (redirect.origin !== new URL(config.webUrl).origin) throw badRequest('BAD_REDIRECT', 'Retour invalide.');
      const verify = new URL('/auth/v1/verify', config.SUPABASE_URL);
      verify.searchParams.set('token', t);
      verify.searchParams.set('type', type);
      verify.searchParams.set('redirect_to', redirect.toString());
      reply.header('Cache-Control', 'no-store');
      return reply.redirect(verify.toString(), 302);
    },
  );

  /** Inscription : crée le compte (non confirmé) et envoie le lien de confirmation. */
  app.post('/auth/signup', { ...limit, schema: { body: emailSignupSchema } }, async (req, reply) => {
    const { email, password, role, next } = req.body;
    const existing = await findUser(email);
    if (existing?.email_confirmed_at)
      throw conflict('EMAIL_EXISTS', 'Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.');
    let link: string;
    if (existing) {
      // Inscription commencée mais jamais confirmée : on garde le compte, on renvoie un lien
      // qui confirme l'adresse et connecte (le mot de passe saisi ici remplace l'ancien).
      const upd = await db.auth.admin.updateUserById(existing.id, { password, user_metadata: { ...existing.user_metadata, role } });
      if (upd.error) throw upd.error;
      const to = redirect('/connexion/retour', next);
      const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: to } });
      if (gen.error) throw gen.error;
      link = mailLink(req, gen.data.properties, to);
    } else {
      const to = redirect('/connexion/retour', next);
      const gen = await db.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { data: { role }, redirectTo: to },
      });
      if (gen.error) {
        if (/already|registered|exists/i.test(gen.error.message))
          throw conflict('EMAIL_EXISTS', 'Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.');
        if (/invalid|valid email/i.test(gen.error.message)) throw badRequest('EMAIL_INVALID', 'Adresse e-mail invalide.');
        throw gen.error;
      }
      link = mailLink(req, gen.data.properties, to);
    }
    await sendMail(req.log, { to: email, ...confirmationMail(link) });
    reply.status(204);
    return null;
  });

  /** Renvoi du lien de confirmation à un compte non confirmé. */
  app.post('/auth/resend-confirmation', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const user = await findUser(email);
    // Adresse inconnue : même réponse qu'un envoi réussi (pas d'oracle « ce compte existe-t-il ? »).
    if (!user) {
      reply.status(204);
      return null;
    }
    if (user.email_confirmed_at) throw conflict('ALREADY_CONFIRMED', 'Cette adresse est déjà confirmée : connectez-vous.');
    const to = redirect('/connexion/retour', next);
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...confirmationMail(mailLink(req, gen.data.properties, to)) });
    reply.status(204);
    return null;
  });

  /** Lien de connexion sans mot de passe (compte existant seulement). */
  app.post('/auth/magic-link', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const user = await findUser(email);
    if (!user) {
      reply.status(204);
      return null;
    }
    const to = redirect('/connexion/retour', next);
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...magicLinkMail(mailLink(req, gen.data.properties, to)) });
    reply.status(204);
    return null;
  });

  /** Mot de passe oublié : lien vers le choix d'un nouveau mot de passe. */
  app.post('/auth/password-reset', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email } = req.body;
    const user = await findUser(email);
    if (!user) {
      reply.status(204);
      return null;
    }
    const to = new URL('/connexion/mot-de-passe', config.webUrl).toString();
    const gen = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...recoveryMail(mailLink(req, gen.data.properties, to)) });
    reply.status(204);
    return null;
  });
};

export default authRoutes;
