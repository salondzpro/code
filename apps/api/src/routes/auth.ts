import { recordSignupSource } from '../lib/marketing';
import { createHash, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ALIAS_DOMAIN, DEMO_LOGIN_CODE, demoAccountFor } from '@salondz/constants';
import { authGoQuerySchema, devLoginSchema, emailCheckSchema, emailLinkSchema, emailSignupSchema, phoneCodeSchema, phoneVerifySchema, type EmailCheckStatus } from '@salondz/validation';
import { config } from '../config';
import { db } from '../lib/supabase';
import { ensureDemoUser, ensureDemoWorld } from '../lib/demo';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { confirmationMail, magicLinkMail, recoveryMail, sendMail } from '../lib/email';
import { sendWhatsAppCode, whatsappEnabled } from '../lib/whatsapp';
import { checkProof, CODE_MAX_ATTEMPTS, CODE_TTL_MIN, codeHash, IP_MAX_PER_DAY, IP_MAX_PER_HOUR, isDzMobile, newChallenge, PHONE_MAX_PER_DAY, PHONE_MAX_PER_HOUR, RESEND_WAIT_S, waitAfter } from '../lib/phoneOtp';

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
  /**
   * LIEN D'E-MAIL → L'APPLICATION (20 nov. 2026) : l'adresse écrite dans l'e-mail est une page du SITE
   * que l'application du compte réclame déjà — `/pro/lien` (Salon DZ Pro) ou `/rendez-vous/lien`
   * (Salon DZ) : le téléphone ouvre l'application directement, qui vérifie le jeton elle-même
   * (`pages/auth/EmailLink.tsx`) ; dans un navigateur, la page passe la main à l'application. Le jeton
   * reste celui de Supabase (`hashed_token`), à usage unique. `r` = la suite, un chemin du site.
   * L'ancien relais `/v1/auth/go` reste servi pour les e-mails déjà envoyés.
   */
  const mailLink = (
    _req: { protocol: string; headers: { host?: string } },
    gen: { hashed_token: string; verification_type: string } | null | undefined,
    redirectTo: string,
    role: Portail,
  ) => {
    if (!gen?.hashed_token) throw linkFailed();
    const suite = new URL(redirectTo, config.webUrl);
    const url = new URL(role === 'pro' ? '/pro/lien' : '/rendez-vous/lien', config.webUrl);
    url.searchParams.set('t', gen.hashed_token);
    url.searchParams.set('type', gen.verification_type);
    url.searchParams.set('r', `${suite.pathname}${suite.search}`);
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

  /**
   * Rôle d'un compte existant : celui du profil s'il est créé, sinon celui posé à l'inscription.
   * Un compte est client OU professionnel, jamais les deux.
   */
  const roleOf = async (user: { id: string; user_metadata: Record<string, unknown> }): Promise<'pro' | 'client'> => {
    const res = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (res.data?.role as string | undefined) ?? (user.user_metadata.role as string | undefined);
    return role === 'pro' ? 'pro' : 'client';
  };

  /**
   * DEUX COMPTES POUR UNE MÊME ADRESSE (16 nov. 2026, séparation stricte) : le compte du second côté
   * vit sous une adresse interne (`@salondz/constants` → `alias.ts`, même calcul dans le site).
   */
  type Portail = 'client' | 'pro';
  const aliasOf = (email: string, role: Portail) =>
    `${role}-${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 24)}@${ALIAS_DOMAIN}`;
  /** Le compte de CE portail pour cette adresse : le vrai s'il est du bon rôle, sinon l'interne, sinon rien. */
  const accountFor = async (email: string, role: Portail) => {
    const user = await findUser(email);
    if (user && (await roleOf(user)) === role) return user;
    return findUser(aliasOf(email, role));
  };
  /** Portail d'une demande : celui annoncé, sinon celui de la destination. */
  const portailOf = (role: string | undefined, next: string): Portail => (role === 'pro' || role === 'client' ? role : next.startsWith('/pro') ? 'pro' : 'client');
  const EXISTS_TEXT = 'Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.';

  /**
   * VÉRIFICATION DE L'ADRESSE DÈS LA PREMIÈRE ÉTAPE (28 oct. 2026) — PAR PORTAIL depuis le 16 nov. :
   * « existe » ne vaut que pour un compte DE CE CÔTÉ. Une adresse qui n'a qu'un compte de l'autre côté
   * est « libre » ici : on propose l'inscription, jamais un refus au mot de passe (demande du
   * propriétaire). Limite par IP SEULE, aucun autre renseignement que le statut.
   */
  app.post(
    '/auth/email-check',
    {
      config: { rateLimit: { max: 30, timeWindow: '10 minutes', keyGenerator: (req: FastifyRequest) => `email-check:${req.ip}` } },
      schema: { body: emailCheckSchema },
    },
    async (req, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      const role = req.body.role === 'pro' ? 'pro' : 'client';
      const user = await accountFor(req.body.email, role);
      let status: EmailCheckStatus = 'available';
      if (user) status = user.email_confirmed_at ? role : 'pending';
      return { status };
    },
  );

  app.post('/auth/signup', { ...limit, schema: { body: emailSignupSchema } }, async (req, reply) => {
    const { email, password, next, fullName, gender, phone, acq } = req.body;
    const role: Portail = req.body.role === 'pro' ? 'pro' : 'client';
    // Le compte DE CE CÔTÉ, s'il existe déjà (vrai ou interne).
    const existing = await accountFor(email, role);
    // Adresse prise par un compte de l'AUTRE côté : le nouveau compte vit sous l'adresse interne.
    const autre = existing ? null : await findUser(email);
    const cible = autre ? aliasOf(email, role) : email;
    const meta = { role, ...(autre ? { contact_email: email } : {}), ...(fullName?.trim() ? { full_name: fullName.trim() } : {}) };
    /**
     * CLIENTE : COMPTE OUVERT TOUT DE SUITE (14 nov. 2026, demande du propriétaire : « être
     * facilitateur »). Adresse, mot de passe, nom et « femme / homme », et l'on entre — pas de lien
     * à aller cliquer. Choix assumé : l'adresse n'est pas vérifiée (un compte client ne donne accès
     * qu'à ses propres réservations ; « Mot de passe oublié » rend la main au vrai titulaire).
     * Les professionnels gardent la confirmation par e-mail.
     */
    if (role === 'client' && fullName && !existing) {
      const created = await db.auth.admin.createUser({
        email: cible,
        password,
        email_confirm: true,
        user_metadata: { ...meta, full_name: fullName },
      });
      if (created.error || !created.data.user) {
        const msg = created.error?.message ?? '';
        if (/already|registered|exists/i.test(msg)) throw conflict('EMAIL_EXISTS', EXISTS_TEXT);
        if (/invalid|valid email/i.test(msg)) throw badRequest('EMAIL_INVALID', 'Adresse e-mail invalide.');
        throw created.error ?? new Error('createUser');
      }
      // Le profil vient du déclencheur (rôle + nom) ; on y ajoute le choix femme / homme, qui ouvre
      // la place de marché sur le bon côté.
      if (gender || phone) {
        const upd = await db
          .from('profiles')
          .update({
            ...(gender ? { gender, market: gender === 'female' ? 'women' : 'men' } : {}),
            ...(phone ? { phone } : {}),
          })
          .eq('id', created.data.user.id);
        if (upd.error) req.log.error({ err: upd.error }, 'signup profil');
      }
      void recordSignupSource(req.log, role, acq);
      reply.header('Cache-Control', 'private, no-store');
      // `login` : l'adresse avec laquelle le site doit se connecter (l'interne le cas échéant).
      return { opened: true, login: cible };
    }
    // Compte confirmé DE CE CÔTÉ : AUCUNE seconde inscription. Le serveur décide, quoi qu'ait affiché
    // l'écran (un ancien bundle, un appel direct). L'unicité est tenue par `auth.users`.
    if (existing?.email_confirmed_at) throw conflict('EMAIL_EXISTS', EXISTS_TEXT);
    let link: string;
    const to = redirect('/connexion/retour', next);
    if (existing) {
      // Inscription commencée mais jamais confirmée : on garde le compte et on renvoie un lien qui
      // confirme l'adresse et connecte. LE MOT DE PASSE SAISI ICI N'EST PAS ENREGISTRÉ (sinon
      // n'importe qui poserait le sien sur le compte d'un autre avant qu'il ne clique le lien).
      const gen = await db.auth.admin.generateLink({ type: 'magiclink', email: existing.email, options: { redirectTo: to } });
      if (gen.error) throw gen.error;
      link = mailLink(req, gen.data.properties, to, role);
    } else {
      const gen = await db.auth.admin.generateLink({
        type: 'signup',
        email: cible,
        password,
        options: { data: meta, redirectTo: to },
      });
      if (gen.error) {
        if (/already|registered|exists/i.test(gen.error.message)) throw conflict('EMAIL_EXISTS', EXISTS_TEXT);
        if (/invalid|valid email/i.test(gen.error.message)) throw badRequest('EMAIL_INVALID', 'Adresse e-mail invalide.');
        throw gen.error;
      }
      // Numéro saisi à l'inscription (écran façon Planity, 20 nov. 2026) : posé sur le profil créé par
      // le déclencheur, pour que « Vos coordonnées » ne le redemande pas.
      if (phone && gen.data.user?.id) {
        const upd = await db.from('profiles').update({ phone }).eq('id', gen.data.user.id);
        if (upd.error) req.log.error({ err: upd.error }, 'signup pro : numéro');
      }
      link = mailLink(req, gen.data.properties, to, role);
    }
    if (!existing) void recordSignupSource(req.log, role, acq);
    // Toujours vers la VRAIE adresse, même pour un compte interne.
    await sendMail(req.log, { to: email, ...confirmationMail(link) });
    reply.status(204);
    return null;
  });

  /**
   * CONNEXION AVEC GOOGLE PAR LE PORTAIL PRO (21 nov. 2026). Un compte créé par Google naît CLIENT
   * (rien ne transporte le portail jusqu'au déclencheur `handle_new_user`). Juste après sa création,
   * le portail pro le déclare PROFESSIONNEL — c'est encore l'inscription : le rôle est posé par le
   * portail emprunté (règle n° 4). Refusé pour tout compte qui n'est pas neuf : créé il y a plus de
   * 30 min, autre fournisseur que Google, ou qui a déjà servi (rendez-vous, salon).
   */
  app.post('/auth/google-pro', { preHandler: app.requireAuth, config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const u = await db.auth.admin.getUserById(req.user!.id);
    if (u.error || !u.data.user) throw u.error ?? new Error('utilisateur');
    const user = u.data.user;
    const providers = (user.identities ?? []).map((i) => i.provider);
    const neuf = Date.now() - new Date(user.created_at).getTime() < 30 * 60_000;
    const p = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (p.error) throw p.error;
    if (p.data?.role === 'pro') {
      reply.status(204);
      return null;
    }
    const [bk, sl] = await Promise.all([
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('client_id', user.id),
      db.from('salons').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
    ]);
    const vierge = (bk.count ?? 0) === 0 && (sl.count ?? 0) === 0;
    if (!neuf || !vierge || !(providers.includes('google') || providers.includes('apple')) || providers.includes('email'))
      throw new AppError(403, 'NO_PRO_ACCOUNT', 'Aucun compte professionnel associé à ces identifiants.');
    const up = await db.from('profiles').update({ role: 'pro' }).eq('id', user.id);
    if (up.error) throw up.error;
    await db.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, role: 'pro' } });
    reply.status(204);
    return null;
  });

  /** Renvoi du lien de confirmation à un compte non confirmé (celui du portail). */
  app.post('/auth/resend-confirmation', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const portail = portailOf(req.body.role, next);
    const user = await accountFor(email, portail);
    // Adresse inconnue : même réponse qu'un envoi réussi (pas d'oracle « ce compte existe-t-il ? »).
    if (!user) {
      reply.status(204);
      return null;
    }
    if (user.email_confirmed_at) throw conflict('ALREADY_CONFIRMED', 'Cette adresse est déjà confirmée : connectez-vous.');
    const to = redirect('/connexion/retour', next);
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...confirmationMail(mailLink(req, gen.data.properties, to, portail)) });
    reply.status(204);
    return null;
  });

  /**
   * Lien de connexion sans mot de passe : vers le compte DU PORTAIL seulement (jamais pour entrer dans
   * l'autre application, 16 nov. 2026) — même réponse 204 quoi qu'il arrive.
   */
  app.post('/auth/magic-link', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email, next } = req.body;
    const portail = portailOf(req.body.role, next);
    const user = await accountFor(email, portail);
    if (!user) {
      reply.status(204);
      return null;
    }
    const to = redirect('/connexion/retour', next);
    const gen = await db.auth.admin.generateLink({ type: 'magiclink', email: user.email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...magicLinkMail(mailLink(req, gen.data.properties, to, portail)) });
    reply.status(204);
    return null;
  });

  /** Mot de passe oublié : celui du compte DU PORTAIL (client par défaut). */
  app.post('/auth/password-reset', { ...limit, schema: { body: emailLinkSchema } }, async (req, reply) => {
    const { email } = req.body;
    const portail: Portail = req.body.role === 'pro' ? 'pro' : 'client';
    const user = await accountFor(email, portail);
    if (!user) {
      reply.status(204);
      return null;
    }
    const to = new URL('/connexion/mot-de-passe', config.webUrl).toString();
    const gen = await db.auth.admin.generateLink({ type: 'recovery', email: user.email, options: { redirectTo: to } });
    if (gen.error) throw gen.error;
    await sendMail(req.log, { to: email, ...recoveryMail(mailLink(req, gen.data.properties, to, portail)) });
    reply.status(204);
    return null;
  });

  // ---------------------------------------------------------------------------------------
  // CONNEXION PAR NUMÉRO, CODE ENVOYÉ PAR WHATSAPP (23 nov. 2026, demande du propriétaire).
  //
  // Règles et défenses anti-robots : `lib/phoneOtp.ts`. Les codes vivent dans `auth_phone_codes`
  // (migration 0060, empreinte HMAC seulement). Le compte d'un numéro vit sous une adresse interne
  // PAR PORTAIL (`<rôle>-wa-<empreinte>@alias…`) : un même numéro peut avoir un compte client et un
  // compte pro, jamais l'un pour l'autre (règle n° 4). Le numéro du profil est celui VÉRIFIÉ ici.
  // ---------------------------------------------------------------------------------------
  const phoneAlias = (phone: string, role: Portail) =>
    `${role}-wa-${createHash('sha256').update(phone).digest('hex').slice(0, 24)}@${ALIAS_DOMAIN}`;
  const phoneLimit = (prefix: string, max: number) => ({
    config: {
      rateLimit: {
        max,
        timeWindow: '15 minutes',
        keyGenerator: (req: FastifyRequest) => `${prefix}:${String((req.body as { phone?: string } | null)?.phone ?? '').replace(/\D/g, '').slice(-9)}`,
      },
    },
  });
  const attendre = (s: number) =>
    new AppError(
      429,
      'OTP_WAIT',
      s >= 120 ? `Patientez ${Math.ceil(s / 60)} minutes avant de redemander un code.` : `Patientez ${s} secondes avant de redemander un code.`,
      { retryIn: s },
    );
  const plafond = () =>
    new AppError(429, 'OTP_LIMIT', 'Trop de codes demandés pour ce numéro. Réessayez plus tard, ou connectez-vous par e-mail.');
  const H = 3_600_000;
  const depuis = (ms: number) => new Date(Date.now() - ms).toISOString();
  const count = async (col: 'phone' | 'ip' | null, value: string, sinceMs: number) => {
    let q = db.from('auth_phone_codes').select('id', { count: 'exact', head: true }).eq('delivered', true).gte('created_at', depuis(sinceMs));
    if (col) q = q.eq(col, value);
    const res = await q;
    if (res.error) throw res.error;
    return res.count ?? 0;
  };

  /** Casse-tête à résoudre avant un envoi (preuve de travail, invisible pour la personne). */
  app.get('/auth/phone/challenge', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (_req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return newChallenge();
  });

  app.post('/auth/phone/code', { ...phoneLimit('wa-send', 4), schema: { body: phoneCodeSchema } }, async (req, reply) => {
    if (!whatsappEnabled()) throw new AppError(503, 'WHATSAPP_UNAVAILABLE', 'Connexion par WhatsApp indisponible pour le moment. Connectez-vous par e-mail.');
    const { phone, lang, challenge, nonce } = req.body;
    const role: Portail = req.body.role === 'pro' ? 'pro' : 'client';
    if (!isDzMobile(phone)) throw badRequest('PHONE_NOT_MOBILE', 'Entrez un numéro de mobile algérien (05, 06 ou 07).');
    if (!checkProof(challenge, nonce, phone)) throw badRequest('PROOF_INVALID', 'Vérification de sécurité expirée. Réessayez.');
    const ip = req.ip;

    // Délai croissant et plafonds du numéro.
    const derniers = await db
      .from('auth_phone_codes')
      .select('created_at')
      .eq('phone', phone)
      .eq('delivered', true)
      .gte('created_at', depuis(H))
      .order('created_at', { ascending: false });
    if (derniers.error) throw derniers.error;
    const heure = derniers.data ?? [];
    const wait = waitAfter(heure.length, heure[0] ? new Date(heure[0].created_at as string) : null);
    if (wait > 0) throw attendre(wait);
    if (heure.length >= PHONE_MAX_PER_HOUR || (await count('phone', phone, 24 * H)) >= PHONE_MAX_PER_DAY) throw plafond();
    // Plafonds de l'adresse IP, tous numéros confondus.
    if ((await count('ip', ip, H)) >= IP_MAX_PER_HOUR || (await count('ip', ip, 24 * H)) >= IP_MAX_PER_DAY) throw plafond();
    // Plafond de la plateforme : au-delà, la facture s'arrête là.
    if ((await count(null, '', 24 * H)) >= config.WHATSAPP_DAILY_CAP) {
      req.log.error({ cap: config.WHATSAPP_DAILY_CAP }, 'whatsapp plafond quotidien atteint');
      throw new AppError(503, 'WHATSAPP_UNAVAILABLE', 'Connexion par WhatsApp indisponible pour le moment. Connectez-vous par e-mail.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await sendWhatsAppCode(req.log, phone, code, lang);
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000);
    // Seul le DERNIER code est valable : les précédents encore ouverts sont fermés.
    const fermer = await db.from('auth_phone_codes').update({ expires_at: new Date().toISOString() }).eq('phone', phone).eq('role', role).is('consumed_at', null);
    if (fermer.error) req.log.error({ err: fermer.error }, 'otp fermeture');
    const ins = await db.from('auth_phone_codes').insert({ phone, role, code_hash: codeHash(phone, role, code), ip, expires_at: expiresAt.toISOString() });
    if (ins.error) throw ins.error;
    // Ménage : rien n'est gardé plus de deux jours.
    void db
      .from('auth_phone_codes')
      .delete()
      .lt('created_at', depuis(48 * H))
      .then(() => undefined);

    const envoyes = heure.length + 1;
    reply.header('Cache-Control', 'private, no-store');
    return {
      expiresAt: expiresAt.toISOString(),
      /** Secondes avant de pouvoir redemander ; `null` = plus de renvoi possible pour l'heure. */
      resendIn: envoyes >= PHONE_MAX_PER_HOUR ? null : RESEND_WAIT_S[envoyes - 1],
    };
  });

  app.post('/auth/phone/verify', { ...phoneLimit('wa-check', 10), schema: { body: phoneVerifySchema } }, async (req, reply) => {
    const { phone, code } = req.body;
    const role: Portail = req.body.role === 'pro' ? 'pro' : 'client';
    const res = await db.rpc('auth_phone_code_check', { p_phone: phone, p_role: role, p_hash: codeHash(phone, role, code), p_max: CODE_MAX_ATTEMPTS });
    if (res.error) throw res.error;
    const etat = res.data as string;
    if (etat === 'invalid') throw badRequest('CODE_INVALID', 'Code incorrect. Vérifiez le code reçu sur WhatsApp.');
    if (etat === 'locked') throw badRequest('CODE_LOCKED', 'Trop d’essais avec ce code. Demandez-en un nouveau.');
    if (etat !== 'ok') throw badRequest('CODE_EXPIRED', 'Ce code a expiré. Demandez-en un nouveau.');

    // Le compte de CE portail pour ce numéro, créé à la première connexion (déjà confirmé).
    const email = phoneAlias(phone, role);
    let user = await findUser(email);
    let isNew = false;
    if (!user) {
      const created = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { role, phone, login: 'whatsapp' } });
      if (created.error || !created.data.user) {
        req.log.error({ err: created.error }, 'phone createUser');
        throw new AppError(500, 'PHONE_LOGIN_FAILED', 'Connexion impossible pour le moment. Réessayez dans un instant.');
      }
      isNew = true;
      user = { id: created.data.user.id, email, email_confirmed_at: new Date().toISOString(), user_metadata: { role } };
    } else if ((await roleOf(user)) !== role) {
      throw unauthorized(role === 'pro' ? 'Aucun compte professionnel associé à ces identifiants.' : 'Aucun compte client associé à ces identifiants.');
    }
    // Numéro vérifié : c'est lui qui figure au profil (rendez-vous, fiche client, rappels).
    const upd = await db.from('profiles').update({ phone }).eq('id', user.id);
    if (upd.error) req.log.error({ err: upd.error }, 'phone profil');

    const link = await db.auth.admin.generateLink({ type: 'magiclink', email });
    const otp = link.data?.properties?.email_otp;
    const verified = otp ? await anon.auth.verifyOtp({ email, token: otp, type: 'email' }) : null;
    if (link.error || !verified || verified.error || !verified.data.session) {
      req.log.error({ err: link.error ?? verified?.error }, 'phone session');
      throw new AppError(500, 'PHONE_LOGIN_FAILED', 'Connexion impossible pour le moment. Réessayez dans un instant.');
    }
    reply.header('Cache-Control', 'private, no-store');
    const s = verified.data.session;
    return { accessToken: s.access_token, refreshToken: s.refresh_token, expiresAt: s.expires_at ?? null, isNew };
  });
};

export default authRoutes;
