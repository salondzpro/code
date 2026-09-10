/**
 * PRO-F 09 — Étape 7 : LA photo de la prestation (une seule image représentative, recadrée en carré).
 * Les photos du travail réel (plusieurs) vont dans « Réalisations » (étape 8 / Mon salon).
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Trash2 } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { stepPath } from '@/lib/proDraft';
import { Alert, Button, H1, I, Img, InfoBox, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

export default function Step7ServicePhotos() {
  const router = useRouter();
  const { serviceId = '' } = useLocalSearchParams<{ serviceId: string }>();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const service = salon?.services.find((s) => s.id === serviceId);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!salon) return <Splash />;
  if (!service) return <Redirect href={stepPath(6) as never} />;
  const photo = url === undefined ? (service.photos?.[0]?.url ?? null) : url;
  // Salon déjà publié = on vient du catalogue (retour au catalogue) ; sinon on est dans l'inscription (étape 8).
  const fromCatalog = salon.isPublished;

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const [img] = await pickImages({ square: true });
      if (!img) return;
      setUrl(await uploadSalonImage(salon.id, img));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await setPhotos.mutateAsync({ id: service.id, photos: photo ? [{ url: photo }] : [] });
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
      gap={13}
      footer={
        <StepSheet
          label="Enregistrer la prestation"
          onPress={() =>
            void save().then(
              (ok) => ok && router.push((fromCatalog ? '/prestations' : stepPath(8)) as never),
            )
          }
          busy={busy || setPhotos.isPending}
          secondary={
            <Button
              variant="g"
              onPress={() => void save().then((ok) => ok && router.push(stepPath(6) as never))}
              disabled={busy}
            >
              Enregistrer et ajouter une autre
            </Button>
          }
        />
      }
    >
      <StepBar
        step={7}
        backTo={`${stepPath(6)}/${service.id}`}
        right={fromCatalog ? 'Catalogue' : undefined}
      />
      <View style={{ gap: 6 }}>
        <H1>Photo · {service.name}</H1>
        <P>Une seule image, celle qui représente le mieux cette prestation.</P>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photo ? 'Changer la photo' : 'Ajouter une photo'}
        onPress={() => void pick()}
        disabled={busy}
      >
        <Img
          src={photo}
          radius={16}
          style={{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {!photo && (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <I icon={Camera} size={26} color={C.subtle} />
              <Tx size={12} color={C.subtle} lh={16}>
                Ajouter une photo
              </Tx>
            </View>
          )}
          {!!photo && (
            <View
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <I icon={Camera} size={11} />
              <Tx size={9.5} weight={600} lh={12}>
                {busy ? 'Envoi…' : 'Changer'}
              </Tx>
            </View>
          )}
        </Img>
      </Pressable>
      {!!photo && (
        <Button variant="g" sm onPress={() => setUrl(null)} disabled={busy}>
          <I icon={Trash2} size={14} />
          <Tx size={11.5} weight={600} lh={15}>
            Retirer la photo
          </Tx>
        </Button>
      )}
      <InfoBox>
        Les prestations avec photo sont réservées 3 fois plus souvent. Vos autres photos ont leur
        place dans « Réalisations ».
      </InfoBox>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
