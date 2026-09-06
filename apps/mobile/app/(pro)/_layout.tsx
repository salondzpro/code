import React, { useEffect, useRef } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useProSalon } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/push';
import { ErrorText, Loading, Screen } from '@/components';
import { colors } from '@/theme/tokens';

/**
 * Garde de l'espace pro : session requise ; sans salon → onboarding.
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

  if (loading || (session && pro.isLoading)) return <Loading label="Chargement de votre espace…" />;
  if (!session) {
    return <Redirect href={{ pathname: '/connexion', params: { role: 'pro', next: '/pro' } } as never} />;
  }
  if (pro.isError) {
    return (
      <Screen>
        <ErrorText error={pro.error} onRetry={() => void pro.refetch()} />
      </Screen>
    );
  }

  const onOnboarding = segments.includes('onboarding');
  if (!salon && !onOnboarding) return <Redirect href="/(pro)/onboarding" />;
  if (salon && onOnboarding) return <Redirect href="/(pro)/(tabs)/agenda" />;

  return (
    <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ title: 'Créer mon salon', headerBackVisible: false }} />
      <Stack.Screen name="services" options={{ title: 'Services' }} />
      <Stack.Screen name="equipe" options={{ title: 'Équipe' }} />
      <Stack.Screen name="horaires" options={{ title: "Horaires d'ouverture" }} />
      <Stack.Screen name="blocages" options={{ title: 'Congés & pauses' }} />
      <Stack.Screen name="profil" options={{ title: 'Profil du salon' }} />
    </Stack>
  );
}
