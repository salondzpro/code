import React from 'react';
import { Stack } from 'expo-router';
import { C } from '@/theme/design';

/** Parcours de connexion (design AUTH 02 → 16) : écrans plein cadre, sans en-tête natif. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
