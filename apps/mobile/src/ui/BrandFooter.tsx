/** Logo « Salon DZ » (même wordmark que le splash, en encre sur fond clair) en pied des pages Profil client et pro. */
import React from 'react';
import { View } from 'react-native';
import { C } from '@/theme/design';
import { Tx } from './Text';

export function BrandFooter() {
  const year = new Date().getFullYear();
  return (
    <View accessibilityLabel="Salon DZ" style={{ alignItems: 'center', gap: 4, marginTop: 20, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Tx size={19.5} weight={600} ls={-0.9} lh={23}>
          Salon
        </Tx>
        <Tx size={19.5} weight={400} color={C.muted} ls={-0.9} lh={23} style={{ marginLeft: 4 }}>
          DZ
        </Tx>
      </View>
      <Tx size={8} color={C.subtle} ls={2.3} lh={11} mono>
        RÉSERVATION EN LIGNE
      </Tx>
      <Tx size={10} color={C.subtle} lh={13}>
        {`© ${year} Salon DZ · Fait en Algérie`}
      </Tx>
    </View>
  );
}
