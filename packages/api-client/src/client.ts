import type {
  ApiErrorBody,
  AvailabilityResponse,
  Booking,
  BookingWithSalon,
  BookingWithStaff,
  Category,
  CityCount,
  Notification,
  Paginated,
  ProDashboardStats,
  ProStatsRange,
  Profile,
  Review,
  SalonOwnerView,
  SetHoursResult,
  OutsideBooking,
  SalonPublic,
  SalonSummary,
  ClientStanding,
  MeStats,
  Service,
  Staff,
  StaffHour,
  TimeBlock,
  SearchSuggestions,
  ProClient,
  ProClientHistoryItem,
  BookingStanding,
} from '@salondz/types';
import type { ReportReason, Wilaya } from '@salondz/constants';
import type {
  AvailabilityQuery,
  CreateBookingInput,
  CreateSalonInput,
  CreateServiceInput,
  CreateTimeBlockInput,
  CreateWalkInBookingInput,
  ListBookingsQuery,
  MyBookingsQuery,
  SearchSalonsQuery,
  SetOpeningHoursInput,
  UpdateProfileInput,
  UpdateSalonInput,
  UpdateServiceInput,
  BlockClientInput,
  ReplyReviewInput,
  ClientHistoryStatus,
  EmailSignupInput,
  EmailLinkInput,
} from '@salondz/validation';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Erreur réseau (hors ligne, timeout) — pas une réponse serveur. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Retourne le JWT Supabase courant (ou null si anonyme). */
  getAccessToken: () => Promise<string | null> | string | null;
  fetch?: typeof fetch;
  /** Timeout réseau (ms) — 4G moyenne : 15 s par défaut. */
  timeoutMs?: number;
  onUnauthorized?: () => void;
  /**
   * Jeton de contrôle d'un ADMINISTRATEUR qui pilote l'espace d'un professionnel, s'il y en a un
   * (voir `admin.control`).
   *
   * Lu à chaque requête (et non figé à la construction) : on entre et on sort de ce mode sans
   * reconstruire le client. Il n'est envoyé qu'aux routes `/pro/*`. Le serveur le vérifie à chaque
   * fois — signature, échéance, lien avec l'administrateur — et journalise chaque écriture faite
   * ainsi : personne ne travaille dans le dos d'un professionnel.
   */
  actingAsToken?: () => string | null;
}

type Query = Record<string, string | number | boolean | undefined | null>;

/** Tri des avis publics : mieux notés d'abord (défaut) ou plus récents d'abord. */
export type ReviewSort = 'best' | 'recent';

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  /** Réponse publique du salon, nulle tant qu'il n'a pas répondu. */
  reply: string | null;
  repliedAt: string | null;
}

/** Avis vu par le professionnel : le même, plus le rendez-vous d'où il vient. */
export interface ProReviewItem extends ReviewItem {
  bookingId: string;
  serviceName: string;
  startsAt: string;
}

// ---------------------------------------------------------------------------------------------
// Administration de la place de marché (conception : `docs/ADMIN.md`). Lot 1 : lecture seule.
// ---------------------------------------------------------------------------------------------

export type AdminLevel = 'support' | 'owner';

/**
 * Suspension d'un salon par la plateforme. Deux degrés, parce que les deux situations existent :
 * `frozen` gèle les réservations en laissant la page en ligne (mesure conservatoire), `hidden`
 * retire le salon de la place de marché. Dans les deux cas les rendez-vous déjà pris tiennent.
 */
export type SuspensionLevel = 'frozen' | 'hidden';

export interface Suspension {
  suspendedAt: string | null;
  suspensionLevel: SuspensionLevel | null;
  suspendedReason: string | null;
}

export interface AdminOverview {
  today: { bookings: number; cancelled: number; noShows: number; salons: number; signups: number };
  last30: { bookings: number; revenueDa: number; cancelRate: number; noShowRate: number };
  marketplace: {
    salons: number;
    salonsPublished: number;
    services: number;
    pros: number;
    clients: number;
    reviews: number;
    reviewsNoReply: number;
  };
  health: { lastCronTick: string | null; lastBookingAt: string | null; pendingOverdue: number };
}

export interface AdminSalonRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  wilayaCode: number;
  genderTarget: string;
  isPublished: boolean;
  suspendedAt: string | null;
  suspensionLevel: SuspensionLevel | null;
  suspendedReason: string | null;
  createdAt: string;
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  servicesCount: number;
  staffCount: number;
  bookings30: number;
  revenue30: number;
  cancelled30: number;
  noShow30: number;
  lastBookingAt: string | null;
  ratingAvg: number;
  ratingCount: number;
}

export interface AdminProfileRow {
  id: string;
  role: 'client' | 'pro';
  fullName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  market: string | null;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  bookingsCount: number;
  cancelledCount: number;
  noShowCount: number;
  reviewsCount: number;
  blockedBy: number;
  lastBookingAt: string | null;
  salonId: string | null;
  salonName: string | null;
}

export interface AdminBookingRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  serviceName: string;
  priceDa: number;
  source: string;
  clientName: string;
  clientPhone: string | null;
  clientId: string | null;
  salonId: string;
  salonName: string | null;
  salonSlug: string | null;
  staffName: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface AdminAuditRow {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
  profiles: { fullName: string | null } | null;
}

/** Un signalement d'avis ouvert, avec l'avis et le salon concernés. */
export interface AdminReportRow {
  id: string;
  reason: ReportReason;
  message: string | null;
  createdAt: string;
  reviewId: string;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    hiddenAt: string | null;
    salonId: string;
    salons: { id: string; name: string; slug: string } | null;
  } | null;
  reporter: { fullName: string | null } | null;
}

export interface AdminSalonSheet {
  salon: SalonOwnerView;
  suspension: Suspension;
  owner: { id: string; fullName: string | null; phone: string | null; avatarUrl: string | null; createdAt: string } | null;
  ownerEmail: string | null;
  bookings: AdminBookingRow[];
  reviews: { id: string; rating: number; comment: string | null; createdAt: string; reply: string | null; hiddenAt: string | null; hiddenReason: string | null }[];
  audit: AdminAuditRow[];
}

export interface AdminProfileSheet {
  profile: Profile;
  email: string | null;
  bookings: (AdminBookingRow & { salons: { name: string; slug: string } | null })[];
  reviews: { id: string; rating: number; comment: string | null; createdAt: string; hiddenAt: string | null; hiddenReason: string | null; salons: { name: string; slug: string } | null }[];
  blockedBy: { salonId: string; reason: string | null; createdAt: string; salons: { name: string; slug: string } | null }[];
  salon: { id: string; slug: string; name: string; isPublished: boolean } | null;
}

/**
 * `GET /pro/salon`. `owner` n'existe que lorsqu'un administrateur PILOTE le salon (jeton de
 * contrôle) : il porte l'identité du professionnel, que l'espace pro affiche à la place de celle
 * de l'administrateur, et ce champ absent signifie « c'est bien le propriétaire qui est là ».
 */
export interface ProSalonResponse {
  salon: SalonOwnerView | null;
  owner?: { id: string; fullName: string | null; phone: string | null; email: string | null } | null;
}

/** Accès délivré à un administrateur pour piloter l'espace d'un professionnel. */
export interface AdminControl {
  token: string;
  /** ISO — au-delà, le serveur refuse le jeton (`CONTROL_EXPIRED`). */
  expiresAt: string;
  salon: { id: string; name: string };
}

export interface MeResponse {
  profile: Profile;
  salon: ({ id: string; slug: string; name: string; isPublished: boolean } & Suspension) | null;
  /** Situation anti-abus du client (annulations / absences récentes, suspension) ; null pour un pro. */
  standing: ClientStanding | null;
}

export interface NotificationsResponse extends Paginated<Notification> {
  unreadCount: number;
}

export interface SlotAlert {
  id: string;
  salonId: string;
  serviceId: string | null;
  day: string;
  createdAt: string;
}

export function createApiClient(opts: ApiClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function request<T>(
    method: string,
    path: string,
    init: { query?: Query; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(`${base}/v1${path}`);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.auth !== false) {
      const token = await opts.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const control = opts.actingAsToken?.();
      if (control && path.startsWith('/pro/')) headers['X-Admin-Control'] = control;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(url.toString(), {
        method,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = (err as Error)?.name === 'AbortError';
      throw new ApiError(
        0,
        aborted ? 'TIMEOUT' : 'NETWORK',
        aborted ? 'Connexion trop lente. Réessayez.' : 'Pas de connexion. Vérifiez votre réseau.',
      );
    }
    clearTimeout(timer);

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError(res.status, 'BAD_RESPONSE', 'Réponse invalide du serveur');
      }
    }
    if (!res.ok) {
      const body = json as ApiErrorBody | null;
      if (res.status === 401) opts.onUnauthorized?.();
      throw new ApiError(
        res.status,
        body?.error?.code ?? 'HTTP_ERROR',
        body?.error?.message ?? `Erreur ${res.status}`,
        body?.error?.details,
      );
    }
    return json as T;
  }

  const get = <T>(path: string, query?: Query, auth = true) =>
    request<T>('GET', path, { query, auth });
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
  const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
  const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
  // Une suppression peut porter un corps : l'administration y met le motif, qui part au journal.
  const del = <T>(path: string, body?: unknown) => request<T>('DELETE', path, body === undefined ? undefined : { body });

  return {
    request,
    auth: {
      /** Inscription par e-mail : le compte est créé, le lien de confirmation part par nos e-mails. */
      signup: (body: EmailSignupInput) => post<void>('/auth/signup', body),
      /** Lien de connexion par e-mail (compte existant). */
      magicLink: (body: EmailLinkInput) => post<void>('/auth/magic-link', body),
      /** Renvoi du lien de confirmation (compte non confirmé). */
      resendConfirmation: (body: EmailLinkInput) => post<void>('/auth/resend-confirmation', body),
      /** E-mail de réinitialisation du mot de passe. */
      passwordReset: (body: EmailLinkInput) => post<void>('/auth/password-reset', body),
      /** Comptes de démonstration à accès direct : renvoie une vraie session Supabase (sans SMS). */
      devLogin: (body: { email?: string; phone?: string; code?: string }) =>
        request<{
          accessToken: string;
          refreshToken: string;
          expiresAt: number | null;
          role: 'client' | 'pro';
          phone: string;
        }>('POST', '/auth/dev-login', { body, auth: false }),
    },
    public: {
      categories: () => get<Category[]>('/categories', undefined, false),
      wilayas: () => get<Wilaya[]>('/wilayas', undefined, false),
      searchSalons: (q: Partial<SearchSalonsQuery>) =>
        get<Paginated<SalonSummary> & { total: number }>('/salons', q as Query, false),
      cities: (q: { wilaya?: number; gender?: string; lat?: number; lng?: number; q?: string }) =>
        get<{ items: CityCount[] }>('/salons/cities', q as Query, false),
      suggest: (q: { q: string; gender?: string; wilaya?: number }) =>
        get<SearchSuggestions>('/salons/suggest', q as Query, false),
      salon: (slug: string) => get<SalonPublic>(`/salons/${encodeURIComponent(slug)}`),
      availability: (salonId: string, q: AvailabilityQuery) =>
        get<AvailabilityResponse>(`/salons/${salonId}/availability`, q as Query, false),
      reviews: (salonId: string, offset = 0, limit = 20, sort: ReviewSort = 'best') =>
        get<Paginated<ReviewItem>>(`/salons/${salonId}/reviews`, { offset, limit, sort }, false),
    },
    me: {
      get: () => get<MeResponse>('/me'),
      bookingStanding: (salonId: string) => get<BookingStanding>(`/me/booking-standing/${salonId}`),
      /** Efface le compte (rendez-vous passés anonymisés). Un pro doit d'abord fermer son salon (HAS_SALON). */
      /** `withSalon` : un professionnel ferme son salon en même temps (rendez-vous à venir annulés, clients prévenus). */
      deleteAccount: (opts?: { withSalon?: boolean }) => del<void>('/me', opts),
      /** Toutes les données du compte en JSON. */
      exportData: () => get<Record<string, unknown>>('/me/export'),
      /** Alertes « prévenez-moi si un créneau se libère » (un salon, un jour). */
      slotAlerts: (salonId?: string) => get<{ items: SlotAlert[] }>('/me/slot-alerts', salonId ? { salonId } : undefined),
      addSlotAlert: (body: { salonId: string; day: string; serviceId?: string }) => post<SlotAlert>('/me/slot-alerts', body),
      removeSlotAlert: (id: string) => del<void>(`/me/slot-alerts/${id}`),
      update: (body: UpdateProfileInput) => patch<Profile>('/me', body),
      setRole: (role: 'client' | 'pro') => post<Profile>('/me/role', { role }),
      registerPushToken: (body: {
        token: string;
        platform: 'ios' | 'android' | 'web';
        deviceName?: string;
      }) => post<void>('/me/push-tokens', body),
      removePushToken: (token: string) => del<void>(`/me/push-tokens/${encodeURIComponent(token)}`),
      notifications: (cursor = 0, limit = 30) =>
        get<NotificationsResponse>('/me/notifications', { cursor, limit }),
      markNotificationsRead: (ids?: string[]) => post<void>('/me/notifications/read', { ids }),
      favorites: () => get<{ items: SalonSummary[] }>('/me/favorites'),
      stats: () => get<MeStats>('/me/stats'),
      addFavorite: (salonId: string) => put<void>(`/me/favorites/${salonId}`),
      removeFavorite: (salonId: string) => del<void>(`/me/favorites/${salonId}`),
    },
    bookings: {
      create: (body: CreateBookingInput) => post<BookingWithSalon>('/bookings', body),
      mine: (q: Partial<MyBookingsQuery> = {}) =>
        get<Paginated<BookingWithSalon>>('/me/bookings', q as Query),
      get: (id: string) => get<BookingWithSalon>(`/bookings/${id}`),
      cancel: (id: string, reason?: string) =>
        post<BookingWithSalon>(`/bookings/${id}/cancel`, { reason }),
      reschedule: (id: string, body: { startsAt: string; staffId?: string | null }) =>
        post<BookingWithSalon>(`/bookings/${id}/reschedule`, body),
      review: (id: string, body: { rating: number; comment?: string }) =>
        post<Review>(`/bookings/${id}/review`, body),
      /** Signaler un avis (Apple 1.2 / Google Play) : un motif, un mot facultatif. Un opérateur décide ensuite. */
      reportReview: (id: string, body: { reason: ReportReason; message?: string }) =>
        post<void>(`/reviews/${id}/report`, body),
    },
    pro: {
      salon: () => get<ProSalonResponse>('/pro/salon'),
      createSalon: (body: CreateSalonInput) => post<SalonOwnerView>('/pro/salon', body),
      updateSalon: (body: UpdateSalonInput) => patch<SalonOwnerView>('/pro/salon', body),
      setPhotos: (photos: { url: string }[]) =>
        put<SalonOwnerView>('/pro/salon/photos', { photos }),
      setWorks: (photos: { url: string }[]) => put<SalonOwnerView>('/pro/salon/works', { photos }),
      setHours: (body: SetOpeningHoursInput) => put<SetHoursResult>('/pro/salon/hours', body),
      stats: () => get<ProDashboardStats>('/pro/stats'),
      statsRange: (from: string, to: string) =>
        get<ProStatsRange>('/pro/stats/range', { from, to }),
      slugCheck: (name: string) =>
        get<{ slug: string; available: boolean }>('/pro/salon/slug-check', { name }),
      services: {
        create: (body: CreateServiceInput) => post<Service>('/pro/services', body),
        update: (id: string, body: UpdateServiceInput) =>
          patch<Service>(`/pro/services/${id}`, body),
        remove: (id: string) =>
          del<{ deleted: boolean; deactivated: boolean }>(`/pro/services/${id}`),
        reorder: (ids: string[]) => put<void>('/pro/services/reorder', { ids }),
        setPhotos: (id: string, photos: { url: string }[]) =>
          put<void>(`/pro/services/${id}/photos`, { photos }),
        renameCategory: (body: { from: string; name: string }) =>
          post<{ renamed: number }>('/pro/services/rename-category', body),
        deleteCategory: (body: { name: string; mode: 'with-services' | 'keep-services' }) =>
          post<{ deleted: number; archived: number; moved: number }>(
            '/pro/services/delete-category',
            body,
          ),
      },
      staff: {
        create: (body: {
          displayName: string;
          avatarUrl?: string | null;
          allServices?: boolean;
          serviceIds?: string[];
        }) => post<Staff>('/pro/staff', body),
        update: (
          id: string,
          body: Partial<{
            displayName: string;
            phone: string | null;
            avatarUrl: string | null;
            isActive: boolean;
            sortOrder: number;
            allServices: boolean;
            serviceIds: string[];
          }>,
        ) => patch<Staff>(`/pro/staff/${id}`, body),
        remove: (id: string) => del<{ deleted: boolean; deactivated: boolean }>(`/pro/staff/${id}`),
        hours: (id: string) => get<StaffHour[]>(`/pro/staff/${id}/hours`),
        setHours: (id: string, hours: { dayOfWeek: number; startsAt: string; endsAt: string }[]) =>
          put<{ outsideBookings: OutsideBooking[] }>(`/pro/staff/${id}/hours`, { hours }),
      },
      reviews: {
        list: (q: { cursor?: string; limit?: number; unanswered?: boolean } = {}) =>
          get<Paginated<ProReviewItem>>('/pro/reviews', q as Query),
        unanswered: () => get<{ count: number }>('/pro/reviews/unanswered'),
        reply: (id: string, body: ReplyReviewInput) =>
          put<{ id: string; reply: string | null; repliedAt: string | null }>(
            `/pro/reviews/${id}/reply`,
            body,
          ),
      },
      clients: {
        list: (q: { q?: string; cursor?: string; limit?: number } = {}) =>
          get<Paginated<ProClient> & { total: number; blockedCount: number }>(
            '/pro/clients',
            q as Query,
          ),
        one: (key: string) => get<ProClient>(`/pro/clients/${encodeURIComponent(key)}`),
        block: (body: BlockClientInput) => post<void>('/pro/clients/block', body),
        unblock: (body: BlockClientInput) => post<void>('/pro/clients/unblock', body),
        history: (key: string, cursor?: string, limit = 50, status?: ClientHistoryStatus) =>
          get<Paginated<ProClientHistoryItem>>(`/pro/clients/${encodeURIComponent(key)}/history`, {
            cursor,
            limit,
            status,
          }),
        setNotes: (key: string, notes: string) =>
          put<void>(`/pro/clients/${encodeURIComponent(key)}/notes`, { notes }),
      },
      blocks: {
        list: (from?: string, to?: string) =>
          get<{ items: TimeBlock[] }>('/pro/blocks', { from, to }),
        create: (body: CreateTimeBlockInput) => post<TimeBlock>('/pro/blocks', body),
        remove: (id: string) => del<void>(`/pro/blocks/${id}`),
      },
      bookings: {
        list: (q: Partial<ListBookingsQuery> = {}) =>
          get<Paginated<BookingWithStaff>>('/pro/bookings', q as Query),
        pending: () => get<Paginated<BookingWithStaff>>('/pro/bookings/pending'),
        get: (id: string) => get<BookingWithStaff>(`/pro/bookings/${id}`),
        createWalkIn: (body: CreateWalkInBookingInput) =>
          post<BookingWithStaff>('/pro/bookings', body),
        setStatus: (id: string, status: 'confirmed' | 'completed' | 'no_show') =>
          post<BookingWithStaff>(`/pro/bookings/${id}/status`, { status }),
        cancel: (id: string, reason?: string, late?: boolean) =>
          post<BookingWithStaff>(`/pro/bookings/${id}/cancel`, { reason, late }),
        reschedule: (id: string, body: { startsAt: string; staffId?: string | null }) =>
          post<BookingWithStaff>(`/pro/bookings/${id}/reschedule`, body),
      },
    },

    /**
     * Administration de la place de marché. Toutes ces routes passent par `requireAdmin` côté
     * serveur : l'interface ne protège rien, une adresse devinée ne donne rien.
     */
    admin: {
      me: () => get<{ id: string; level: AdminLevel }>('/admin/me'),
      overview: () => get<AdminOverview>('/admin/overview'),
      salons: (q: { q?: string; status?: 'published' | 'draft'; wilaya?: number; cursor?: string; limit?: number } = {}) =>
        get<Paginated<AdminSalonRow> & { total: number }>('/admin/salons', q as Query),
      salon: (id: string) => get<AdminSalonSheet>(`/admin/salons/${id}`),
      profiles: (q: { q?: string; role?: 'client' | 'pro'; cursor?: string; limit?: number } = {}) =>
        get<Paginated<AdminProfileRow> & { total: number }>('/admin/profiles', q as Query),
      profile: (id: string) => get<AdminProfileSheet>(`/admin/profiles/${id}`),
      bookings: (q: { q?: string; status?: string; from?: string; to?: string; cursor?: string; limit?: number } = {}) =>
        get<Paginated<AdminBookingRow> & { total: number }>('/admin/bookings', q as Query),
      audit: (q: { cursor?: string; limit?: number } = {}) => get<Paginated<AdminAuditRow>>('/admin/audit', q as Query),
      /** File des signalements d'avis ouverts, du plus récent au plus ancien. */
      reports: () => get<{ items: AdminReportRow[] }>('/admin/reports'),
      closeReport: (id: string, outcome: 'handled' | 'rejected', note?: string) =>
        post<void>(`/admin/reports/${id}/close`, { outcome, note }),

      /**
       * Agir (lot 2). Chaque geste porte un MOTIF et laisse une ligne au journal : une suspension
       * se justifie devant la personne suspendue, et six mois plus tard il ne reste que l'écrit.
       */
      suspendSalon: (id: string, body: { level: SuspensionLevel; reason: string }) =>
        post<Suspension & { id: string }>(`/admin/salons/${id}/suspend`, body),
      unsuspendSalon: (id: string, reason?: string) =>
        post<Suspension & { id: string }>(`/admin/salons/${id}/unsuspend`, { reason }),
      /** Entrer dans l'espace d'un professionnel : délivre le jeton de contrôle (deux heures). */
      control: (id: string) => post<AdminControl>(`/admin/salons/${id}/control`),
      /** En sortir : le jeton meurt seul à son échéance, cet appel ne fait que dater la sortie au journal. */
      endControl: (id: string) => post<void>(`/admin/salons/${id}/control/end`),
      suspendProfile: (id: string, reason: string) =>
        post<{ id: string; suspendedAt: string | null; suspendedReason: string | null }>(`/admin/profiles/${id}/suspend`, { reason }),
      unsuspendProfile: (id: string, reason?: string) =>
        post<{ id: string; suspendedAt: string | null; suspendedReason: string | null }>(`/admin/profiles/${id}/unsuspend`, { reason }),
      editProfile: (id: string, body: { fullName?: string; phone?: string; reason: string }) =>
        patch<{ id: string; fullName: string | null; phone: string | null }>(`/admin/profiles/${id}`, body),
      deleteProfile: (id: string, reason: string) => del<void>(`/admin/profiles/${id}`, { reason }),
      hideReview: (id: string, reason: string) =>
        post<{ id: string; hiddenAt: string | null }>(`/admin/reviews/${id}/hide`, { reason }),
      unhideReview: (id: string, reason?: string) =>
        post<{ id: string; hiddenAt: string | null }>(`/admin/reviews/${id}/unhide`, { reason }),
      cancelBooking: (id: string, reason: string) =>
        post<BookingWithStaff>(`/admin/bookings/${id}/cancel`, { reason }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { Booking };
