/** AUTH 15 — Choix du marché : « Pour Hommes » / « Pour Femmes » (modifiable depuis le profil). */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, type Market as MarketId } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, resolveNext } from '@/lib/authFlow';
import { Credit, H1, H3, Overlay, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

const CARDS: { id: MarketId; img: { src: string; credit: string } }[] = [
  { id: 'men', img: DESIGN_IMAGES.marketMen },
  { id: 'women', img: DESIGN_IMAGES.marketWomen },
];

export default function Market() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = params.next || '/';
  const { session } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  if (!session) return <Redirect href="/connexion" />;

  const choose = async (market: MarketId) => {
    await update.mutateAsync({ market });
    router.replace(resolveNext(next) as never);
  };

  return (
    <Screen gap={16}>
      <View style={{ paddingTop: 16, gap: 8 }}>
        <H3>{me.data?.profile.market ? 'Changer de marché' : 'Alger'}</H3>
        <H1>Que recherchez-vous ?</H1>
      </View>
      {CARDS.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={MARKET_LABELS_FR[c.id]} onPress={() => void choose(c.id)} disabled={update.isPending} style={({ pressed }) => ({ height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: C.line, opacity: pressed ? 0.9 : 1 })}>
          <Image source={{ uri: c.img.src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <Overlay />
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 36, gap: 6 }}>
            <Tx size={28} weight={700} color="#fff" ls={-0.7} lh={31}>
              {MARKET_LABELS_FR[c.id]}
            </Tx>
            <Tx size={15} color={C.white85} lh={20}>
              {categoriesForMarket(c.id)
                .slice(0, c.id === 'men' ? 5 : 4)
                .map((x) => x.labelFr)
                .join(' · ')}
            </Tx>
          </View>
          <Credit>{c.img.credit}</Credit>
        </Pressable>
      ))}
      <P center>Modifiable à tout moment depuis le profil.</P>
    </Screen>
  );
}
