import React from 'react';
import { Stack } from 'expo-router';
import { C } from '@/theme/design';

/** Pages salon publiques (lisibles sans compte) et parcours de réservation. */
export default function SalonLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />;
}
