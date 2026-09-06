/** PRO-F 09 — Étape 7 : photos de la prestation (couverture + jusqu'à 6 exemples de résultats). */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Plus, X } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { stepPath } from '@/lib/proDraft';
import { Alert, Button, Grid, H1, I, Img, InfoBox, P, SectionLabel, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

const MAX_EXAMPLES = 6;

export default function Step7ServicePhotos() {
  const router = useRouter();
  const { serviceId = '' } = useLocalSearchParams<{ serviceId: string }>();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const service = salon?.services.find((s) => s.id === serviceId);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!salon) return <Splash />;
  if (!service) return <Redirect href={stepPath(6) as never} />;
  const photos = urls ?? (service.photos ?? []).map((p) => p.url);
  const cover = photos[0] ?? null;
  const examples = photos.slice(1);

  const add = async (asCover: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const imgs = await pickImages({ multiple: !asCover, max: MAX_EXAMPLES });
      if (!imgs.length) return;
      const uploaded: string[] = [];
      for (const img of imgs) uploaded.push(await uploadSalonImage(salon.id, img));
      setUrls(asCover ? [uploaded[0]!, ...photos.slice(1), ...uploaded.slice(1)].slice(0, MAX_EXAMPLES + 1) : [...(cover ? [cover] : [uploaded[0]!]), ...examples, ...(cover ? uploaded : uploaded.slice(1))].slice(0, MAX_EXAMPLES + 1));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = (url: string) => setUrls(photos.filter((u) => u !== url));

  const save = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await setPhotos.mutateAsync({ id: service.id, photos: photos.map((url) => ({ url })) });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      gap={16}
      footer={
        <StepSheet
          label="Enregistrer la prestation"
          onPress={() => void save().then((ok) => ok && router.push(stepPath(8) as never))}
          busy={busy || setPhotos.isPending}
          secondary={
            <Button variant="g" onPress={() => void save().then((ok) => ok && router.push(stepPath(6) as never))} disabled={busy}>
              Enregistrer et ajouter une autre
            </Button>
          }
        />
      }
    >
      <StepBar step={7} backTo={`${stepPath(6)}/${service.id}`} />
      <View style={{ gap: 8 }}>
        <H1>Photos · {service.name}</H1>
        <P>Une photo de couverture et jusqu'à {MAX_EXAMPLES} exemples de résultats.</P>
      </View>
      <SectionLabel>Couverture</SectionLabel>
      <Pressable accessibilityRole="button" accessibilityLabel="Choisir la photo de couverture" onPress={() => void add(true)} disabled={busy}>
        <Img src={cover} radius={20} style={{ height: 320, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          {!cover && (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <I icon={Camera} size={32} color={C.subtle} />
              <Tx size={15} color={C.subtle} lh={20}>
                Ajouter une photo
              </Tx>
            </View>
          )}
        </Img>
      </Pressable>
      <SectionLabel>Exemples de résultats</SectionLabel>
      <Grid cols={3}>
        {examples.map((u) => (
          <View key={u} style={{ aspectRatio: 1 }}>
            <Img src={u} radius={16} style={{ width: '100%', height: '100%' }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Retirer" onPress={() => remove(u)} style={{ position: 'absolute', right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <I icon={X} size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {examples.length < MAX_EXAMPLES && (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter un exemple" onPress={() => void add(false)} disabled={busy} style={{ aspectRatio: 1, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <I icon={Plus} size={28} color={C.subtle} />
          </Pressable>
        )}
      </Grid>
      <InfoBox>Les prestations avec photos sont réservées 3 fois plus souvent.</InfoBox>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
