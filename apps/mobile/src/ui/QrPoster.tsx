/**
 * Affiche QR « Réservez en ligne » (PRO-F 21) aux couleurs de Salon DZ : wordmark de la plateforme, logo et nom du
 * salon, QR code en grand, appel à l'action, lien court. Rendue en natif puis capturée (react-native-view-shot)
 * pour l'enregistrer dans la galerie ou la partager. Proportions 3:4 (1080 × 1440 à l'export).
 */
import React, { forwardRef } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Avatar, Tx } from './index';
import { C } from '@/theme/design';

export const POSTER_W = 340;
export const POSTER_H = Math.round((POSTER_W * 4) / 3);

export const QrPoster = forwardRef<
  View,
  { name: string; url: string; short: string; logoUrl?: string | null }
>(function QrPoster({ name, url, short, logoUrl }, ref) {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{ width: POSTER_W, height: POSTER_H, backgroundColor: C.fill, padding: 18 }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.line,
          alignItems: 'center',
          paddingTop: 22,
          paddingHorizontal: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Tx size={20} weight={600} ls={-0.6} lh={24}>
            Salon
          </Tx>
          <Tx size={20} weight={400} ls={-0.6} lh={24} color={C.muted}>
            DZ
          </Tx>
        </View>
        <Tx size={7} weight={500} ls={2.4} lh={10} color={C.subtle} upper>
          Réservation en ligne
        </Tx>
        <View style={{ marginTop: 18 }}>
          <Avatar src={logoUrl} name={name} size={54} />
        </View>
        <Tx
          size={17.5}
          weight={700}
          ls={-0.5}
          lh={22}
          center
          numberOfLines={1}
          style={{ marginTop: 10 }}
        >
          {name}
        </Tx>
        <Tx size={9.5} weight={500} lh={13} color={C.muted} center>
          Prenez rendez-vous en ligne, 24 h/24
        </Tx>
        <View
          style={{
            marginTop: 14,
            padding: 9,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: '#fff',
          }}
        >
          <QRCode value={url} size={176} color={C.ink} backgroundColor="#fff" />
        </View>
        <View
          style={{
            marginTop: 16,
            backgroundColor: C.ink,
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 7,
          }}
        >
          <Tx size={9.5} weight={600} lh={13} color="#fff">
            Scannez pour réserver
          </Tx>
        </View>
        <Tx
          size={9}
          weight={500}
          lh={12}
          color={C.muted}
          center
          numberOfLines={1}
          style={{ marginTop: 12 }}
        >
          {short}
        </Tx>
        <Tx size={6.5} lh={9} color={C.subtle} center style={{ position: 'absolute', bottom: 12 }}>
          Confirmation immédiate · Rappel avant le rendez-vous · Fait en Algérie
        </Tx>
      </View>
    </View>
  );
});
