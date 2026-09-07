import { createClient } from '@supabase/supabase-js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { TEST_ACCOUNTS, TEST_LOGIN_CODE } from '@salondz/constants';
import { devLoginSchema } from '@salondz/validation';
import { config } from '../config';
import { db } from '../lib/supabase';
import { ensureDemoProSalon } from '../lib/demo';
import { AppError, notFound, unauthorized } from '../lib/errors';

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
};

export default authRoutes;
