import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';
import { C } from '@/theme/design';

/**
 * Pages salon publiques (lisibles sans compte) et parcours de réservation.
 *
 * Le temps réel est monté ici aussi, et pas seulement dans le groupe `(client)` : tout le
 * parcours `s/[slug]/reserver/*` vit dans ce groupe-ci, si bien qu'une cliente en train de
 * réserver ne voyait aucun changement de statut de ses AUTRES rendez-vous. Le web, lui,
 * niche ce parcours sous son garde client et était donc déjà couvert : c'était une asymétrie,
 * pas un choix. Sans session, le hook ne s'abonne à rien.
 */
export default function SalonLayout() {
  const { session } = useAuth();
  useRealtimeMyBookings(session?.user.id);
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
