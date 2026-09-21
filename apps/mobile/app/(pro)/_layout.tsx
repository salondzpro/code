import React from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { useRealtimeBookings } from '@/lib/realtime';
import { PushPrompt } from '@/ui/PushPrompt';
import { Splash } from '@/ui/Splash';
import { Screen } from '@/ui/Screen';
import { ErrorText } from '@/ui';
import { C } from '@/theme/design';

/**
 * Espace pro : session requise. Sans salon → onboarding étapes 1 à 4 (le salon est créé à l'étape 4) ;
 * avec salon → tout l'espace pro, y compris les étapes 5 à 10 (réutilisées comme réglages).
 * Enregistre le jeton push une fois le salon chargé.
 */
export default function ProLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments() as string[];
  const pro = useProSalon(!!session);
  const salon = pro.data?.salon ?? null;
  /**
   * UN SEUL canal pour toute la session pro : agenda, demandes, chiffres et notifications
   * se rafraîchissent quand une réservation change, et le compteur rouge de la barre
   * d'onglets suit sur tous les écrans. L'accueil et l'agenda s'y abonnaient aussi, ce qui
   * ouvrait deux canaux de même nom — pas fiable, et inutile puisque ce calque les couvre.
   */
  useRealtimeBookings(salon?.id);

  if (loading || (session && pro.isPending)) return <Splash />;
  if (!session) return <Redirect href={{ pathname: '/connexion', params: { role: 'pro', next: '/pro' } } as never} />;
  if (pro.isError)
    return (
      <Screen center>
        <ErrorText error={pro.error} retry={() => void pro.refetch()} />
      </Screen>
    );

  const i = segments.indexOf('onboarding');
  const onboarding = i >= 0;
  const stepSeg = onboarding ? segments[i + 1] : undefined;
  const step = stepSeg && /^\d+$/.test(stepSeg) ? Number(stepSeg) : null;
  const publish = stepSeg === 'publier';

  if (!salon) {
    if (!onboarding || step === null || step > 4) return <Redirect href="/onboarding/1" />;
  } else if (onboarding && (step === null || step <= 4) && !publish) {
    return <Redirect href={salon.services.length === 0 ? '/onboarding/6' : '/(pro)/(tabs)'} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
      {/* Les demandes arrivent par notification : expliqué d'abord, puis la fenêtre du système. */}
      <PushPrompt audience="pro" active={!!salon && !onboarding} />
    </>
  );
}
