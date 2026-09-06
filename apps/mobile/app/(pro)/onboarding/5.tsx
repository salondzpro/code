/** PRO-F 07 / PRO-H 04 — Étape 5 : « Vos prestations » — catégories du catalogue du marché, cochables. */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, type CategoryId, type Market } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { stepPath } from '@/lib/proDraft';
import { Alert, BottomSheet, Button, Checkbox, H1, Img, InfoBox, ListCard, P, Row, Soft, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar } from '@/ui/Steps';
import { C } from '@/theme/design';

const HINTS: Record<string, string> = {
  manucure: 'Manucure, pédicure, soin des mains',
  ongles: 'Pose gel, nail art, remplissage',
  'coiffure-lissage': 'Coupe, brushing, lissage',
  cils: 'Extensions, rehaussement, teinture',
  soins: 'Soin visage, hydratation',
  laser: 'Épilation laser',
  coiffure: 'Coupe, dégradé, brushing homme',
  lissage: 'Lissage et défrisage',
  'coloration-meches': 'Couleur, mèches, camouflage',
  'soins-peau': 'Nettoyage, masque, hydratation',
  tresses: 'Tresses, twists, nattes',
};

export default function Step5Catalog() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [selected, setSelected] = useState<CategoryId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (salon) setSelected(salon.categoryIds as CategoryId[]);
  }, [salon]);

  if (!salon) return <Splash />;
  const market: Market = salon.genderTarget === 'men' ? 'men' : 'women';
  const cats = categoriesForMarket(market);
  const toggle = (id: CategoryId) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const next = async () => {
    if (selected.length === 0) return setError('Cochez au moins une prestation.');
    setError(null);
    try {
      await updateSalon.mutateAsync({ categoryIds: selected });
      router.push(stepPath(6) as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Tx size={19} color={C.muted} lh={24} style={{ flex: 1 }}>
              {selected.length} prestation{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
            </Tx>
            <Button pill onPress={() => void next()} disabled={updateSalon.isPending} loading={updateSalon.isPending} style={{ paddingHorizontal: 28, paddingVertical: 14 }}>
              Continuer
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <StepBar step={5} backTo="/(pro)/(tabs)" />
      <H1>Vos prestations</H1>
      <Soft style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20 }}>
        <Tx size={19} lh={24}>
          Catalogue :{' '}
          <Tx size={19} weight={700} lh={24}>
            {MARKET_LABELS_FR[market]}
          </Tx>
        </Tx>
        <Pressable accessibilityRole="link" onPress={() => router.push('/(pro)/(tabs)/profil-pro')}>
          <Tx size={17} weight={600} color={C.muted} lh={22}>
            Modifier
          </Tx>
        </Pressable>
      </Soft>
      <Tx size={19} color={C.muted} lh={27}>
        Cochez ce que vous proposez. Vous fixerez prix, durée et photos à l'étape suivante.
      </Tx>
      <ListCard>
        {cats.map((c) => {
          const on = selected.includes(c.id);
          return (
            <Row key={c.id} py={16} chevron={false} accessibilityLabel={c.labelFr} onPress={() => toggle(c.id)} right={<Checkbox on={on} label={c.labelFr} />}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Img src={salon.coverUrl} radius={16} style={{ width: 88, height: 88 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={21} weight={700} ls={-0.3} lh={26}>
                    {c.labelFr}
                  </Tx>
                  <Tx size={16} color={C.muted} lh={22}>
                    {HINTS[c.id] ?? ''}
                  </Tx>
                </View>
              </View>
            </Row>
          );
        })}
      </ListCard>
      <InfoBox>Seules les prestations du catalogue {MARKET_LABELS_FR[market]} vous sont proposées. Elles déterminent les filtres sur lesquels les clients vous trouvent.</InfoBox>
      {error && <Alert>{error}</Alert>}
      <P> </P>
    </Screen>
  );
}
