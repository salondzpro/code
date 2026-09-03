import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AvailabilityQuery, CreateBookingInput, ListBookingsQuery, MyBookingsQuery, SearchSalonsQuery } from '@salondz/validation';
import type { ApiClient } from './client';
import { makeQueries, queryKeys, type Queries } from './queries';

interface ApiContextValue {
  api: ApiClient;
  queries: Queries;
}
const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const value = useMemo(() => ({ api, queries: makeQueries(api) }), [api]);
  return createElement(ApiContext.Provider, { value }, children);
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi() doit être utilisé sous <ApiProvider>');
  return ctx;
}

// ---------- Public ----------
export const useCategories = () => useQuery(useApi().queries.categories());
export const useWilayas = () => useQuery(useApi().queries.wilayas());
export const useSalonSearch = (q: Partial<SearchSalonsQuery>) => useQuery(useApi().queries.salons(q));
export const useSalon = (slug: string) => useQuery(useApi().queries.salon(slug));
export const useAvailability = (salonId: string, q: AvailabilityQuery) => useQuery(useApi().queries.availability(salonId, q));
export const useSalonReviews = (salonId: string) => useQuery(useApi().queries.reviews(salonId));

// ---------- Compte ----------
export const useMe = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.me(), enabled });
};
export const useNotifications = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.notifications(), enabled });
};
export const useFavorites = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.favorites(), enabled });
};
export const useMyBookings = (q: Partial<MyBookingsQuery> = {}, enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.myBookings(q), enabled });
};
export const useBooking = (id: string) => useQuery(useApi().queries.booking(id));

export function useUpdateProfile() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.me.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useMarkNotificationsRead() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.me.markNotificationsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useToggleFavorite() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ salonId, on }: { salonId: string; on: boolean }) => (on ? api.me.addFavorite(salonId) : api.me.removeFavorite(salonId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.favorites }),
  });
}

// ---------- Réservation client ----------
function invalidateClientBookings(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
  qc.invalidateQueries({ queryKey: ['availability'] });
  qc.invalidateQueries({ queryKey: queryKeys.notifications });
}

export function useCreateBooking() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBookingInput) => api.bookings.create(body),
    onSuccess: (b) => {
      qc.setQueryData(queryKeys.booking(b.id), b);
      invalidateClientBookings(qc);
    },
    onError: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

export function useCancelBooking() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.bookings.cancel(id, reason),
    onSuccess: (b) => {
      qc.setQueryData(queryKeys.booking(b.id), b);
      invalidateClientBookings(qc);
    },
  });
}

export function useRescheduleBooking() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, startsAt, staffId }: { id: string; startsAt: string; staffId?: string | null }) => api.bookings.reschedule(id, { startsAt, staffId }),
    onSuccess: (b) => {
      qc.setQueryData(queryKeys.booking(b.id), b);
      invalidateClientBookings(qc);
    },
  });
}

export function useCreateReview() {
  const { api } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, rating, comment }: { bookingId: string; rating: number; comment?: string }) => api.bookings.review(bookingId, { rating, comment }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.reviews(r.salonId) });
      qc.invalidateQueries({ queryKey: ['salon'] }); // note moyenne / nombre d'avis
      qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
    },
  });
}

// ---------- Espace pro ----------
export const useProSalon = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.pro.salon(), enabled });
};
export const useProStats = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.pro.stats(), enabled });
};
export const useProBookings = (q: Partial<ListBookingsQuery> = {}, enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.pro.bookings(q), enabled });
};
export const useProPendingBookings = (enabled = true) => {
  const { queries } = useApi();
  return useQuery({ ...queries.pro.pending(), enabled });
};
export const useProBooking = (id: string) => useQuery(useApi().queries.pro.booking(id));
export const useProBlocks = (from?: string, to?: string) => useQuery(useApi().queries.pro.blocks(from, to));
export const useStaffHours = (id: string) => useQuery(useApi().queries.pro.staffHours(id));

function invalidatePro(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.pro.all });
  qc.invalidateQueries({ queryKey: queryKeys.me });
}

/** Mutations du salon : toutes renvoient la vue propriétaire → mise en cache directe. */
export function useProSalonMutations() {
  const { api } = useApi();
  const qc = useQueryClient();
  const onSalon = (salon: Awaited<ReturnType<typeof api.pro.createSalon>>) => {
    qc.setQueryData(queryKeys.pro.salon, { salon });
    qc.invalidateQueries({ queryKey: queryKeys.me });
    qc.invalidateQueries({ queryKey: queryKeys.salon(salon.slug) });
  };
  return {
    createSalon: useMutation({ mutationFn: api.pro.createSalon, onSuccess: onSalon }),
    updateSalon: useMutation({ mutationFn: api.pro.updateSalon, onSuccess: onSalon }),
    setPhotos: useMutation({ mutationFn: api.pro.setPhotos, onSuccess: onSalon }),
    setHours: useMutation({ mutationFn: api.pro.setHours, onSuccess: onSalon }),
  };
}

export function useProServiceMutations() {
  const { api } = useApi();
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: queryKeys.pro.salon });
  return {
    create: useMutation({ mutationFn: api.pro.services.create, onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.pro.services.update>[1]) => api.pro.services.update(id, body), onSuccess: done }),
    remove: useMutation({ mutationFn: api.pro.services.remove, onSuccess: done }),
    reorder: useMutation({ mutationFn: api.pro.services.reorder, onSuccess: done }),
  };
}

export function useProStaffMutations() {
  const { api } = useApi();
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: queryKeys.pro.salon });
  return {
    create: useMutation({ mutationFn: api.pro.staff.create, onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof api.pro.staff.update>[1]) => api.pro.staff.update(id, body), onSuccess: done }),
    remove: useMutation({ mutationFn: api.pro.staff.remove, onSuccess: done }),
    setHours: useMutation({
      mutationFn: ({ id, hours }: { id: string; hours: Parameters<typeof api.pro.staff.setHours>[1] }) => api.pro.staff.setHours(id, hours),
      onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: queryKeys.pro.staffHours(v.id) }),
    }),
  };
}

export function useProBlockMutations() {
  const { api } = useApi();
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: queryKeys.pro.blocksAll });
    qc.invalidateQueries({ queryKey: ['availability'] });
  };
  return {
    create: useMutation({ mutationFn: api.pro.blocks.create, onSuccess: done }),
    remove: useMutation({ mutationFn: api.pro.blocks.remove, onSuccess: done }),
  };
}

export function useProBookingMutations() {
  const { api } = useApi();
  const qc = useQueryClient();
  const done = (b?: { id: string }) => {
    if (b) qc.setQueryData(queryKeys.pro.booking(b.id), b);
    qc.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
    qc.invalidateQueries({ queryKey: queryKeys.pro.stats });
    qc.invalidateQueries({ queryKey: ['availability'] });
  };
  return {
    createWalkIn: useMutation({ mutationFn: api.pro.bookings.createWalkIn, onSuccess: done }),
    setStatus: useMutation({ mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'completed' | 'no_show' }) => api.pro.bookings.setStatus(id, status), onSuccess: done }),
    cancel: useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.pro.bookings.cancel(id, reason), onSuccess: done }),
    reschedule: useMutation({ mutationFn: ({ id, startsAt, staffId }: { id: string; startsAt: string; staffId?: string | null }) => api.pro.bookings.reschedule(id, { startsAt, staffId }), onSuccess: done }),
    invalidateAll: () => invalidatePro(qc),
  };
}
