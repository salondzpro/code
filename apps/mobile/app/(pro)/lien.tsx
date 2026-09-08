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
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)" />
      <H1>Votre page de{'\n'}réservation</H1>
      <Card gap={13} style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Agrandir le QR code" onPress={() => router.push('/qr')} style={{ width: 276, maxWidth: '100%', aspectRatio: 1, borderRadius: 20, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
          <QRCode value={url} size={244} color={C.ink} backgroundColor={C.fill} />
        </Pressable>
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: R.cardSm, backgroundColor: C.fill, paddingHorizontal: 16, paddingVertical: 13 }}>
          <Tx size={12} lh={16} numberOfLines={1} style={{ flex: 1 }}>
            {short}
          </Tx>
          <IconButton accessibilityLabel="Copier le lien" onPress={() => copy(url)} style={{ width: 26, height: 26, borderWidth: 0, backgroundColor: 'transparent' }}>
            <I icon={copied ? Check : Copy} size={14.5} />
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
        <Row py={13} chevron={false} right={<Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v })} label="Réservation en ligne" />}>
          <Tx size={12} color={C.muted} lh={16}>
            Réservation en ligne
          </Tx>
        </Row>
        <Row py={13} chevron={false} onPress={() => router.push('/reglages-pro/regles')} right={<Tx size={14.5} weight={700} lh={18.5}>{lead}</Tx>}>
          <Tx size={12} color={C.muted} lh={16}>
            Délai minimum
          </Tx>
        </Row>
        <Row py={13} chevron={false} right={<Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v })} label="Validation manuelle" />}>
          <Tx size={12} color={C.muted} lh={16}>
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
