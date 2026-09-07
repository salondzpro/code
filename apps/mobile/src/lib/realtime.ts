import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import { supabase } from './supabase';

/**
 * Nom de canal unique par abonnement : `supabase.channel(nom)` renvoie le canal existant s'il porte
 * le même nom, et l'on ne peut plus lui ajouter d'écouteurs une fois abonné (ré-exécution des
 * effets React en développement, retour au premier plan…).
 */
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Realtime = synchronisation d'AFFICHAGE uniquement (même logique que le web) : on invalide les
 * caches TanStack quand la base change, la source de vérité reste l'API. La RLS limite les
 * événements reçus aux réservations du salon (pro) ou du client connecté.
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
        void qc.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
        void qc.invalidateQueries({ queryKey: queryKeys.pro.stats });
        void qc.invalidateQueries({ queryKey: queryKeys.pro.pending });
        void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      }, 300);
    };
    const channel = supabase
      .channel(`salon-bookings:${salonId}:${uid()}`)
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
        void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      }, 300);
    };
    const channel = supabase
      .channel(`my-bookings:${userId}:${uid()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
