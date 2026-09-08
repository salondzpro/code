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
          <Tx size={27.5} weight={600} color="#fff" ls={-1.2} lh={31}>
            Salon
          </Tx>
          <Tx size={27.5} weight={400} color={C.white70} ls={-1.2} lh={31} style={{ marginLeft: 5 }}>
            DZ
          </Tx>
        </View>
        <Tx size={9} color="rgba(255,255,255,0.4)" ls={2.9} lh={11.5} mono style={{ marginTop: 8 }}>
          RÉSERVATION EN LIGNE
        </Tx>
      </View>
      <View style={{ position: 'absolute', bottom: 52, width: 98, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <Animated.View style={{ width: 52, height: 2, backgroundColor: '#fff', transform: [{ translateX: x }] }} />
      </View>
    </View>
  );
}
