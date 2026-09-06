/** AUTH 03 — Choix du compte : « Je réserve » / « Je suis professionnel ». */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { UserRole } from '@salondz/constants';
import { writeAuthFlow } from '@/lib/authFlow';
import { Button, Card, H1, H3, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';

export default function Welcome() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('client');

  const go = () => {
    writeAuthFlow({ role, next: role === 'pro' ? '/pro' : '/' });
    router.push({ pathname: '/connexion', params: { role } });
  };

  return (
    <Screen center gap={16}>
      <View style={{ marginTop: -60, gap: 8 }}>
        <H3>Beauty · Algérie</H3>
        <H1>Bienvenue.{'\n'}Qui êtes-vous ?</H1>
      </View>
      <View style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Type de compte">
        <Card sel={role === 'client'} onPress={() => setRole('client')} accessibilityLabel="Je réserve">
          <Tx size={20} weight={600} ls={-0.3} lh={25}>
            Je réserve
          </Tx>
          <P>Créer mon compte ou me connecter, puis réserver : un compte est nécessaire pour prendre rendez-vous.</P>
        </Card>
        <Card sel={role === 'pro'} onPress={() => setRole('pro')} accessibilityLabel="Je suis professionnel">
          <Tx size={20} weight={600} ls={-0.3} lh={25}>
            Je suis professionnel
          </Tx>
          <P>Recevoir des réservations, gérer mon agenda et partager ma page.</P>
        </Card>
      </View>
      <Button onPress={go}>Continuer</Button>
      <P center>Une seule vérification WhatsApp · session conservée ensuite</P>
    </Screen>
  );
}
