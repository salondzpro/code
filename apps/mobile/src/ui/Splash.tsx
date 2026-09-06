/** AUTH 01 — Splash : logo « Salon DZ » sur fond encre, barre de chargement. */
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { C } from '@/theme/design';
import { Tx } from './Text';

export function Splash() {
  const x = useRef(new Animated.Value(-64)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 120, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Chargement" style={{ flex: 1, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Tx size={40} weight={600} color="#fff" ls={-1.2} lh={44}>
            Salon
          </Tx>
          <Tx size={40} weight={400} color={C.white70} ls={-1.2} lh={44} style={{ marginLeft: 6 }}>
            DZ
          </Tx>
        </View>
        <Tx size={11} color="rgba(255,255,255,0.4)" ls={2.9} lh={14} mono style={{ marginTop: 10 }}>
          RÉSERVATION BEAUTÉ
        </Tx>
      </View>
      <View style={{ position: 'absolute', bottom: 64, width: 120, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <Animated.View style={{ width: 64, height: 3, backgroundColor: '#fff', transform: [{ translateX: x }] }} />
      </View>
    </View>
  );
}
