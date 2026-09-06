import { queryOptions } from '@tanstack/react-query';
import type { AvailabilityQuery, ListBookingsQuery, MyBookingsQuery, SearchSalonsQuery } from '@salondz/validation';
import type { ApiClient } from './client';

/** Clés de cache TanStack — centralisées pour des invalidations fiables (web + mobile). */
export const queryKeys = {
  categories: ['categories'] as const,
  wilayas: ['wilayas'] as const,
  salons: (q: Partial<SearchSalonsQuery>) => ['salons', q] as const,
  cities: (q: Record<string, unknown>) => ['salons', 'cities', q] as const,
  salon: (slug: string) => ['salon', slug] as const,
  availability: (salonId: string, q: AvailabilityQuery) => ['availability', salonId, q] as const,
  reviews: (salonId: string) => ['reviews', salonId] as const,
  me: ['me'] as const,
  notifications: ['me', 'notifications'] as const,
  favorites: ['me', 'favorites'] as const,
  myBookings: (q: Partial<MyBookingsQuery>) => ['me', 'bookings', q] as const,
  myBookingsAll: ['me', 'bookings'] as const,
  booking: (id: string) => ['booking', id] as const,
  pro: {
    all: ['pro'] as const,
    salon: ['pro', 'salon'] as const,
    stats: ['pro', 'stats'] as const,
    statsRange: (from: string, to: string) => ['pro', 'stats', from, to] as const,
    bookings: (q: Partial<ListBookingsQuery>) => ['pro', 'bookings', q] as const,
    bookingsAll: ['pro', 'bookings'] as const,
    pending: ['pro', 'bookings', 'pending'] as const,
    booking: (id: string) => ['pro', 'booking', id] as const,
    blocks: (from?: string, to?: string) => ['pro', 'blocks', from, to] as const,
    blocksAll: ['pro', 'blocks'] as const,
    staffHours: (id: string) => ['pro', 'staff', id, 'hours'] as const,
  },
};

const MIN = 60_000;

/** Fabriques de queryOptions typées — à utiliser avec useQuery / prefetchQuery. */
export function makeQueries(api: ApiClient) {
  return {
    categories: () => queryOptions({ queryKey: queryKeys.categories, queryFn: () => api.public.categories(), staleTime: 24 * 60 * MIN, gcTime: 7 * 24 * 60 * MIN }),
    wilayas: () => queryOptions({ queryKey: queryKeys.wilayas, queryFn: () => api.public.wilayas(), staleTime: Infinity }),
    salons: (q: Partial<SearchSalonsQuery>) => queryOptions({ queryKey: queryKeys.salons(q), queryFn: () => api.public.searchSalons(q), staleTime: 2 * MIN }),
    cities: (q: Parameters<typeof api.public.cities>[0]) => queryOptions({ queryKey: queryKeys.cities(q), queryFn: () => api.public.cities(q), staleTime: 10 * MIN }),
    salon: (slug: string) => queryOptions({ queryKey: queryKeys.salon(slug), queryFn: () => api.public.salon(slug), staleTime: 5 * MIN, enabled: !!slug }),
    availability: (salonId: string, q: AvailabilityQuery) =>
      queryOptions({
        queryKey: queryKeys.availability(salonId, q),
        queryFn: () => api.public.availability(salonId, q),
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        enabled: !!salonId && (!!q.serviceId || !!q.serviceIds) && !!q.date,
      }),
    reviews: (salonId: string) => queryOptions({ queryKey: queryKeys.reviews(salonId), queryFn: () => api.public.reviews(salonId), staleTime: 5 * MIN, enabled: !!salonId }),
    me: () => queryOptions({ queryKey: queryKeys.me, queryFn: () => api.me.get(), staleTime: 5 * MIN, retry: false }),
    notifications: () => queryOptions({ queryKey: queryKeys.notifications, queryFn: () => api.me.notifications(), staleTime: 30_000 }),
    favorites: () => queryOptions({ queryKey: queryKeys.favorites, queryFn: () => api.me.favorites(), staleTime: 2 * MIN }),
    myBookings: (q: Partial<MyBookingsQuery> = {}) => queryOptions({ queryKey: queryKeys.myBookings(q), queryFn: () => api.bookings.mine(q), staleTime: 30_000 }),
    booking: (id: string) => queryOptions({ queryKey: queryKeys.booking(id), queryFn: () => api.bookings.get(id), enabled: !!id }),
    pro: {
      salon: () => queryOptions({ queryKey: queryKeys.pro.salon, queryFn: () => api.pro.salon(), staleTime: 2 * MIN, retry: false }),
      stats: () => queryOptions({ queryKey: queryKeys.pro.stats, queryFn: () => api.pro.stats(), staleTime: 30_000 }),
      statsRange: (from: string, to: string) => queryOptions({ queryKey: queryKeys.pro.statsRange(from, to), queryFn: () => api.pro.statsRange(from, to), staleTime: 30_000 }),
      bookings: (q: Partial<ListBookingsQuery> = {}) => queryOptions({ queryKey: queryKeys.pro.bookings(q), queryFn: () => api.pro.bookings.list(q), staleTime: 15_000 }),
      pending: () => queryOptions({ queryKey: queryKeys.pro.pending, queryFn: () => api.pro.bookings.pending(), staleTime: 15_000 }),
      booking: (id: string) => queryOptions({ queryKey: queryKeys.pro.booking(id), queryFn: () => api.pro.bookings.get(id), enabled: !!id }),
      blocks: (from?: string, to?: string) => queryOptions({ queryKey: queryKeys.pro.blocks(from, to), queryFn: () => api.pro.blocks.list(from, to), staleTime: MIN }),
      staffHours: (id: string) => queryOptions({ queryKey: queryKeys.pro.staffHours(id), queryFn: () => api.pro.staff.hours(id), enabled: !!id }),
    },
  };
}
export type Queries = ReturnType<typeof makeQueries>;
