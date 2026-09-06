import React, { useEffect, useRef } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push';
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
  const pushRegistered = useRef(false);
  const salon = pro.data?.salon ?? null;

  useEffect(() => {
    if (salon && !pushRegistered.current) {
      pushRegistered.current = true;
      registerForPushNotifications(api).catch((err) => console.warn('[push]', err));
    }
  }, [salon]);

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
    return <Redirect href={salon.services.length === 0 ? '/onboarding/5' : '/(pro)/(tabs)'} />;
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
