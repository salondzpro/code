import React, { useEffect, useRef } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useMe } from '@salondz/api-client';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerPushIfGranted } from '@/lib/push';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { Splash } from '@/ui/Splash';
import { Screen } from '@/ui/Screen';
import { ErrorText } from '@/ui';
import { C } from '@/theme/design';

/**
 * Espace client : session requise, profil complété (prénom) et marché choisi.
 * Sans session → introduction (AUTH 02). Profil incomplet → AUTH 13. Sans marché → AUTH 15.
 */
export default function ClientLayout() {
  const { session, loading } = useAuth();
  const me = useMe(!!session);
  // Mes rendez-vous et notifications se rafraîchissent quand le salon confirme, déplace ou annule.
  useRealtimeMyBookings(session?.user.id);
  // Jeton push tenu à jour si la permission est déjà accordée (la demande se fait après une réservation).
  const pushRefreshed = useRef(false);
  useEffect(() => {
    if (me.data && !pushRefreshed.current) {
      pushRefreshed.current = true;
      registerPushIfGranted(api).catch((err) => console.warn('[push]', err));
    }
  }, [me.data]);
  if (loading || (session && me.isPending)) return <Splash />;
  if (!session) return <Redirect href="/intro" />;
  if (me.isError)
    return (
      <Screen center>
        <ErrorText error={me.error} retry={() => void me.refetch()} />
      </Screen>
    );
  const p = me.data!.profile;
  if (!p.fullName) return <Redirect href="/profil-creer" />;
  if (!p.market && p.role !== 'pro') return <Redirect href="/marche" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
