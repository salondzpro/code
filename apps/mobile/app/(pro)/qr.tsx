/**
 * PRO-F 21 — QR code en vitrine : l'aperçu est l'affiche Salon DZ elle-même ; « Enregistrer » la capture en PNG
 * (1080 × 1440) et l'ajoute à la galerie ; « Partager » envoie l'image (ou le lien si la capture est impossible).
 */
import React, { useRef, useState } from 'react';
import { Platform, Share, View, useWindowDimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { Download, MoreHorizontal } from 'lucide-react-native';
import { useProSalon } from '@salondz/api-client';
import { publicHost, publicUrl } from '@/lib/salon';
import { Alert, Button, Grid, I, P, Toast, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { shareSalon } from '@/ui/ShareSheet';
import { POSTER_H, POSTER_W, QrPoster } from '@/ui/QrPoster';
import { C } from '@/theme/design';

export default function ProQr() {
  const salon = useProSalon().data?.salon ?? null;
  const poster = useRef<View>(null);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const url = publicUrl(salon.slug);
  const short = `${publicHost()}/s/${salon.slug}`;
  const scale = Math.min(1, (width - 32) / POSTER_W);

  const capture = () =>
    captureRef(poster, { format: 'png', quality: 1, width: 1080, height: 1440, result: 'tmpfile' });

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const uri = await capture();
      if (Platform.OS === 'web') {
        // Navigateur : téléchargement direct du PNG.
        const a = document.createElement('a');
        a.href = uri;
        a.download = `affiche-qr-${salon.slug}.png`;
        a.click();
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync(true);
        if (!perm.granted)
          throw new Error("Autorisez l'accès à la galerie pour enregistrer l'affiche.");
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      flash('Affiche enregistrée dans votre galerie');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer l'affiche.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setError(null);
    try {
      if (Platform.OS === 'web') return void (await shareSalon(salon.name, url));
      const uri = await capture();
      await Share.share({
        title: salon.name,
        message: `Prenez rendez-vous chez ${salon.name} en ligne, 24 h/24 : ${url}`,
        url: uri,
      });
    } catch {
      await shareSalon(salon.name, url);
    }
  };

  return (
    <Screen gap={13}>
      <TopBar backTo="/lien" right="QR code" />
      {/* Aperçu = l'affiche elle-même, mise à l'échelle de l'écran ; la capture se fait à la taille réelle. */}
      <View style={{ alignItems: 'center', height: POSTER_H * scale }}>
        <View
          style={{
            width: POSTER_W,
            height: POSTER_H,
            transform: [{ scale }],
            transformOrigin: 'top center',
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <QrPoster
            ref={poster}
            name={salon.name}
            url={url}
            short={short}
            logoUrl={salon.logoUrl ?? salon.coverUrl}
          />
        </View>
      </View>
      <P center>
        Votre affiche Salon DZ, prête à imprimer en vitrine ou à coller sur le miroir. Le scan ouvre
        directement votre page de réservation.
      </P>
      {error && <Alert>{error}</Alert>}
      <Grid cols={2}>
        <Button variant="g" onPress={() => void save()} disabled={busy} loading={busy}>
          <I icon={Download} size={14.5} />
          <Tx size={12} weight={600} ls={-0.2} lh={16}>
            Enregistrer
          </Tx>
        </Button>
        <Button onPress={() => void share()} disabled={busy}>
          <I icon={MoreHorizontal} size={14.5} color="#fff" />
          <Tx size={12} weight={600} color="#fff" ls={-0.2} lh={16}>
            Partager
          </Tx>
        </Button>
      </Grid>
      {toast && <Toast>{toast}</Toast>}
    </Screen>
  );
}
