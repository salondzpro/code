import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useProSalonMutations } from '@salondz/api-client';
import { Muted, SalonForm, Screen, Title, errorMessage } from '@/components';

/** Création du salon (première connexion pro). */
export default function Onboarding() {
  const router = useRouter();
  const { createSalon } = useProSalonMutations();

  return (
    <Screen scroll>
      <Title>Bienvenue sur SalonDZ 👋</Title>
      <Muted>Créez votre salon en 1 minute. Vous ajouterez ensuite vos services et vos horaires, puis vous publierez votre page.</Muted>
      <SalonForm
        submitLabel="Créer mon salon"
        submitting={createSalon.isPending}
        onSubmit={(values) =>
          createSalon.mutate(values, {
            onSuccess: () => router.replace('/(pro)/(tabs)/agenda' as never),
            onError: (e) => Alert.alert('Impossible de créer le salon', errorMessage(e)),
          })
        }
      />
    </Screen>
  );
}
