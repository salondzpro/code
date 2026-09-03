import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import { supabase } from './supabase';

/**
 * Realtime = synchronisation d'AFFICHAGE uniquement. La source de vérité reste
 * l'API (create_booking + contrainte d'exclusion). On invalide les caches TanStack.
 */
export function useRealtimeBookings(salonId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!salonId) return;
    const channel = supabase
      .channel(`salon-bookings-${salonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
          void queryClient.invalidateQueries({ queryKey: queryKeys.pro.stats });
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          void queryClient.invalidateQueries({ queryKey: ['availability'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [salonId, queryClient]);
}

export function useRealtimeMyBookings(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`client-bookings-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
