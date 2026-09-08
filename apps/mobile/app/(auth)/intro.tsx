/** AUTH 02 — Introduction : photo plein cadre, accroche, « Commencer » / « Je suis professionnel ». */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { Button, Credit, Overlay, P, Tx } from '@/ui';
import { C } from '@/theme/design';

export default function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, minHeight: 260, overflow: 'hidden' }}>
        <Image source={{ uri: DESIGN_IMAGES.intro.src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <Overlay />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          <Tx size={21} weight={700} color="#fff" ls={-0.8} lh={23.5}>
            Réservez votre{'\n'}rendez-vous.
          </Tx>
        </View>
        <Credit>{DESIGN_IMAGES.intro.credit}</Credit>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 + insets.bottom, gap: 11 }}>
        <P>Barbiers, coiffure, ongles, cils, soins et laser — près de vous, avec les disponibilités en temps réel.</P>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 3 }} accessibilityElementsHidden>
          <View style={{ width: 16, height: 5, borderRadius: 2, backgroundColor: C.ink }} />
          <View style={{ width: 5, height: 5, borderRadius: 2, backgroundColor: C.line }} />
          <View style={{ width: 5, height: 5, borderRadius: 2, backgroundColor: C.line }} />
        </View>
        <Button onPress={() => router.push('/bienvenue')}>Commencer</Button>
        <Button variant="g" onPress={() => router.push('/pro-bienvenue')}>
          Je suis professionnel
        </Button>
      </View>
    </View>
  );
}
