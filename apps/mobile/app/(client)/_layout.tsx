import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="salon/[slug]/index" options={{ title: '', headerBackTitle: 'Retour' }} />
      <Stack.Screen name="salon/[slug]/reserver" options={{ title: 'Réserver', headerBackTitle: 'Retour' }} />
      <Stack.Screen name="favoris" options={{ title: 'Mes favoris', headerBackTitle: 'Retour' }} />
    </Stack>
  );
}
