import type {
  ApiErrorBody,
  AvailabilityResponse,
  Booking,
  BookingWithSalon,
  BookingWithStaff,
  Category,
  Notification,
  Paginated,
  ProDashboardStats,
  Profile,
  Review,
  SalonOwnerView,
  SalonPublic,
  SalonSummary,
  Service,
  Staff,
  StaffHour,
  TimeBlock,
} from '@salondz/types';
import type { Wilaya } from '@salondz/constants';
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
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
}

export interface MeResponse {
  profile: Profile;
  salon: { id: string; slug: string; name: string; isPublished: boolean } | null;
}

export interface NotificationsResponse extends Paginated<Notification> {
  unreadCount: number;
}

export function createApiClient(opts: ApiClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function request<T>(method: string, path: string, init: { query?: Query; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const url = new URL(`${base}/v1${path}`);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init.auth !== false) {
      const token = await opts.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
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
      throw new ApiError(0, aborted ? 'TIMEOUT' : 'NETWORK', aborted ? 'Connexion trop lente. Réessayez.' : 'Pas de connexion. Vérifiez votre réseau.');
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
      throw new ApiError(res.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? `Erreur ${res.status}`, body?.error?.details);
    }
    return json as T;
  }

  const get = <T>(path: string, query?: Query, auth = true) => request<T>('GET', path, { query, auth });
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
  const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
  const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
  const del = <T>(path: string) => request<T>('DELETE', path);

  return {
    request,
    public: {
      categories: () => get<Category[]>('/categories', undefined, false),
      wilayas: () => get<Wilaya[]>('/wilayas', undefined, false),
      searchSalons: (q: Partial<SearchSalonsQuery>) => get<Paginated<SalonSummary>>('/salons', q as Query, false),
      salon: (slug: string) => get<SalonPublic>(`/salons/${encodeURIComponent(slug)}`),
      availability: (salonId: string, q: AvailabilityQuery) => get<AvailabilityResponse>(`/salons/${salonId}/availability`, q as Query, false),
      reviews: (salonId: string, offset = 0, limit = 20) => get<Paginated<ReviewItem>>(`/salons/${salonId}/reviews`, { offset, limit }, false),
    },
    me: {
      get: () => get<MeResponse>('/me'),
      update: (body: UpdateProfileInput) => patch<Profile>('/me', body),
      setRole: (role: 'client' | 'pro') => post<Profile>('/me/role', { role }),
      registerPushToken: (body: { token: string; platform: 'ios' | 'android' | 'web'; deviceName?: string }) => post<void>('/me/push-tokens', body),
      removePushToken: (token: string) => del<void>(`/me/push-tokens/${encodeURIComponent(token)}`),
      notifications: (cursor = 0, limit = 30) => get<NotificationsResponse>('/me/notifications', { cursor, limit }),
      markNotificationsRead: (ids?: string[]) => post<void>('/me/notifications/read', { ids }),
      favorites: () => get<{ items: SalonSummary[] }>('/me/favorites'),
      addFavorite: (salonId: string) => put<void>(`/me/favorites/${salonId}`),
      removeFavorite: (salonId: string) => del<void>(`/me/favorites/${salonId}`),
    },
    bookings: {
      create: (body: CreateBookingInput) => post<BookingWithSalon>('/bookings', body),
      mine: (q: Partial<MyBookingsQuery> = {}) => get<Paginated<BookingWithSalon>>('/me/bookings', q as Query),
      get: (id: string) => get<BookingWithSalon>(`/bookings/${id}`),
      cancel: (id: string, reason?: string) => post<BookingWithSalon>(`/bookings/${id}/cancel`, { reason }),
      reschedule: (id: string, body: { startsAt: string; staffId?: string | null }) => post<BookingWithSalon>(`/bookings/${id}/reschedule`, body),
      review: (id: string, body: { rating: number; comment?: string }) => post<Review>(`/bookings/${id}/review`, body),
    },
    pro: {
      salon: () => get<{ salon: SalonOwnerView | null }>('/pro/salon'),
      createSalon: (body: CreateSalonInput) => post<SalonOwnerView>('/pro/salon', body),
      updateSalon: (body: UpdateSalonInput) => patch<SalonOwnerView>('/pro/salon', body),
      setPhotos: (photos: { url: string }[]) => put<SalonOwnerView>('/pro/salon/photos', { photos }),
      setHours: (body: SetOpeningHoursInput) => put<SalonOwnerView>('/pro/salon/hours', body),
      stats: () => get<ProDashboardStats>('/pro/stats'),
      services: {
        create: (body: CreateServiceInput) => post<Service>('/pro/services', body),
        update: (id: string, body: UpdateServiceInput) => patch<Service>(`/pro/services/${id}`, body),
        remove: (id: string) => del<{ deleted: boolean; deactivated: boolean }>(`/pro/services/${id}`),
        reorder: (ids: string[]) => put<void>('/pro/services/reorder', { ids }),
      },
      staff: {
        create: (body: { displayName: string; avatarUrl?: string | null }) => post<Staff>('/pro/staff', body),
        update: (id: string, body: Partial<{ displayName: string; avatarUrl: string | null; isActive: boolean; sortOrder: number }>) => patch<Staff>(`/pro/staff/${id}`, body),
        remove: (id: string) => del<{ deleted: boolean; deactivated: boolean }>(`/pro/staff/${id}`),
        hours: (id: string) => get<StaffHour[]>(`/pro/staff/${id}/hours`),
        setHours: (id: string, hours: { dayOfWeek: number; startsAt: string; endsAt: string }[]) => put<void>(`/pro/staff/${id}/hours`, { hours }),
      },
      blocks: {
        list: (from?: string, to?: string) => get<{ items: TimeBlock[] }>('/pro/blocks', { from, to }),
        create: (body: CreateTimeBlockInput) => post<TimeBlock>('/pro/blocks', body),
        remove: (id: string) => del<void>(`/pro/blocks/${id}`),
      },
      bookings: {
        list: (q: Partial<ListBookingsQuery> = {}) => get<Paginated<BookingWithStaff>>('/pro/bookings', q as Query),
        pending: () => get<Paginated<BookingWithStaff>>('/pro/bookings/pending'),
        get: (id: string) => get<BookingWithStaff>(`/pro/bookings/${id}`),
        createWalkIn: (body: CreateWalkInBookingInput) => post<BookingWithStaff>('/pro/bookings', body),
        setStatus: (id: string, status: 'confirmed' | 'completed' | 'no_show') => post<BookingWithStaff>(`/pro/bookings/${id}/status`, { status }),
        cancel: (id: string, reason?: string) => post<BookingWithStaff>(`/pro/bookings/${id}/cancel`, { reason }),
        reschedule: (id: string, body: { startsAt: string; staffId?: string | null }) => post<BookingWithStaff>(`/pro/bookings/${id}/reschedule`, body),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { Booking };
