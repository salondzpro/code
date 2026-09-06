/** Espace pro — Profil : page publique, identité, adresse, horaires, disponibilités, règles, fermetures, équipe, compte. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Share2 } from 'lucide-react-native';
import { useMe, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, wilayaName } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { errorText } from '@/lib/errors';
import { publicHost } from '@/lib/salon';
import { Alert, Avatar, Badge, Button, Card, Grid, H1, I, Img, Input, ListCard, P, Row, SectionLabel, Toggle, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ShareSheet } from '@/ui/ShareSheet';
import { C, NAV_PAD } from '@/theme/design';

export default function ProProfile() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useMe();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const market = salon.genderTarget === 'men' ? 'men' : 'women';
  const short = `${publicHost()}/s/${salon.slug}`;

  const upload = async (kind: 'cover' | 'logo') => {
    setError(null);
    try {
      const [img] = await pickImages({ square: kind === 'logo' });
      if (!img) return;
      const u = await uploadSalonImage(salon.id, img);
      if (kind === 'logo') await updateSalon.mutateAsync({ logoUrl: u });
      else await setPhotos.mutateAsync([{ url: u }, ...salon.photos.slice(1).map((p) => ({ url: p.url }))]);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <H1 size={34} lh={38} ls={-0.8}>
        Profil
      </H1>

      {/* Page publique */}
      <Card gap={16}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Changer le logo" onPress={() => void upload('logo')}>
            <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={72} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={22} weight={700} ls={-0.4} lh={27}>
              {salon.name}
            </Tx>
            <Tx size={16} color={C.muted} lh={22} numberOfLines={1}>
              {short}
            </Tx>
          </View>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'} md>
            {salon.isPublished ? 'En ligne' : 'Non publiée'}
          </Badge>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Changer la photo de couverture" onPress={() => void upload('cover')}>
          <Img src={salon.coverUrl} radius={16} style={{ height: 140, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            {!salon.coverUrl && <I icon={Camera} size={28} color={C.subtle} />}
          </Img>
        </Pressable>
        <Grid cols={2}>
          <Button variant="g" sm onPress={() => router.push(`/s/${salon.slug}` as never)}>
            Aperçu
          </Button>
          <Button sm onPress={() => setSheet(true)}>
            <I icon={Share2} size={18} color="#fff" />
            <Tx size={14} weight={600} color="#fff" ls={-0.2}>
              Partager
            </Tx>
          </Button>
        </Grid>
      </Card>

      <SectionLabel>Établissement</SectionLabel>
      <ListCard>
        <Row py={16} to="/salon">
          <Tx size={19} lh={24}>
            Adresse et zone
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            {[salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)].filter(Boolean).join(', ')}
          </Tx>
        </Row>
        <Row py={16} to="/onboarding/5">
          <Tx size={19} lh={24}>
            Catalogue
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            {MARKET_LABELS_FR[market]} · {salon.categoryIds.length} catégorie{salon.categoryIds.length > 1 ? 's' : ''}
          </Tx>
        </Row>
        <Row
          py={16}
          chevron={false}
          right={
            desc === null ? (
              <Pressable accessibilityRole="button" onPress={() => setDesc(salon.description ?? '')}>
                <Tx size={15} color={C.muted} lh={20} style={{ textDecorationLine: 'underline' }}>
                  Modifier
                </Tx>
              </Pressable>
            ) : undefined
          }
        >
          <Tx size={19} lh={24}>
            Description du salon
          </Tx>
          {desc === null && (
            <Tx size={15} color={C.muted} lh={20}>
              {salon.description || 'Recommandé — améliore votre visibilité'}
            </Tx>
          )}
        </Row>
        {desc !== null && (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            <Input multiline value={desc} onChangeText={setDesc} maxLength={1500} placeholder="Salon calme, produits sans parabène…" />
            <Grid cols={2}>
              <Button variant="g" sm onPress={() => setDesc(null)}>
                Annuler
              </Button>
              <Button
                sm
                disabled={updateSalon.isPending}
                onPress={async () => {
                  await updateSalon.mutateAsync({ description: desc.trim() || undefined });
                  setDesc(null);
                }}
              >
                Enregistrer
              </Button>
            </Grid>
          </View>
        )}
      </ListCard>

      <SectionLabel>Planning</SectionLabel>
      <ListCard>
        <Row py={16} to="/reglages-pro/horaires">
          <Tx size={19} lh={24}>
            Horaires
          </Tx>
        </Row>
        <Row py={16} to="/reglages-pro/regles">
          <Tx size={19} lh={24}>
            Créneaux et règles de réservation
          </Tx>
        </Row>
        <Row py={16} to="/blocages">
          <Tx size={19} lh={24}>
            Fermetures et exceptions
          </Tx>
        </Row>
        <Row py={16} onPress={() => router.push('/(pro)/(tabs)/equipe')}>
          <Tx size={19} lh={24}>
            Équipe
          </Tx>
        </Row>
        <Row py={16} to="/lien">
          <Tx size={19} lh={24}>
            Lien, QR code et partage
          </Tx>
        </Row>
      </ListCard>

      <SectionLabel>Réservation en ligne</SectionLabel>
      <ListCard>
        <Row py={16} chevron={false} right={<Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v }, { onError: (e) => setError(errorText(e)) })} label="Page publiée" />}>
          <Tx size={19} lh={24}>
            Page publiée
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            Visible dans la marketplace
          </Tx>
        </Row>
        <Row py={16} chevron={false} right={<Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v })} label="Validation manuelle" />}>
          <Tx size={19} lh={24}>
            Validation manuelle
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            Vous confirmez chaque demande
          </Tx>
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}

      <SectionLabel>Compte</SectionLabel>
      <ListCard>
        <Row py={16} chevron={false} right={<Badge tone="ok" md>Active</Badge>}>
          <Tx size={19} lh={24}>
            {me.data?.profile.fullName ?? 'Vous'}
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            {me.data?.profile.phone ?? ''}
          </Tx>
        </Row>
        <Row py={16} onPress={() => router.replace('/(client)/(tabs)')}>
          <Tx size={19} lh={24}>
            Espace client
          </Tx>
        </Row>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut();
            router.replace('/intro');
          }}
          style={{ paddingVertical: 16 }}
        >
          <Tx size={19} lh={24} color={C.danger}>
            Se déconnecter
          </Tx>
        </Pressable>
      </ListCard>
      <ShareSheet open={sheet} onClose={() => setSheet(false)} name={salon.name} slug={salon.slug} />
      <P> </P>
    </Screen>
  );
}
