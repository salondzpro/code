import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { queryKeys } from '@salondz/api-client';
import {
  REALTIME_DEBOUNCE_MS,
  REALTIME_RESYNC_MIN_MS,
  realtimeRetryDelay,
} from '@salondz/constants';
import { supabase } from './supabase';
import { isDemo } from '@/demo/session';

/**
 * Temps réel = synchronisation d'AFFICHAGE. On invalide les caches TanStack quand la base
 * change ; la source de vérité reste l'API. La RLS limite les événements reçus aux lignes
 * que le compte a le droit de lire, et le filtre serveur (`salon_id`, `client_id`) fait que
 * chaque pro ne reçoit que son salon : le coût ne dépend pas du nombre de salons.
 *
 * On ÉCOUTE, jamais on ne sonde. Aucun intervalle périodique ici. Les trois seules sources
 * de rafraîchissement sont : un événement de la base, une reconnexion du canal, un retour
 * au premier plan. Les deux dernières sont les réconciliations, indispensables parce qu'un
 * socket peut tomber sans prévenir (veille, passage Wi-Fi/4G, coupure côté serveur) et que
 * les événements manqués pendant la coupure ne sont jamais rejoués.
 */

/**
 * Nom de canal unique par tentative : `supabase.channel(nom)` renvoie le canal existant s'il
 * porte le même nom, et l'on ne peut plus lui ajouter d'écouteurs une fois abonné.
 */
const uid = () => Math.random().toString(36).slice(2, 10);

type Bind = (channel: RealtimeChannel, onChange: () => void) => RealtimeChannel;

/**
 * Abonnement surveillé et auto-réparé. `key` identifie la ressource écoutée (null = pas
 * d'abonnement), `bind` pose les écouteurs, `invalidate` dit quels caches rafraîchir.
 */
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
    // Démonstration : pas de canal, le monde local avance et l'écran suit (toutes les 20 s).
    // Le moteur est importé à la demande (il n'est pas dans le bundle d'entrée).
    if (isDemo()) {
      const timer = setInterval(() => {
        void import('@/demo/fetch').then(({ demoAdvance, demoWorld }) => {
          if (demoAdvance(demoWorld(), Date.now(), true) > 0) invalidateRef.current(qc);
        });
      }, 20_000);
      return () => clearInterval(timer);
    }

    let alive = true;
    let channel: RealtimeChannel | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let connectedOnce = false;
    let lastRefresh = Date.now(); // le montage vient de charger les données : pas de doublon

    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!alive) return;
        lastRefresh = Date.now();
        invalidateRef.current(qc);
      }, REALTIME_DEBOUNCE_MS);
    };

    /** Rattrapage après un trou de réseau, borné pour ne pas se répéter à chaque bascule d'onglet. */
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
            // Première connexion : les données viennent d'être chargées, rien à rattraper.
            // Reconnexion : on a pu manquer des événements, donc on réconcilie.
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

    // Retour au premier plan et retour du réseau : deux événements, pas une minuterie.
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', resync);

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', resync);
      if (debounce) clearTimeout(debounce);
      if (retry) clearTimeout(retry);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, name, qc]);
}

/** Côté pro : tout mouvement sur les rendez-vous du salon, et ses propres notifications. */
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
