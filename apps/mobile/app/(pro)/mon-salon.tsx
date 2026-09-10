/**
 * Profil → Mon salon : tout ce qui fait la présence du salon sur Salon DZ — informations (nom, description),
 * photos de couverture, réalisations, adresse et localisation, horaires d'ouverture, lien et QR code.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Clock, FileText, Images, MapPin, Pencil, QrCode, Save, Sparkles } from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { wilayaName } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { Alert, Button, Grid, H1, I, IconButton, Input, ListCard, Row, SectionLabel, TopBar, Tx } from '@/ui';
import { RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

const BACK = '/(pro)/(tabs)/profil-pro';

export default function MonSalon() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const place = [salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)].filter(Boolean).join(', ');
  const openDays = new Set(salon.openingHours.filter((h) => !h.isClosed).map((h) => h.dayOfWeek)).size;

  return (
    <Screen gap={13}>
      <TopBar backTo={BACK} right="Profil" />
      <H1>Mon salon</H1>

      <SectionLabel>Informations</SectionLabel>
      <ListCard>
        <Row
          py={12}
          chevron={false}
          right={
            desc === null ? (
              <IconButton accessibilityLabel="Modifier la description" onPress={() => setDesc(salon.description ?? '')}>
                <I icon={Pencil} size={14} color={C.text} />
              </IconButton>
            ) : undefined
          }
        >
          <RowText icon={FileText} title={salon.name} sub={desc === null ? salon.description || 'Ajoutez une description : elle améliore votre visibilité' : undefined} />
        </Row>
        {desc !== null && (
          <View style={{ gap: 6, paddingBottom: 10 }}>
            <Input multiline value={desc} onChangeText={setDesc} maxLength={1500} placeholder="Salon calme, produits sans parabène…" accessibilityLabel="Description du salon" />
            <Grid cols={2}>
              <Button variant="g" sm onPress={() => setDesc(null)}>
                Annuler
              </Button>
              <Button
                sm
                disabled={updateSalon.isPending}
                loading={updateSalon.isPending}
                onPress={async () => {
                  try {
                    await updateSalon.mutateAsync({ description: desc.trim() || undefined });
                    setDesc(null);
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                <I icon={Save} size={14} color={C.onInk} />
                <Tx size={11.5} weight={600} color={C.onInk} lh={15}>
                  Enregistrer
                </Tx>
              </Button>
            </Grid>
          </View>
        )}
      </ListCard>

      <SectionLabel>Présence en ligne</SectionLabel>
      <ListCard>
        <Row py={12} to="/photos">
          <RowText icon={Images} title="Photos du salon" sub={`${salon.logoUrl ? 'Logo' : 'Sans logo'} · ${salon.photos.length} photo${salon.photos.length > 1 ? 's' : ''} de couverture`} />
        </Row>
        <Row py={12} to="/realisations">
          <RowText icon={Sparkles} title="Réalisations" sub={salon.works.length ? `${salon.works.length} photo${salon.works.length > 1 ? 's' : ''} de votre travail` : 'Montrez vos coupes, coiffures, barbes, colorations…'} />
        </Row>
        <Row py={12} to="/lien">
          <RowText icon={QrCode} title="Lien et QR code" sub="Affiche à imprimer, partage" />
        </Row>
      </ListCard>

      <SectionLabel>Adresse et horaires</SectionLabel>
      <ListCard>
        <Row py={12} to="/salon">
          <RowText icon={MapPin} title="Adresse et localisation" sub={place} />
        </Row>
        <Row py={12} to="/reglages-pro/horaires">
          <RowText icon={Clock} title="Horaires d'ouverture" sub={`Ouvert ${openDays} jour${openDays > 1 ? 's' : ''} sur 7`} />
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
