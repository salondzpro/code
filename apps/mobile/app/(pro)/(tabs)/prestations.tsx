/** Espace pro — Prestations : catalogue avec photos, prix, durée, activation, modification. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA, groupServices } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, Card, ErrorText, H1, I, Img, P, SectionLabel, Toggle, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

export default function ProServices() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { update, remove } = useProServiceMutations();
  if (!salon) return <Splash />;
  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <H1 size={23} lh={26} ls={-0.8}>
          Prestations
        </H1>
        <Button pill sm onPress={() => router.push('/onboarding/6')} style={{ paddingHorizontal: 13, paddingVertical: 9 }}>
          <I icon={Plus} size={14.5} color="#fff" />
          <Tx size={11.5} weight={600} color="#fff" ls={-0.2}>
            Ajouter
          </Tx>
        </Button>
      </View>
      <ErrorText error={update.error ?? remove.error} />
      {salon.services.length === 0 && <P>Ajoutez votre première prestation : nom, prix, durée et photos.</P>}
      {groupServices(salon.services).map((g) => (
      <View key={g.name} style={{ gap: 10 }}>
        <SectionLabel right={<Tx size={10.5} color={C.muted}>{String(g.services.length)}</Tx>}>{g.name}</SectionLabel>
        {g.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <Card key={sv.id} gap={10} style={{ opacity: sv.isActive ? 1 : 0.6 }}>
              <Pressable accessibilityRole="link" accessibilityLabel={sv.name} onPress={() => router.push(`/onboarding/6/${sv.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                <Img src={photos[0]?.url ?? salon.coverUrl} radius={13} style={{ width: 72, height: 72 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={700} ls={-0.3} lh={18}>
                    {sv.name}
                  </Tx>
                  <Tx size={10.5} color={C.muted} lh={15.5}>
                    {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                  </Tx>
                </View>
                <I icon={ChevronRight} size={16} color={C.disabled} />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.lineSoft, paddingTop: 10 }}>
                <Tx size={10.5} color={C.muted} lh={15.5}>
                  {sv.isActive ? 'Visible et réservable' : 'Désactivée'}
                </Tx>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/onboarding/7/${sv.id}` as never)}>
                    <Tx size={12} color={C.muted} lh={16} style={{ textDecorationLine: 'underline' }}>
                      Photos
                    </Tx>
                  </Pressable>
                  <Toggle on={sv.isActive} onChange={(v) => update.mutate({ id: sv.id, isActive: v })} label={`Activer ${sv.name}`} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
      ))}
    </Screen>
  );
}
