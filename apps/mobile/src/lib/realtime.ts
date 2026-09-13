import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { queryKeys } from '@salondz/api-client';
import {
  REALTIME_DEBOUNCE_MS,
  REALTIME_RESYNC_MIN_MS,
  realtimeRetryDelay,
} from '@salondz/constants';
import { supabase } from './supabase';

/**
 * Temps réel = synchronisation d'AFFICHAGE (même logique que le web) : on invalide les caches
 * TanStack quand la base change, la source de vérité reste l'API. La RLS et le filtre serveur
 * (`salon_id`, `client_id`) limitent les événements reçus aux lignes du compte.
 *
 * On ÉCOUTE, jamais on ne sonde. Un téléphone perd son socket bien plus souvent qu'un
 * navigateur (mise en veille, bascule Wi-Fi/4G, réseau algérien capricieux) et les événements
 * manqués ne sont jamais rejoués : d'où la réconciliation à la reconnexion du canal et au
 * retour de l'application au premier plan, bornée pour ne pas requêter à chaque bascule.
 */

const uid = () => Math.random().toString(36).slice(2, 10);

type Bind = (channel: RealtimeChannel, onChange: () => void) => RealtimeChannel;

function useWatchedChannel(
  name: string,
  key: string | null | undefined,
  bind: Bind,
  invalidate: (qc: QueryClient) => void,
): void {
  const qc = useQueryClient();
  const bindRef = useRef(bind);
  const invalidateRef = useRef(invalidate);
  bindRef.current = bind;
  invalidateRef.current = invalidate;

  useEffect(() => {
    if (!key) return;

    let alive = true;
    let channel: RealtimeChannel | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let connectedOnce = false;
    let lastRefresh = Date.now();

    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!alive) return;
        lastRefresh = Date.now();
        invalidateRef.current(qc);
      }, REALTIME_DEBOUNCE_MS);
    };

    const resync = () => {
      if (!alive || Date.now() - lastRefresh < REALTIME_RESYNC_MIN_MS) return;
      refresh();
    };

    const connect = () => {
      if (!alive) return;
      if (channel) void supabase.removeChannel(channel);
      channel = bindRef.current(supabase.channel(`${name}:${key}:${uid()}`), refresh).subscribe(
        (status) => {
          if (!alive) return;
          if (status === 'SUBSCRIBED') {
            if (connectedOnce) resync();
            connectedOnce = true;
            attempt = 0;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (retry) clearTimeout(retry);
            retry = setTimeout(connect, realtimeRetryDelay(attempt++));
          }
        },
      );
    };

    connect();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resync();
    });

    return () => {
      alive = false;
      sub.remove();
      if (debounce) clearTimeout(debounce);
      if (retry) clearTimeout(retry);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, name, qc]);
}

/** Côté pro : tout mouvement sur les rendez-vous du salon. */
export function useRealtimeBookings(salonId: string | null | undefined): void {
  useWatchedChannel(
    'salon-bookings',
    salonId,
    (channel, onChange) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `salon_id=eq.${salonId}` },
        onChange,
      ),
    (qc) => {
      void qc.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.pro.stats });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  );
}

/** Côté cliente : ses rendez-vous et ses notifications. */
export function useRealtimeMyBookings(userId: string | null | undefined): void {
  useWatchedChannel(
    'my-bookings',
    userId,
    (channel, onChange) =>
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${userId}` },
          onChange,
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          onChange,
        ),
    (qc) => {
      void qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  );
}
