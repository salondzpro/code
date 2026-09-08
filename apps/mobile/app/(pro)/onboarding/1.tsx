/** PRO-F 03 — Étape 1 : « Vous travaillez pour ? » — le marché définit le catalogue et la marketplace. */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { MARKET_LABELS_FR, categoriesForMarket, type Market } from '@salondz/constants';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { readProDraft, stepPath, writeProDraft } from '@/lib/proDraft';
import { H1, I, Overlay, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

const CARDS: { id: Market; img: string }[] = [
  { id: 'men', img: DESIGN_IMAGES.marketMen.src },
  { id: 'women', img: DESIGN_IMAGES.marketWomen.src },
];

export default function Step1Market() {
  const router = useRouter();
  const [market, setMarket] = useState<Market | undefined>(readProDraft().market);
  return (
    <Screen
      gap={13}
      footer={
        <StepSheet
          disabled={!market}
          onPress={() => {
            writeProDraft({ market });
            router.push(stepPath(2) as never);
          }}
        />
      }
    >
      <StepBar step={1} backTo="/pro-bienvenue" />
      <View style={{ gap: 10 }}>
        <H1>Vous travaillez pour ?</H1>
        <P>Ce choix définit votre catalogue de prestations et la marketplace dans laquelle vous apparaissez.</P>
      </View>
      {CARDS.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={MARKET_LABELS_FR[c.id]} accessibilityState={{ selected: market === c.id }} onPress={() => setMarket(c.id)} style={{ height: 171, borderRadius: 20, overflow: 'hidden', backgroundColor: C.line, borderWidth: 2, borderColor: market === c.id ? C.ink : 'transparent' }}>
          <Image source={{ uri: c.img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <Overlay />
          {market === c.id && (
            <View style={{ position: 'absolute', right: 13, top: 13, width: 29, height: 29, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <I icon={Check} size={16} color={C.ink} />
            </View>
          )}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 3 }}>
            <Tx size={18} weight={700} color="#fff" ls={-0.6} lh={20.5}>
              {MARKET_LABELS_FR[c.id]}
            </Tx>
            <Tx size={11.5} color={C.white85} lh={15.5}>
              {categoriesForMarket(c.id)
                .slice(0, c.id === 'men' ? 5 : 4)
                .map((x) => x.labelFr)
                .join(' · ')}
            </Tx>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
