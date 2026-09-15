import { createClient } from '@supabase/supabase-js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { TEST_ACCOUNTS, TEST_LOGIN_CODE } from '@salondz/constants';
import { devLoginSchema, emailLinkSchema, emailSignupSchema } from '@salondz/validation';
import { config } from '../config';
import { db } from '../lib/supabase';
import { ensureDemoProSalon } from '../lib/demo';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { confirmationMail, magicLinkMail, recoveryMail, sendMail } from '../lib/email';

/**
 * Client anonyme (clé publique) : sert uniquement à échanger un code à usage unique (généré par
 * l'admin) contre une vraie session. La clé secrète ne quitte jamais l'API.
 */
const anon = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** E-mail technique déterministe pour un compte de démonstration (jamais montré à l'utilisateur). */
function testEmail(phone: string): string {
  return `test-${phone.replace(/\D/g, '')}@salondz.test`;
}

/**
 * Comptes de démonstration à accès direct.
 * POST /v1/auth/dev-login { phone, code } → vraie session Supabase (access + refresh token) si le
 * numéro est un compte de démonstration connu et le code correct. Le front appelle ensuite
 * `supabase.auth.setSession(...)` : l'utilisateur est authentifié comme après une vérification OTP.
 * Se désactive avec `TEST_LOGIN_ENABLED=0`.
 */
const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/dev-login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { body: devLoginSchema } },
    async (req, reply) => {
      if (!config.TEST_LOGIN_ENABLED) throw notFound('Ressource');
      const { phone, code } = req.body;
      const acct = TEST_ACCOUNTS[phone];
      // Code de démonstration tolérant aux fautes de frappe : le code officiel « 1111 »,
      // ou toute suite de « 1 » (l'utilisateur en tape parfois un de trop).
      const digits = code.replace(/\D/g, '');
      const codeOk = digits === TEST_LOGIN_CODE || /^1{3,8}$/.test(digits);
      if (!acct || !codeOk) throw unauthorized('Numéro ou code de démonstration invalide.');

      const email = testEmail(phone);

      // Crée le compte si absent (idempotent). Le trigger handle_new_user pose le profil (rôle, nom, téléphone).
      const created = await db.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { role: acct.role, full_name: acct.fullName, phone },
      });
      if (created.error && !/already|registered|exists|duplicate/i.test(created.error.message)) {
        req.log.error({ err: created.error }, 'dev-login createUser');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }

      // Code à usage unique généré côté admin, échangé aussitôt contre une session par le client anonyme.
      const link = await db.auth.admin.generateLink({ type: 'magiclink', email });
      const otp = link.data?.properties?.email_otp;
      if (link.error || !otp) {
        req.log.error({ err: link.error }, 'dev-login generateLink');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }
      const verified = await anon.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (verified.error || !verified.data.session) {
        req.log.error({ err: verified.error }, 'dev-login verifyOtp');
        throw new AppError(500, 'DEV_LOGIN_FAILED', 'Connexion de démonstration indisponible.');
      }

      // Profil complété pour un accès direct : téléphone au format E.164 (GoTrue l'enregistre sans « + »),
      // nom, et marché côté client (sinon l'app repasse par « Que recherchez-vous ? »).
      const userId = verified.data.user?.id ?? verified.data.session.user.id;
      const upd = await db
        .from('profiles')
        .update({ phone, full_name: acct.fullName, ...(acct.market ? { market: acct.market } : {}) })
        .eq('id', userId);
      if (upd.error) req.log.warn({ err: upd.error }, 'dev-login profile update');

      // Compte pro de démonstration : salon publié prêt à l'emploi (idempotent).
      if (acct.role === 'pro') await ensureDemoProSalon(req.log, userId);

      reply.header('Cache-Control', 'private, no-store');
      const s = verified.data.session;
      return { accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at ?? null, role: acct.role, phone };
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
  const findUser = async (email: string) => {
    // Pas de recherche par e-mail dans l'API admin : on liste (petit projet) et on filtre.
    const res = await db.auth.admin.listUsers({ perPage: 1000 });
    if (res.error) throw res.error;
    return res.data.users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null;
  };
  const limit = { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } };
  const linkFailed = () => new AppError(500, 'LINK_FAILED', 'Lien impossible à générer. Réessayez dans un instant.');

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
      const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: redirect('/connexion/retour', next) } });
      if (gen.error || !gen.data.properties?.action_link) throw gen.error ?? linkFailed();
      link = gen.data.properties.action_link;
    } else {
      const gen = await db.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: { data: { role }, redirectTo: redirect('/connexion/retour', next) },
      });
      if (gen.error || !gen.data.properties?.action_link) {
        if (gen.error && /already|registered|exists/i.test(gen.error.message))
          throw conflict('EMAIL_EXISTS', 'Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.');
        if (gen.error && /invalid|valid email/i.test(gen.error.message)) throw badRequest('EMAIL_INVALID', 'Adresse e-mail invalide.');
        throw gen.error ?? linkFailed();
      }
      link = gen.data.properties.action_link;
    }
    await sendMail(req.log, { to: email, ...confirmationMail(link) });
    reply.status(204);
    return null;
  });

  /** Renvoi du lien de confirmation à un compte non confirmé. */
  app.post('/auth/resend-confirmation', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const user = await findUser(email);
    if (!user) throw new AppError(404, 'NO_ACCOUNT', 'Aucun compte n’est associé à cette adresse.');
    if (user.email_confirmed_at) throw conflict('ALREADY_CONFIRMED', 'Cette adresse est déjà confirmée : connectez-vous.');
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: redirect('/connexion/retour', next) } });
    if (gen.error || !gen.data.properties?.action_link) throw gen.error ?? linkFailed();
    await sendMail(req.log, { to: email, ...confirmationMail(gen.data.properties.action_link) });
    reply.status(204);
    return null;
  });

  /** Lien de connexion sans mot de passe (compte existant seulement). */
  app.post('/auth/magic-link', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const user = await findUser(email);
    if (!user) throw new AppError(404, 'NO_ACCOUNT', 'Aucun compte n’est associé à cette adresse.');
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: redirect('/connexion/retour', next) } });
    if (gen.error || !gen.data.properties?.action_link) throw gen.error ?? linkFailed();
    await sendMail(req.log, { to: email, ...magicLinkMail(gen.data.properties.action_link) });
    reply.status(204);
    return null;
  });

  /** Mot de passe oublié : lien vers le choix d'un nouveau mot de passe. */
  app.post('/auth/password-reset', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email } = req.body;
    const user = await findUser(email);
    if (!user) throw new AppError(404, 'NO_ACCOUNT', 'Aucun compte n’est associé à cette adresse.');
    const gen = await db.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: new URL('/connexion/mot-de-passe', config.webUrl).toString() },
    });
    if (gen.error || !gen.data.properties?.action_link) throw gen.error ?? linkFailed();
    await sendMail(req.log, { to: email, ...recoveryMail(gen.data.properties.action_link) });
    reply.status(204);
    return null;
  });
};

export default authRoutes;
