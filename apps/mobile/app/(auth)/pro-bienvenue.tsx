/** AUTH 16 / PRO-F 01 — Bienvenue professionnel : photo, promesse, trois garanties, « Créer mon espace pro ». */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { Button, Credit, I, Overlay, Row, Rows, TextLink, Tx } from '@/ui';
import { C } from '@/theme/design';

const PROMISES = ['Réservations en ligne 24 h/24', 'Page publique partageable', 'Rappels WhatsApp automatiques'];

export default function ProWelcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    if (session) router.replace('/(pro)');
    else router.push({ pathname: '/connexion', params: { role: 'pro' } });
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
      <StatusBar style="light" />
      <View style={{ height: 341, overflow: 'hidden' }}>
        <Image source={{ uri: DESIGN_IMAGES.pro.src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <Overlay />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 6 }}>
          <Tx size={10} weight={600} color={C.white70} ls={0.96} lh={13} upper>
            Espace professionnel
          </Tx>
          <Tx size={21} weight={700} color="#fff" ls={-0.8} lh={23.5}>
            Votre agenda,{'\n'}votre page, votre lien.
          </Tx>
        </View>
        <Credit>{DESIGN_IMAGES.pro.credit}</Credit>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 13, paddingBottom: 32 + insets.bottom, gap: 13 }}>
        <Rows>
          {PROMISES.map((p) => (
            <Row key={p} chevron={false} right={<I icon={Check} size={16} color={C.okFg} />}>
              <Tx size={10.5} lh={14.5}>
                {p}
              </Tx>
            </Row>
          ))}
        </Rows>
        <Button onPress={start}>Créer mon espace pro</Button>
        <TextLink size={12} onPress={() => router.push({ pathname: '/connexion', params: { role: 'pro' } })}>
          Déjà inscrit ? Se connecter
        </TextLink>
      </View>
    </ScrollView>
  );
}
