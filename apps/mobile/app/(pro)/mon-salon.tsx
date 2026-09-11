/**
 * Profil → Mon salon : ce qui fait la présence du salon sur Salon DZ — informations (nom, description),
 * photos de couverture, réalisations, adresse. Horaires et lien public sont sur Profil, à portée de main.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import {
  FileText,
  Images,
  MapPin,
  Pencil,
  Save,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, wilayaName, type GenderTarget } from '@salondz/constants';
import { PickerSheet } from '@/ui/Pickers';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Button,
  Grid,
  H1,
  I,
  IconButton,
  Input,
  ListCard,
  Row,
  SectionLabel,
  TopBar,
  Tx,
} from '@/ui';
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
  const [market, setMarket] = useState(false);
  if (!salon) return <Splash />;
  const marketLabel =
    salon.genderTarget === 'unisex' ? 'Mixte' : MARKET_LABELS_FR[salon.genderTarget];
  const place = [salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)]
    .filter(Boolean)
    .join(', ');

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
              <IconButton
                accessibilityLabel="Modifier la description"
                onPress={() => setDesc(salon.description ?? '')}
              >
                <I icon={Pencil} size={14} color={C.text} />
              </IconButton>
            ) : undefined
          }
        >
          <RowText
            icon={FileText}
            title={salon.name}
            sub={
              desc === null
                ? salon.description || 'Ajouter une description'
                : undefined
            }
          />
        </Row>
        <Row
          py={12}
          onPress={() => setMarket(true)}
          accessibilityLabel="Clientèle"
          right={
            <Tx size={12} color={C.muted} lh={16}>
              {marketLabel}
            </Tx>
          }
        >
          <RowText
            icon={Users}
            title="Clientèle"
            sub="Hommes, femmes ou mixte"
          />
        </Row>
        {desc !== null && (
          <View style={{ gap: 6, paddingBottom: 10 }}>
            <Input
              multiline
              value={desc}
              onChangeText={setDesc}
              maxLength={1500}
              placeholder="Salon calme, produits sans parabène…"
              accessibilityLabel="Description du salon"
            />
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
          <RowText
            icon={Images}
            title="Photos du salon"
            sub={`${salon.logoUrl ? 'Logo' : 'Sans logo'} · ${salon.photos.length} photo${salon.photos.length > 1 ? 's' : ''} de couverture`}
          />
        </Row>
        <Row py={12} to="/realisations">
          <RowText
            icon={Sparkles}
            title="Réalisations"
            sub={
              salon.works.length
                ? `${salon.works.length} photo${salon.works.length > 1 ? 's' : ''} de votre travail`
                : 'Ajouter vos photos'
            }
          />
        </Row>
      </ListCard>

      <SectionLabel>Adresse</SectionLabel>
      <ListCard>
        <Row py={12} to="/salon">
          <RowText icon={MapPin} title="Adresse et localisation" sub={place} />
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
      <PickerSheet
        open={market}
        onClose={() => setMarket(false)}
        title="Votre clientèle"
        value={salon.genderTarget}
        onChange={(v: GenderTarget) => {
          setMarket(false);
          updateSalon.mutate({ genderTarget: v }, { onError: (e) => setError(errorText(e)) });
        }}
        options={[
          { value: 'men', label: MARKET_LABELS_FR.men, hint: 'Barbier, coiffure homme' },
          { value: 'women', label: MARKET_LABELS_FR.women, hint: 'Coiffure, ongles, cils, soins' },
          { value: 'unisex', label: 'Mixte', hint: 'Hommes et femmes · les deux catalogues' },
        ]}
      />
    </Screen>
  );
}
