import { readPlan, requirePlan } from '../../lib/plans';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  DEFAULT_OPENING_HOURS,
  localDateTimeToISO,
  toLocalDateKey,
  weekKeys,
  addDaysToKey,
  LABEL_FONTS,
  LABEL_LOCALES,
  LABEL_SOCIAL_IDS,
  LABEL_SOCIAL_MAX,
  LABEL_TAGLINE_MAX,
} from '@salondz/constants';
import {
  createSalonSchema,
  setOpeningHoursSchema,
  setSalonPhotosSchema,
  updateSalonSchema,
  setSalonWorksSchema,
} from '@salondz/validation';
import { z } from 'zod';
import { dateKey, depositSettingsSchema } from '@salondz/validation';
import { loadDepositSettings } from '../../lib/deposit';
import type { ProDashboardStats, ProStatsRange } from '@salondz/types';
import { db } from '../../lib/supabase';
import { readProNews } from '../../lib/proNews';
import { badRequest, conflict, unwrap } from '../../lib/errors';
import { snakeize } from '../../lib/mappers';
import { loadOwnerView } from '../../lib/queries';
import { bookingsOutsideHours } from '../../lib/hours';
import { loadOwnedSalon, noAccount } from '../../plugins/auth';
import { readLabelSocials, readLabelStyle, writeLabelSocials, writeLabelStyle } from '../../lib/labelSettings';
import { proClientsClose, readLoyalty, writeLoyalty } from '../../lib/loyalty';
import { readPromos, writePromos } from '../../lib/promos';
import { readBookingGuard, saveBookingGuard } from '../../lib/fraud';
import { createPlanCheckout, paymentOpenTo, paymentStatus, planPrice } from '../../lib/chargily';
import { AppError } from '../../lib/errors';

const proSalonRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Salon du pro connecté (null si pas encore créé → onboarding).
   *
   * C'est CETTE route qui décide si l'espace pro s'ouvre ou renvoie vers l'inscription : elle doit
   * donc suivre le pilotage d'un administrateur (jeton de contrôle), sans quoi il serait renvoyé
   * vers la création d'un salon qu'il n'a pas. Dans ce cas seulement, la réponse porte aussi le
   * PROPRIÉTAIRE — l'espace pro affiche l'identité du professionnel, pas celle de l'administrateur.
   */
  app.get('/salon', { preHandler: app.requireProfile }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const pilote = await app.resolveActing(req, reply);
    if (pilote) {
      const [salon, profil, compte] = await Promise.all([
        loadOwnerView(pilote.id),
        db.from('profiles').select('id, full_name, phone').eq('id', pilote.ownerId).maybeSingle(),
        db.auth.admin.getUserById(pilote.ownerId).catch(() => null),
      ]);
      const p = profil.data as { id: string; full_name: string | null; phone: string | null } | null;
      return {
        salon,
        owner: p
          ? { id: p.id, fullName: p.full_name, phone: p.phone, email: compte?.data.user?.email ?? null }
          : null,
      };
    }
    // Compte client : l'espace pro n'existe pas pour lui (jamais d'inscription de salon proposée).
    if (req.profile!.role !== 'pro') throw noAccount('pro');
    const salon = await loadOwnedSalon(req.user!.id);
    return { salon: salon ? await loadOwnerView(salon.id) : null };
  });

  /** Création du salon (onboarding). Passe le profil en "pro". */
  app.post(
    '/salon',
    { preHandler: app.requireProfile, schema: { body: createSalonSchema } },
    async (req, reply) => {
      // Un administrateur qui pilote le salon d'un professionnel n'ouvre pas un salon à son nom.
      if (await app.resolveActing(req, reply))
        throw conflict('SALON_EXISTS', 'Ce professionnel a déjà un salon.');
      // Seul un compte PRO (inscrit par le portail pro) ouvre un salon : un compte client ne se
      // transforme jamais en compte pro (16 nov. 2026, séparation stricte des deux applications).
      if (req.profile!.role !== 'pro') throw noAccount('pro');
      const existing = await loadOwnedSalon(req.user!.id);
      if (existing) throw conflict('SALON_EXISTS', 'Vous avez déjà un salon.');
      const { categoryIds, ...rest } = req.body;

      const created = unwrap(
        await db
          .from('salons')
          .insert({ ...snakeize(rest), owner_id: req.user!.id })
          .select('id')
          .single(),
      ) as { id: string };

      const [catRes, hoursRes, roleRes] = await Promise.all([
        db
          .from('salon_categories')
          .insert(categoryIds.map((category_id) => ({ salon_id: created.id, category_id }))),
        db.from('opening_hours').insert(
          DEFAULT_OPENING_HOURS.map((h) => ({
            salon_id: created.id,
            day_of_week: h.dayOfWeek,
            opens_at: h.opensAt,
            closes_at: h.closesAt,
            is_closed: h.isClosed,
          })),
        ),
        db.from('profiles').update({ role: 'pro' }).eq('id', req.user!.id),
      ]);
      for (const r of [catRes, hoursRes, roleRes]) if (r.error) throw r.error;

      reply.status(201);
      return loadOwnerView(created.id);
    },
  );

  // Réseaux sociaux de l'étiquette « Vitrine noire » (atelier d'étiquettes, `/pro/qr`).
  // Conseils & nouveautés publiés par l'administration (20 nov. 2026) : en tête du rond « Conseil ».
  // Abonnement du salon (20 nov. 2026) : posé par le super admin, Découverte par défaut.
  app.get('/plan', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return readPlan(req.salon!.id);
  });
  /**
   * PAYER SON ABONNEMENT EN LIGNE (Chargily Pay, 26 nov. 2026). Prix calculés ici, jamais par l'écran.
   * Un administrateur qui pilote l'espace d'un pro ne paie pas à sa place.
   */
  app.get('/plan/prices', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const id = req.salon!.id;
    const [p1, p12, s1, s12] = await Promise.all([planPrice(id, 'pro', 1), planPrice(id, 'pro', 12), planPrice(id, 'salon', 1), planPrice(id, 'salon', 12)]);
    return { available: await paymentOpenTo(req.user!.id), pro: { 1: p1, 12: p12 }, salon: { 1: s1, 12: s12 } };
  });
  app.post(
    '/plan/checkout',
    {
      preHandler: app.requireSalon,
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
      schema: { body: z.object({ plan: z.enum(['pro', 'salon']), months: z.union([z.literal(1), z.literal(12)]) }) },
    },
    async (req, reply) => {
      if (req.actingAs) throw new AppError(403, 'ACTING_NO_PAYMENT', 'Le professionnel paie lui-même son abonnement.');
      reply.header('Cache-Control', 'private, no-store');
      const loc = req.profile?.locale;
      return createPlanCheckout(req.log, {
        salonId: req.salon!.id,
        userId: req.user!.id,
        plan: req.body.plan,
        months: req.body.months,
        locale: loc === 'ar' || loc === 'en' ? loc : 'fr',
      });
    },
  );
  app.get('/plan/payments/:id', { preHandler: app.requireSalon, schema: { params: z.object({ id: z.string().uuid() }) } }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const p = await paymentStatus(req.log, req.salon!.id, req.params.id);
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Paiement introuvable.');
    return p;
  });

  app.get('/news', { preHandler: app.requireSalon }, async (_req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return { items: await readProNews() };
  });

  app.get('/label-socials', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-cache');
    return readLabelSocials(req.salon!.id);
  });
  /**
   * VERSEMENT À LA RÉSERVATION (migration 0057). Le mode, le montant et la portée vont sur `salons`
   * (publics : la cliente est prévenue avant de réserver) ; le compte va dans `salon_deposit_accounts`,
   * que seule l'API lit.
   */
  /** Bouclier de réservation (26 nov. 2026) : prestations par rendez-vous, rendez-vous à venir par client. */
  app.get('/booking-guard', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return readBookingGuard(req.salon!.id);
  });
  app.put(
    '/booking-guard',
    {
      preHandler: app.requireSalon,
      schema: { body: z.object({ maxServices: z.number().int().min(1).max(5), maxUpcoming: z.number().int().min(1).max(5) }) },
    },
    async (req) => saveBookingGuard(req.salon!.id, req.body),
  );

  app.get('/deposit-settings', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return loadDepositSettings(req.salon!.id);
  });
  app.put(
    '/deposit-settings',
    { preHandler: app.requireSalon, schema: { body: depositSettingsSchema } },
    async (req) => {
      const b = req.body;
      const id = req.salon!.id;
      if (b.mode !== 'off') await requirePlan(id, 'pro', 'Le versement à la réservation');
      const acc = await db.from('salon_deposit_accounts').upsert(
        { salon_id: id, method: b.method, holder: b.holder ?? null, account: b.account ?? null, note: b.note ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'salon_id' },
      );
      if (acc.error) throw acc.error;
      const s = await db
        .from('salons')
        .update({ deposit_mode: b.mode, deposit_value: b.mode === 'off' ? 0 : b.value, deposit_scope: b.scope })
        .eq('id', id);
      if (s.error) throw s.error;
      return loadDepositSettings(id);
    },
  );

  app.put(
    '/label-socials',
    {
      preHandler: app.requireSalon,
      schema: {
        body: z
          .array(z.object({ id: z.enum(LABEL_SOCIAL_IDS), handle: z.string().trim().max(LABEL_SOCIAL_MAX), shown: z.boolean() }))
          .max(LABEL_SOCIAL_IDS.length),
      },
    },
    async (req) => writeLabelSocials(req.salon!.id, req.body),
  );
  // PROGRAMME FIDÉLITÉ (18 nov. 2026) : carte à tampons réglée par le pro, gardée dans app_settings.
  app.get('/loyalty', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-cache');
    return readLoyalty(req.salon!.id);
  });
  app.put(
    '/loyalty',
    {
      preHandler: app.requireSalon,
      schema: {
        body: z.object({
          enabled: z.boolean(),
          mode: z.enum(['visits', 'points', 'promo']),
          threshold: z.number().int().min(2).max(2000),
          rewardKind: z.enum(['percent', 'amount']),
          rewardValue: z.number().int().min(1).max(100_000),
          minSpend: z.number().int().min(0).max(1_000_000),
          giftMonths: z.number().int().min(1).max(6),
          code: z.string().trim().max(20).nullable(),
        }),
      },
    },
    async (req) => {
      if (req.body.enabled && req.body.mode === 'promo' && !/^[A-Z0-9]{3,12}$/.test((req.body.code ?? '').trim().toUpperCase().replace(/\s+/g, ''))) {
        throw badRequest('INVALID_PROMO_CODE', 'Le code promo compte 3 à 12 lettres ou chiffres, sans espace.');
      }
      if (req.body.enabled) await requirePlan(req.salon!.id, 'pro', 'Le programme fidélité');
      return writeLoyalty(req.log, { id: req.salon!.id, name: req.salon!.name, slug: req.salon!.slug }, req.body);
    },
  );
  /** Promotions sur les prestations (18 nov. 2026). */
  app.get('/promos', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-cache');
    return readPromos(req.salon!.id);
  });
  app.put(
    '/promos',
    {
      preHandler: app.requireSalon,
      schema: {
        body: z
          .array(
            z.object({
              id: z.string().max(60).optional(),
              serviceIds: z.array(z.string().uuid()).min(1).max(50),
              kind: z.enum(['percent', 'amount']),
              value: z.number().int().min(1).max(100_000),
              startsAt: z.string().max(40),
              endsAt: z.string().max(40),
            }),
          )
          .max(20),
      },
    },
    async (req) => {
      if (req.body.length) await requirePlan(req.salon!.id, 'pro', 'Les promotions');
      const svc = await db.from('services').select('id').eq('salon_id', req.salon!.id);
      if (svc.error) throw svc.error;
      const own = new Set((svc.data ?? []).map((s) => s.id as string));
      return writePromos(req.salon!.id, req.body.map((p) => ({ ...p, serviceIds: p.serviceIds.filter((id) => own.has(id)) })));
    },
  );

  /** Clients proches d'un cadeau (au moins 60 % du chemin, ou cadeau à utiliser). */
  app.get('/loyalty/clients', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return proClientsClose(req.salon!.id);
  });

  // Langue, couleur, style et phrase de la « Vitrine noire ».
  app.get('/label-style', { preHandler: app.requireSalon }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-cache');
    return readLabelStyle(req.salon!.id);
  });
  app.put(
    '/label-style',
    {
      preHandler: app.requireSalon,
      schema: {
        body: z.object({
          locale: z.enum(LABEL_LOCALES),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          font: z.enum(LABEL_FONTS),
          tagline: z.string().trim().max(LABEL_TAGLINE_MAX),
          decor: z.boolean().optional(),
        }),
      },
    },
    async (req) => writeLabelStyle(req.salon!.id, { ...req.body, decor: req.body.decor ?? false }),
  );

  app.patch(
    '/salon',
    { preHandler: app.requireSalon, schema: { body: updateSalonSchema } },
    async (req) => {
      const salon = req.salon!;
      const { categoryIds, ...rest } = req.body;

      if (rest.isPublished === true && !salon.isPublished) {
        const view = await loadOwnerView(salon.id);
        const problems: string[] = [];
        if (!view.services.some((s) => s.isActive)) problems.push('Ajoutez au moins un service.');
        if (!view.openingHours.some((h) => !h.isClosed))
          problems.push("Définissez vos horaires d'ouverture.");
        if (!view.staff.some((s) => s.isActive))
          problems.push('Ajoutez au moins un membre à votre équipe.');
        if (problems.length)
          throw badRequest('CANNOT_PUBLISH', 'Le salon ne peut pas encore être publié.', problems);
      }

      if (Object.keys(rest).length) {
        const { error } = await db.from('salons').update(snakeize(rest)).eq('id', salon.id);
        if (error) throw error;
      }
      if (categoryIds) {
        const del = await db.from('salon_categories').delete().eq('salon_id', salon.id);
        if (del.error) throw del.error;
        const ins = await db
          .from('salon_categories')
          .insert(categoryIds.map((category_id) => ({ salon_id: salon.id, category_id })));
        if (ins.error) throw ins.error;
      }
      return loadOwnerView(salon.id);
    },
  );

  app.put(
    '/salon/photos',
    { preHandler: app.requireSalon, schema: { body: setSalonPhotosSchema } },
    async (req) => {
      const salon = req.salon!;
      // Couvertures seulement : les réalisations (kind 'work') ont leur propre route.
      const del = await db
        .from('salon_photos')
        .delete()
        .eq('salon_id', salon.id)
        .eq('kind', 'cover');
      if (del.error) throw del.error;
      if (req.body.photos.length) {
        const ins = await db
          .from('salon_photos')
          .insert(
            req.body.photos.map((p, i) => ({
              salon_id: salon.id,
              url: p.url,
              sort_order: i,
              kind: 'cover',
            })),
          );
        if (ins.error) throw ins.error;
      }
      const cover = req.body.photos[0]?.url ?? null;
      if (cover !== salon.coverUrl) {
        const upd = await db.from('salons').update({ cover_url: cover }).eq('id', salon.id);
        if (upd.error) throw upd.error;
      }
      return loadOwnerView(salon.id);
    },
  );

  /** Réalisations : photos du travail réel (section « Réalisations » de la page publique), sans lien avec une prestation. */
  app.put(
    '/salon/works',
    { preHandler: app.requireSalon, schema: { body: setSalonWorksSchema } },
    async (req) => {
      const salon = req.salon!;
      const del = await db
        .from('salon_photos')
        .delete()
        .eq('salon_id', salon.id)
        .eq('kind', 'work');
      if (del.error) throw del.error;
      if (req.body.photos.length) {
        const ins = await db
          .from('salon_photos')
          .insert(
            req.body.photos.map((p, i) => ({
              salon_id: salon.id,
              url: p.url,
              sort_order: i,
              kind: 'work',
            })),
          );
        if (ins.error) throw ins.error;
      }
      return loadOwnerView(salon.id);
    },
  );

  app.put(
    '/salon/hours',
    { preHandler: app.requireSalon, schema: { body: setOpeningHoursSchema } },
    async (req) => {
      const salon = req.salon!;
      const del = await db.from('opening_hours').delete().eq('salon_id', salon.id);
      if (del.error) throw del.error;
      const ins = await db.from('opening_hours').insert(
        req.body.hours.map((h) => ({
          salon_id: salon.id,
          day_of_week: h.dayOfWeek,
          opens_at: h.opensAt,
          closes_at: h.closesAt,
          is_closed: h.isClosed,
        })),
      );
      if (ins.error) throw ins.error;
      // Les rendez-vous déjà pris hors des nouvelles plages sont conservés et signalés (jamais annulés d'office).
      const outsideBookings = await bookingsOutsideHours(
        salon.id,
        req.body.hours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt })),
      );
      return { ...(await loadOwnerView(salon.id)), outsideBookings };
    },
  );

  /** Chiffres du tableau de bord (jour / semaine dimanche→samedi). */
  /** Le lien de réservation sera-t-il disponible pour ce nom ? (design « Nom de votre salon »). */
  app.get(
    '/salon/slug-check',
    {
      preHandler: app.requireProfile,
      schema: { querystring: z.object({ name: z.string().trim().min(1).max(80) }) },
    },
    async (req, reply) => {
      const slug = slugify(req.query.name);
      const res = await db.from('salons').select('id').eq('slug', slug).maybeSingle();
      if (res.error) throw res.error;
      reply.header('Cache-Control', 'private, no-store');
      return { slug, available: !res.data };
    },
  );

  /**
   * Visites de la page publique sur une période (carte « Votre page » de l'accueil, 1er nov. 2026) :
   * total, jour par jour, par provenance, et réservations EN LIGNE reçues sur la même période.
   */
  app.get(
    '/page-stats',
    {
      preHandler: app.requireSalon,
      schema: { querystring: z.object({ from: dateKey, to: dateKey }) },
    },
    async (req, reply) => {
      const salonId = req.salon!.id;
      const { from, to } = req.query;
      // Une période d’au plus 400 jours : la réponse liste chaque jour.
      if (to < from || addDaysToKey(from, 400) < to) throw badRequest('BAD_RANGE', 'Période invalide.');
      const [views, online] = await Promise.all([
        db.from('salon_page_views').select('day, source, views').eq('salon_id', salonId).gte('day', from).lte('day', to),
        db
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('salon_id', salonId)
          .eq('source', 'online')
          .gte('created_at', localDateTimeToISO(from, '00:00'))
          .lt('created_at', localDateTimeToISO(addDaysToKey(to, 1), '00:00')),
      ]);
      if (views.error) throw views.error;
      if (online.error) throw online.error;

      /*
       * CE QUE CHAQUE CANAL RAPPORTE (13 nov. 2026) : réservations en ligne de la période par provenance,
       * nouveaux clients (aucune réservation antérieure dans CE salon, par compte ou par numéro) et
       * chiffre d'affaires des rendez-vous non annulés. Sans provenance connue = « lien ».
       */
      const period = await db
        .from('bookings')
        .select('client_id, client_phone, price_da, status, origin, created_at')
        .eq('salon_id', salonId)
        .eq('source', 'online')
        .gte('created_at', localDateTimeToISO(from, '00:00'))
        .lt('created_at', localDateTimeToISO(addDaysToKey(to, 1), '00:00'))
        .order('created_at', { ascending: true })
        .limit(2000);
      if (period.error) throw period.error;
      const rows = period.data ?? [];
      const ids = [...new Set(rows.map((r) => r.client_id).filter((x): x is string => !!x))];
      const phones = [...new Set(rows.map((r) => r.client_phone).filter((x): x is string => !!x))];
      const known = new Set<string>();
      const debut = localDateTimeToISO(from, '00:00');
      if (ids.length) {
        const prev = await db.from('bookings').select('client_id').eq('salon_id', salonId).in('client_id', ids).lt('created_at', debut).limit(5000);
        if (prev.error) throw prev.error;
        for (const p of prev.data ?? []) if (p.client_id) known.add(`c:${p.client_id}`);
      }
      if (phones.length) {
        const prev = await db.from('bookings').select('client_phone').eq('salon_id', salonId).in('client_phone', phones).lt('created_at', debut).limit(5000);
        if (prev.error) throw prev.error;
        for (const p of prev.data ?? []) if (p.client_phone) known.add(`p:${p.client_phone}`);
      }
      const vide = () => ({ bookings: 0, newClients: 0, revenueDa: 0 });
      const origins = { link: vide(), instagram: vide(), snapchat: vide(), qr: vide(), marketplace: vide() };
      for (const r of rows) {
        const o = origins[(r.origin as keyof typeof origins) ?? 'link'] ?? origins.link;
        o.bookings += 1;
        const cles = [r.client_id ? `c:${r.client_id}` : null, r.client_phone ? `p:${r.client_phone}` : null].filter((x): x is string => !!x);
        if (cles.length && !cles.some((k) => known.has(k))) o.newClients += 1;
        cles.forEach((k) => known.add(k));
        if (r.status !== 'cancelled' && r.status !== 'no_show') o.revenueDa += r.price_da ?? 0;
      }
      const byDay = new Map<string, number>();
      const bySource = { link: 0, instagram: 0, snapchat: 0, qr: 0, marketplace: 0, other: 0 };
      for (const r of views.data ?? []) {
        byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
        bySource[r.source as keyof typeof bySource] += r.views;
      }
      const days: { date: string; views: number }[] = [];
      for (let d = from; d <= to; d = addDaysToKey(d, 1)) days.push({ date: d, views: byDay.get(d) ?? 0 });
      reply.header('Cache-Control', 'private, no-store');
      return {
        total: days.reduce((s, d) => s + d.views, 0),
        byDay: days,
        bySource,
        bookings: online.count ?? 0,
        origins,
      };
    },
  );

  /** Statistiques d'une période (jour / semaine / mois). */
  app.get(
    '/stats/range',
    {
      preHandler: app.requireSalon,
      schema: { querystring: z.object({ from: dateKey, to: dateKey }) },
    },
    async (req, reply) => {
      const res = await db.rpc('pro_stats', {
        p_salon_id: req.salon!.id,
        p_from: req.query.from,
        p_to: req.query.to,
      });
      reply.header('Cache-Control', 'private, no-store');
      return unwrap(res) as ProStatsRange;
    },
  );

  app.get('/stats', { preHandler: app.requireSalon }, async (req, reply) => {
    const salonId = req.salon!.id;
    const today = toLocalDateKey();
    const [weekStart] = weekKeys(today);
    const monthStart = today.slice(0, 8) + '01';
    const monthEnd = addDaysToKey(
      monthStart.slice(0, 5) + String(Number(monthStart.slice(5, 7)) + 1).padStart(2, '0') + '-01',
      -1,
    );
    const dayStart = localDateTimeToISO(today, '00:00');
    const dayEnd = localDateTimeToISO(addDaysToKey(today, 1), '00:00');
    const wStart = localDateTimeToISO(weekStart!, '00:00');
    const wEnd = localDateTimeToISO(addDaysToKey(weekStart!, 7), '00:00');

    const [todayRes, pendingRes, weekRes, todayStats, monthStats] = await Promise.all([
      db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .in('status', ['pending', 'confirmed', 'completed'])
        .gte('starts_at', dayStart)
        .lt('starts_at', dayEnd),
      db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salonId)
        .eq('status', 'pending')
        .gte('starts_at', new Date().toISOString()),
      db
        .from('bookings')
        .select('price_da, status')
        .eq('salon_id', salonId)
        .in('status', ['confirmed', 'completed'])
        .gte('starts_at', wStart)
        .lt('starts_at', wEnd),
      db.rpc('pro_stats', { p_salon_id: salonId, p_from: today, p_to: today }),
      db.rpc('pro_stats', {
        p_salon_id: salonId,
        p_from: monthStart,
        p_to:
          monthEnd.length === 10 && monthEnd > monthStart ? monthEnd : addDaysToKey(monthStart, 30),
      }),
    ]);
    if (todayRes.error) throw todayRes.error;
    if (pendingRes.error) throw pendingRes.error;
    const weekRows = unwrap(weekRes) as { price_da: number; status: string }[];
    const stats: ProDashboardStats = {
      todayCount: todayRes.count ?? 0,
      pendingCount: pendingRes.count ?? 0,
      weekCount: weekRows.length,
      weekRevenueDa: weekRows.reduce((sum, r) => sum + r.price_da, 0),
      todayRevenueDa: Number((unwrap(todayStats) as ProStatsRange).revenueDa ?? 0),
      monthCount: Number((unwrap(monthStats) as ProStatsRange).bookings ?? 0),
      monthRevenueDa: Number((unwrap(monthStats) as ProStatsRange).revenueDa ?? 0),
    };
    reply.header('Cache-Control', 'private, no-store');
    return stats;
  });
};

/** Même règle que la base : minuscules, sans accents, tirets. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default proSalonRoutes;
