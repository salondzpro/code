import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import { supabase } from './supabase';

/**
 * Realtime = synchronisation d'AFFICHAGE uniquement : on invalide les caches TanStack,
 * la source de vérité reste l'API / la base.
 */
export function useRealtimeBookings(salonId: string | null | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!salonId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      // Debounce : plusieurs événements rapprochés → une seule invalidation
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
        qc.invalidateQueries({ queryKey: queryKeys.pro.stats });
        qc.invalidateQueries({ queryKey: queryKeys.pro.pending });
        qc.invalidateQueries({ queryKey: queryKeys.notifications });
      }, 300);
    };
    const channel = supabase
      .channel(`salon-bookings:${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [salonId, qc]);
}

export function useRealtimeMyBookings(userId: string | null | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    };
    const channel = supabase
      .channel(`my-bookings:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
