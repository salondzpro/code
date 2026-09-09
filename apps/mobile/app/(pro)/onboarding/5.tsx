/** PRO-F 07 / PRO-H 04 — Étape 5 : « Vos prestations » — catégories du catalogue du marché, cochables. */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, salonMarkets, type CategoryId, type GenderTarget } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import { stepPath } from '@/lib/proDraft';
import { Alert, BottomSheet, Button, Checkbox, H1, I, Img, InfoBox, ListCard, P, Row, Soft, Tx } from '@/ui';
import { PickerSheet } from '@/ui/Pickers';
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

/** Type de clientèle du salon : détermine le ou les catalogues proposés (mixte = les deux). */
const GENDER_OPTIONS: { value: GenderTarget; label: string; hint: string }[] = [
  { value: 'men', label: MARKET_LABELS_FR.men, hint: 'Barbier, coiffure homme' },
  { value: 'women', label: MARKET_LABELS_FR.women, hint: 'Coiffure, ongles, cils, soins' },
  { value: 'unisex', label: 'Mixte', hint: 'Hommes et femmes · les deux catalogues' },
];
const catalogLabel = (g: GenderTarget) => (g === 'unisex' ? 'Mixte' : MARKET_LABELS_FR[g]);
const catalogFor = (g: GenderTarget) => salonMarkets(g).flatMap((m) => categoriesForMarket(m));

export default function Step5Catalog() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [selected, setSelected] = useState<CategoryId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [genderSheet, setGenderSheet] = useState(false);

  useEffect(() => {
    if (salon) setSelected(salon.categoryIds as CategoryId[]);
  }, [salon]);

  if (!salon) return <Splash />;
  const cats = catalogFor(salon.genderTarget);
  const toggle = (id: CategoryId) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Changer de clientèle enregistre tout de suite le choix et retire les catégories qui ne sont plus proposées. */
  const changeGender = async (genderTarget: GenderTarget) => {
    if (genderTarget === salon.genderTarget) return;
    setError(null);
    const allowed = new Set(catalogFor(genderTarget).map((c) => c.id));
    try {
      await updateSalon.mutateAsync({ genderTarget, categoryIds: selected.filter((id) => allowed.has(id)) });
    } catch (err) {
      setError(errorText(err));
    }
  };

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
      gap={13}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Tx size={12} color={C.muted} lh={16} style={{ flex: 1 }}>
              {selected.length} prestation{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
            </Tx>
            <Button pill onPress={() => void next()} disabled={updateSalon.isPending} loading={updateSalon.isPending} style={{ paddingHorizontal: 23, paddingVertical: 11 }}>
              Continuer
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <StepBar step={5} backTo="/(pro)/(tabs)" />
      <H1>Vos prestations</H1>
      <Soft style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={12} lh={16}>
            Catalogue
          </Tx>
          <Tx size={10.5} color={C.muted} lh={14.5}>
            Hommes, femmes ou mixte
          </Tx>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Catalogue" onPress={() => setGenderSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Tx size={12} weight={700} lh={16}>
            {catalogLabel(salon.genderTarget)}
          </Tx>
          <I icon={ChevronDown} size={13} color={C.subtle} />
        </Pressable>
      </Soft>
      <PickerSheet open={genderSheet} onClose={() => setGenderSheet(false)} title="Votre clientèle" options={GENDER_OPTIONS} value={salon.genderTarget} onChange={(v) => void changeGender(v)} />
      <Tx size={12} color={C.muted} lh={18.5}>
        Cochez ce que vous proposez. Vous fixerez prix, durée et photos à l'étape suivante.
      </Tx>
      <ListCard>
        {cats.map((c) => {
          const on = selected.includes(c.id);
          return (
            <Row key={c.id} py={13} chevron={false} accessibilityLabel={c.labelFr} onPress={() => toggle(c.id)} right={<Checkbox on={on} label={c.labelFr} />}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                <Img src={salon.coverUrl} radius={13} style={{ width: 72, height: 72 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={700} ls={-0.3} lh={18}>
                    {c.labelFr}
                  </Tx>
                  <Tx size={10.5} color={C.muted} lh={15.5}>
                    {HINTS[c.id] ?? ''}
                  </Tx>
                </View>
              </View>
            </Row>
          );
        })}
      </ListCard>
      <InfoBox>
        {salon.genderTarget === 'unisex' ? 'Salon mixte : les catalogues Pour Hommes et Pour Femmes vous sont proposés.' : `Seules les prestations du catalogue ${catalogLabel(salon.genderTarget)} vous sont proposées.`} Elles déterminent les filtres sur lesquels les clients vous trouvent.
      </InfoBox>
      {error && <Alert>{error}</Alert>}
      <P> </P>
    </Screen>
  );
}
