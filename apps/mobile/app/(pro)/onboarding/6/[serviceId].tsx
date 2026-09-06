import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Step6Service } from '@/screens/pro/Step6Service';

/** Modification d'une prestation existante (même écran que l'étape 6). */
export default function Step6Edit() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  return <Step6Service serviceId={serviceId} />;
}
