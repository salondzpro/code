/**
 * Profil → Catalogue : Catalogue → Catégorie → Prestation. Les catégories organisent (sans image) ; chaque
 * prestation a une image représentative, un prix et une durée. « + Ajouter » : nom → catégorie → prix → durée →
 * 1 photo → enregistrer. Les photos du travail réel vont dans « Réalisations » (Mon salon).
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Plus, Tags } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA, groupServices } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, ErrorText, H1, I, Img, ListCard, P, Row, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { RowText } from '@/ui/ProRows';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function ProServices() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { update, remove } = useProServiceMutations();
  if (!salon) return <Splash />;
  const groups = groupServices(salon.services);
  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/profil-pro" right="Profil" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <H1>Catalogue</H1>
        <Button pill sm onPress={() => router.push('/onboarding/6' as never)} style={{ paddingHorizontal: 13, paddingVertical: 9 }}>
          <I icon={Plus} size={14.5} color="#fff" />
          <Tx size={11.5} weight={600} color="#fff" ls={-0.2}>
            Ajouter
          </Tx>
        </Button>
      </View>
      <ListCard>
        <Row py={12} onPress={() => router.push('/onboarding/5' as never)} accessibilityLabel="Catégories">
          <RowText icon={Tags} title="Catégories" sub={groups.length ? groups.map((g) => g.name).join(' · ') : 'Coupe, barbe, coloration, soins…'} />
        </Row>
      </ListCard>
      <ErrorText error={update.error ?? remove.error} />
      {salon.services.length === 0 && <P>Ajoutez votre première prestation : nom, catégorie, prix, durée et une photo.</P>}
      {groups.map((g) => (
        <View key={g.name} style={{ gap: 8 }}>
          <SectionLabel right={<Tx size={10.5} color={C.muted}>{String(g.services.length)}</Tx>}>{g.name}</SectionLabel>
          <ListCard>
            {g.services.map((sv) => {
              const photo = sv.photos?.[0]?.url ?? null;
              return (
                <Row key={sv.id} py={10} chevron={false} right={<Toggle on={sv.isActive} onChange={(v) => update.mutate({ id: sv.id, isActive: v })} label={`Activer ${sv.name}`} />}>
                  <Pressable accessibilityRole="link" accessibilityLabel={`Modifier ${sv.name}`} onPress={() => router.push(`/onboarding/6/${sv.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, opacity: sv.isActive ? 1 : 0.6 }}>
                    {photo ? (
                      <Img src={photo} radius={11} style={{ width: 52, height: 52 }} />
                    ) : (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter la photo de ${sv.name}`} onPress={() => router.push(`/onboarding/7/${sv.id}` as never)} style={{ width: 52, height: 52, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
                        <I icon={Camera} size={16} color={C.subtle} />
                      </Pressable>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Tx size={13.5} weight={700} ls={-0.3} lh={17.5} numberOfLines={1}>
                        {sv.name}
                      </Tx>
                      <Tx size={12} color={C.muted} lh={16}>
                        {formatDA(sv.priceDa)} · {formatDuration(sv.durationMinutes)}
                        {sv.isActive ? '' : ' · désactivée'}
                      </Tx>
                    </View>
                    <I icon={ChevronRight} size={14.5} color={C.disabled} />
                  </Pressable>
                </Row>
              );
            })}
          </ListCard>
        </View>
      ))}
    </Screen>
  );
}
