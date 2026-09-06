/** PRO-F 17 — Votre page de réservation : QR code, lien, Partager / Copier, réglages rapides. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Check, Copy } from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { publicHost, publicUrl } from '@/lib/salon';
import { Badge, Button, Card, Grid, H1, I, IconButton, ListCard, Row, Toast, Toggle, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ShareSheet, useCopy } from '@/ui/ShareSheet';
import { C, R } from '@/theme/design';

export default function ProLink() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [copied, copy] = useCopy();
  if (!salon) return <Splash />;
  const url = publicUrl(salon.slug);
  const short = `${publicHost()}/s/${salon.slug}`;
  const lead = salon.bookingLeadTimeMinutes >= 60 ? `${Math.round(salon.bookingLeadTimeMinutes / 60)} h` : `${salon.bookingLeadTimeMinutes} min`;

  return (
    <Screen gap={16}>
      <TopBar backTo="/(pro)/(tabs)" />
      <H1>Votre page de{'\n'}réservation</H1>
      <Card gap={16} style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Agrandir le QR code" onPress={() => router.push('/qr')} style={{ width: 340, maxWidth: '100%', aspectRatio: 1, borderRadius: 24, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
          <QRCode value={url} size={300} color={C.ink} backgroundColor={C.fill} />
        </Pressable>
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: R.cardSm, backgroundColor: C.fill, paddingHorizontal: 20, paddingVertical: 16 }}>
          <Tx size={19} lh={24} numberOfLines={1} style={{ flex: 1 }}>
            {short}
          </Tx>
          <IconButton accessibilityLabel="Copier le lien" onPress={() => copy(url)} style={{ width: 32, height: 32, borderWidth: 0, backgroundColor: 'transparent' }}>
            <I icon={copied ? Check : Copy} size={18} />
          </IconButton>
        </View>
      </Card>
      <Grid cols={2}>
        <Button onPress={() => setSheet(true)}>Partager</Button>
        <Button variant="g" onPress={() => copy(url)}>
          Copier
        </Button>
      </Grid>
      <ListCard>
        <Row py={16} chevron={false} right={<Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v })} label="Réservation en ligne" />}>
          <Tx size={19} color={C.muted} lh={24}>
            Réservation en ligne
          </Tx>
        </Row>
        <Row py={16} chevron={false} onPress={() => router.push('/reglages-pro/regles')} right={<Tx size={22} weight={700} lh={27}>{lead}</Tx>}>
          <Tx size={19} color={C.muted} lh={24}>
            Délai minimum
          </Tx>
        </Row>
        <Row py={16} chevron={false} right={<Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v })} label="Validation manuelle" />}>
          <Tx size={19} color={C.muted} lh={24}>
            Validation manuelle
          </Tx>
        </Row>
      </ListCard>
      {!salon.isPublished && (
        <Badge tone="pd" md>
          Page non publiée · activez la réservation en ligne
        </Badge>
      )}
      {copied && <Toast icon={Check}>Lien copié</Toast>}
      <ShareSheet open={sheet} onClose={() => setSheet(false)} name={salon.name} slug={salon.slug} />
    </Screen>
  );
}
