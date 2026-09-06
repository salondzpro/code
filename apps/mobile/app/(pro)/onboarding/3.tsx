/** PRO-F 05 — Étape 3 : identité visuelle (photo de couverture, logo ou portrait). */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { pickImages } from '@/lib/images';
import { errorText } from '@/lib/errors';
import { draftFiles, stepPath, type LocalImage } from '@/lib/proDraft';
import { Alert, Button, H1, I, Img, P, SectionLabel, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

export default function Step3Identity() {
  const router = useRouter();
  const [cover, setCover] = useState<LocalImage | undefined>(draftFiles.get().cover);
  const [logo, setLogo] = useState<LocalImage | undefined>(draftFiles.get().logo);
  const [error, setError] = useState<string | null>(null);

  const choose = async (kind: 'cover' | 'logo') => {
    setError(null);
    try {
      const [img] = await pickImages({ square: kind === 'logo' });
      if (!img) return;
      if (kind === 'cover') {
        setCover(img);
        draftFiles.set({ cover: img });
      } else {
        setLogo(img);
        draftFiles.set({ logo: img });
      }
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16} footer={<StepSheet onPress={() => router.push(stepPath(4) as never)} />}>
      <StepBar step={3} backTo={stepPath(2)} />
      <H1>Votre identité visuelle</H1>
      <SectionLabel>Photo de couverture</SectionLabel>
      <Pressable accessibilityRole="button" accessibilityLabel="Choisir la photo de couverture" onPress={() => void choose('cover')}>
        <Img src={cover?.uri} radius={20} style={{ height: 220, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
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
      <SectionLabel>Logo ou portrait</SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choisir le logo" onPress={() => void choose('logo')}>
          <Img src={logo?.uri} radius={64} style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center' }}>
            {!logo && <I icon={Camera} size={28} color={C.subtle} />}
          </Img>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Tx size={17} lh={22}>
            Format carré, visage ou logo centré
          </Tx>
          <P>JPG ou PNG · 2 Mo max</P>
        </View>
      </View>
      <Button variant="g" onPress={() => void choose(cover ? 'logo' : 'cover')}>
        {cover || logo ? 'Remplacer les images' : 'Choisir les images'}
      </Button>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
