/**
 * Profil pro → « Photos du salon » : photo de profil (logo rond) et photos de couverture (la première est la
 * couverture ; jusqu'à SALON_MAX_PHOTOS). Répercuté partout : cartes marketplace, page publique, favoris, rendez-vous.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Camera, Plus, Star, X } from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { SALON_MAX_PHOTOS } from '@salondz/constants';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { errorText } from '@/lib/errors';
import { Alert, Avatar, Button, Card, I, Img, InfoBox, P, SectionLabel, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProPhotos() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [busy, setBusy] = useState<'logo' | 'photos' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const photos = salon.photos;
  const room = Math.max(0, SALON_MAX_PHOTOS - photos.length);

  const changeLogo = async () => {
    setError(null);
    try {
      const [img] = await pickImages({ square: true });
      if (!img) return;
      setBusy('logo');
      const url = await uploadSalonImage(salon.id, img);
      await updateSalon.mutateAsync({ logoUrl: url });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const addPhotos = async () => {
    setError(null);
    try {
      const imgs = await pickImages({ multiple: true, max: room });
      if (imgs.length === 0) return;
      setBusy('photos');
      const urls: string[] = [];
      for (const img of imgs) urls.push(await uploadSalonImage(salon.id, img));
      await setPhotos.mutateAsync([...photos.map((p) => ({ url: p.url })), ...urls.map((url) => ({ url }))]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const save = async (next: { url: string }[]) => {
    setError(null);
    try {
      await setPhotos.mutateAsync(next);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const makeCover = (url: string) => void save([{ url }, ...photos.filter((p) => p.url !== url).map((p) => ({ url: p.url }))]);
  const remove = (url: string) => void save(photos.filter((p) => p.url !== url).map((p) => ({ url: p.url })));

  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/profil-pro" />
      <Tx size={23} weight={700} ls={-0.8} lh={26}>
        Photos du salon
      </Tx>
      <P>Elles s'affichent sur vos cartes dans la marketplace, sur votre page publique et sur les rendez-vous de vos clients.</P>

      <SectionLabel>Photo de profil</SectionLabel>
      <Card row gap={13} style={{ alignItems: 'center' }}>
        <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={65} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={12} weight={600} lh={16}>
            {salon.logoUrl ? 'Votre logo' : 'Aucun logo : la couverture est utilisée'}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={14.5}>
            Format carré conseillé.
          </Tx>
        </View>
        <Button auto sm variant="g" disabled={busy !== null} loading={busy === 'logo'} onPress={() => void changeLogo()}>
          <I icon={Camera} size={14} />
          <Tx size={11.5} weight={600} lh={15}>
            Changer
          </Tx>
        </Button>
      </Card>

      <SectionLabel>Photos de couverture</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((p, i) => (
          <View key={p.id} style={{ width: '48%', aspectRatio: 4 / 3 }}>
            <Img src={p.url} radius={13} style={{ width: '100%', height: '100%' }} />
            {i === 0 ? (
              <View style={{ position: 'absolute', left: 6, top: 6, backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Tx size={9} weight={600} color={C.onInk} lh={12}>
                  Couverture
                </Tx>
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Définir comme couverture" disabled={setPhotos.isPending} onPress={() => makeCover(p.url)} style={{ position: 'absolute', left: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <I icon={Star} size={10} />
                <Tx size={9} weight={600} lh={12}>
                  Couverture
                </Tx>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel="Supprimer la photo" disabled={setPhotos.isPending} onPress={() => remove(p.url)} style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' }}>
              <I icon={X} size={12} />
            </Pressable>
          </View>
        ))}
        {room > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter des photos" disabled={busy !== null} onPress={() => void addPhotos()} style={{ width: '48%', aspectRatio: 4 / 3, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <I icon={Plus} size={18} color={C.muted} />
            <Tx size={10.5} weight={600} color={C.muted} lh={14}>
              {busy === 'photos' ? 'Envoi…' : 'Ajouter'}
            </Tx>
          </Pressable>
        )}
      </View>
      <InfoBox>{`La première photo est votre couverture. ${photos.length}/${SALON_MAX_PHOTOS} photo${photos.length > 1 ? 's' : ''}. Les photos de vos réalisations se gèrent depuis chaque prestation.`}</InfoBox>
      {error && <Alert>{error}</Alert>}
      <P> </P>
    </Screen>
  );
}
