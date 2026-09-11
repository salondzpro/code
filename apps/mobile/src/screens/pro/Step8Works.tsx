/**
 * PRO-F 10 — Étape 8 / Mon salon → « Réalisations » : les photos du travail réel (coupes, coiffures, barbes,
 * colorations, ongles…), plusieurs à la fois, sans lien avec une prestation. Section séparée des couvertures
 * (Photos du salon) et de l'image unique de chaque prestation. Réutilisé en réglage (`settings`).
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { SALON_MAX_WORKS } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { stepPath } from '@/lib/proDraft';
import { Alert, Grid, H1, I, Img, InfoBox, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

export function Step8Works({ settings }: { settings?: boolean }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { setWorks } = useProSalonMutations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!salon) return <Splash />;
  const works = salon.works;
  const room = Math.max(0, SALON_MAX_WORKS - works.length);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const imgs = await pickImages({ multiple: true, max: Math.min(10, room) });
      if (!imgs.length) return;
      const urls: string[] = [];
      for (const img of imgs) urls.push(await uploadSalonImage(salon.id, img));
      await setWorks.mutateAsync([
        ...works.map((p) => ({ url: p.url })),
        ...urls.map((url) => ({ url })),
      ]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (url: string) => {
    setError(null);
    try {
      await setWorks.mutateAsync(works.filter((p) => p.url !== url).map((p) => ({ url: p.url })));
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={13}
      footer={
        settings ? undefined : (
          <StepSheet onPress={() => router.push(stepPath(9) as never)} busy={busy} />
        )
      }
    >
      <StepBar
        step={8}
        backTo={settings ? '/mon-salon' : stepPath(6)}
        right={settings ? 'Mon salon' : undefined}
      />
      <View style={{ gap: 6 }}>
        <H1>{settings ? 'Réalisations' : 'Vos réalisations'}</H1>
        <P>Vos photos de travail, visibles dans l'onglet « Réalisations ».</P>
      </View>
      <Grid cols={3}>
        {works.map((w) => (
          <View key={w.id} style={{ aspectRatio: 1 }}>
            <Img src={w.url} radius={13} style={{ width: '100%', height: '100%' }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retirer"
              disabled={setWorks.isPending}
              onPress={() => void remove(w.url)}
              style={{
                position: 'absolute',
                right: 5,
                top: 5,
                width: 23,
                height: 23,
                borderRadius: 11,
                backgroundColor: 'rgba(0,0,0,0.6)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <I icon={X} size={11.5} color="#fff" />
            </Pressable>
          </View>
        ))}
        {room > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter des réalisations"
            onPress={() => void add()}
            disabled={busy}
            style={{
              aspectRatio: 1,
              borderRadius: 13,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: C.line,
              backgroundColor: C.fill,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <I icon={Plus} size={21} color={C.subtle} />
            <Tx size={11.5} color={C.subtle} lh={14.5}>
              {busy ? 'Envoi…' : 'Ajouter'}
            </Tx>
          </Pressable>
        )}
      </Grid>
      <InfoBox>{`${works.length}/${SALON_MAX_WORKS} photos. Chaque prestation garde une seule image représentative : ici, c'est votre vitrine.`}</InfoBox>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
