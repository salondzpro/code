/** PRO-F 21 — QR code en vitrine. */
import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MoreHorizontal } from 'lucide-react-native';
import { useProSalon } from '@salondz/api-client';
import { publicHost, publicUrl } from '@/lib/salon';
import { Avatar, Button, Card, Grid, I, P, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { shareSalon, useCopy } from '@/ui/ShareSheet';
import { C } from '@/theme/design';

export default function ProQr() {
  const salon = useProSalon().data?.salon ?? null;
  const [copied, copy] = useCopy();
  if (!salon) return <Splash />;
  const url = publicUrl(salon.slug);
  return (
    <Screen gap={13}>
      <TopBar backTo="/lien" right="QR code" />
      <Card gap={10} style={{ alignItems: 'center', paddingVertical: 26 }}>
        <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={52} />
        <Tx size={16} weight={700} ls={-0.4} lh={20.5}>
          {salon.name}
        </Tx>
        <Tx size={10.5} color={C.muted} lh={14.5}>
          {publicHost()}/s/{salon.slug}
        </Tx>
        <View style={{ marginTop: 6, borderRadius: 13, overflow: 'hidden', padding: 6, backgroundColor: '#fff' }}>
          <QRCode value={url} size={214.5} color={C.ink} backgroundColor="#fff" />
        </View>
      </Card>
      <P center>À imprimer en vitrine ou à coller sur le miroir. Le scan ouvre directement votre page de réservation.</P>
      <Grid cols={2}>
        <Button variant="g" onPress={() => copy(url)}>
          {copied ? 'Lien copié' : 'Copier le lien'}
        </Button>
        <Button onPress={() => void shareSalon(salon.name, url)}>
          <I icon={MoreHorizontal} size={14.5} color="#fff" />
          <Tx size={10.5} weight={600} color="#fff" ls={-0.2}>
            Partager
          </Tx>
        </Button>
      </Grid>
    </Screen>
  );
}
