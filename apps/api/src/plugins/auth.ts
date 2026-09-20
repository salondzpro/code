import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config';
import { db } from '../lib/supabase';
import { forbidden, unauthorized } from '../lib/errors';
import { camelize } from '../lib/mappers';
import type { Profile, Salon } from '@salondz/types';

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  token: string;
}

/**
 * Administrateur de la PLACE DE MARCHÉ — pas un type d'utilisateur : son compte reste un compte
 * client ou pro ordinaire, et son accès vit dans `platform_admins` (voir `docs/ADMIN.md`).
 * `support` répare (masquer un avis, lever une suspension) ; `owner` fait tout.
 */
export interface PlatformAdmin {
  id: string;
  level: 'support' | 'owner';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    /** Chargé par `requireProfile` */
    profile: Profile | null;
    /** Chargé par `requireSalon` (routes /pro) */
    salon: Salon | null;
    /** Chargé par `requireAdmin` (routes /admin) */
    admin: PlatformAdmin | null;
  }
  interface FastifyInstance {
    /** Exige un JWT valide. */
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige un JWT + charge le profil. */
    requireProfile: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige un profil pro possédant un salon ; charge `req.salon`. */
    requireSalon: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige un administrateur de la place de marché ; charge `req.admin`. */
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Exige le niveau `owner` (suppression, réglages, gestion des administrateurs). */
    requireOwner: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const ISSUER = `${config.SUPABASE_URL}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`), {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
});
const legacyKey = config.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(config.SUPABASE_JWT_SECRET)
  : null;

export async function verifySupabaseJwt(token: string): Promise<JWTPayload> {
  const header = decodeProtectedHeader(token);
  const options = { issuer: ISSUER, audience: 'authenticated' as const };
  if (header.alg === 'HS256') {
    if (!legacyKey) throw new Error('HS256 token but SUPABASE_JWT_SECRET is not set');
    return (await jwtVerify(token, legacyKey, { ...options, algorithms: ['HS256'] })).payload;
  }
  return (await jwtVerify(token, jwks, { ...options, algorithms: ['ES256', 'RS256'] })).payload;
}

export const SALON_COLUMNS =
  'id, owner_id, slug, name, description, phone, wilaya_code, city, address, lat, lng, cover_url, logo_url, zone, gender_target, is_published, slot_interval_minutes, booking_lead_time_minutes, booking_horizon_days, auto_confirm, cancel_min_hours, buffer_minutes, home_service, allow_client_reschedule, deposit_required, rating_avg, rating_count, created_at, updated_at, salon_categories(category_id)';

export function mapSalon(row: Record<string, unknown>): Salon {
  const { salon_categories, ...rest } = row as { salon_categories?: { category_id: string }[] };
  const s = camelize<Omit<Salon, 'categoryIds'>>(rest);
  return {
    ...s,
    ratingAvg: Number(s.ratingAvg),
    categoryIds: (salon_categories ?? []).map((c) => c.category_id).sort(),
  };
}

export async function loadOwnedSalon(userId: string): Promise<Salon | null> {
  const { data, error } = await db
    .from('salons')
    .select(SALON_COLUMNS)
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSalon(data as Record<string, unknown>) : null;
}

export default fp(async (app) => {
  app.decorateRequest('user', null);
  app.decorateRequest('profile', null);
  app.decorateRequest('salon', null);
  app.decorateRequest('admin', null);

  // Décodage "soft" : les routes publiques peuvent personnaliser si un token est présent.
  app.addHook('onRequest', async (req) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return;
    const token = auth.slice(7).trim();
    if (!token) return;
    try {
      const payload = await verifySupabaseJwt(token);
      if (!payload.sub) return;
      req.user = {
        id: payload.sub,
        email: (payload.email as string | undefined) ?? null,
        phone: (payload.phone as string | undefined) ?? null,
        token,
      };
    } catch (err) {
      req.log.debug({ err }, 'JWT invalide');
    }
  });

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.user) throw unauthorized();
  });

  app.decorate('requireProfile', async (req: FastifyRequest) => {
    if (!req.user) throw unauthorized();
    const { data, error } = await db
      .from('profiles')
      .select('id, role, full_name, phone, avatar_url, gender, locale, market, reminders_enabled, notify_confirmations, created_at')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      // Le trigger auth.users → profiles peut manquer sur un compte très ancien : on crée.
      const ins = await db
        .from('profiles')
        .insert({ id: req.user.id, phone: req.user.phone })
        .select('id, role, full_name, phone, avatar_url, gender, locale, market, reminders_enabled, notify_confirmations, created_at')
        .single();
      if (ins.error) throw ins.error;
      req.profile = camelize<Profile>(ins.data);
      return;
    }
    req.profile = camelize<Profile>(data);
  });

  app.decorate('requireSalon', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireProfile(req, reply);
    const salon = await loadOwnedSalon(req.user!.id);
    if (!salon) throw forbidden("Vous n'avez pas encore de salon. Créez-le d'abord.");
    req.salon = salon;
  });

  /**
   * Garde de l'espace d'administration. C'est LE point de contrôle : les écrans ne protègent
   * rien, une adresse devinée ne donne rien. Un accès retiré (`disabled_at`) ne vaut plus, mais
   * sa ligne reste — elle explique le journal laissé derrière.
   */
  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireProfile(req, reply);
    const { data, error } = await db
      .from('platform_admins')
      .select('user_id, level, disabled_at')
      .eq('user_id', req.user!.id)
      .maybeSingle();
    if (error) throw error;
    const row = data as { level: 'support' | 'owner'; disabled_at: string | null } | null;
    if (!row || row.disabled_at) {
      // Une porte fermée ne dit rien à celui qui pousse, mais elle se signale de notre côté :
      // des tentatives répétées sur `/v1/admin/*` sont exactement ce qu'on veut voir passer.
      req.log.warn(
        { user: req.user!.id, ip: req.ip, route: req.routeOptions.url, revoked: !!row?.disabled_at },
        'admin refusé',
      );
      throw forbidden("Accès réservé à l'administration.");
    }
    req.admin = { id: req.user!.id, level: row.level };
  });

  app.decorate('requireOwner', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAdmin(req, reply);
    if (req.admin!.level !== 'owner') throw forbidden('Cette action demande le niveau propriétaire.');
  });
});
