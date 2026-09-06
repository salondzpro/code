/** Espace pro — Prestations : catalogue avec photos, prix, durée, activation, modification. */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Button, Card, ErrorText, H1, I, Img, P, Toggle, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

export default function ProServices() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { update, remove } = useProServiceMutations();
  if (!salon) return <Splash />;
  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <H1 size={34} lh={38} ls={-0.8}>
          Prestations
        </H1>
        <Button pill sm onPress={() => router.push('/onboarding/6')} style={{ paddingHorizontal: 16, paddingVertical: 11 }}>
          <I icon={Plus} size={18} color="#fff" />
          <Tx size={14} weight={600} color="#fff" ls={-0.2}>
            Ajouter
          </Tx>
        </Button>
      </View>
      <ErrorText error={update.error ?? remove.error} />
      {salon.services.length === 0 && <P>Ajoutez votre première prestation : nom, prix, durée et photos.</P>}
      <View style={{ gap: 12 }}>
        {salon.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <Card key={sv.id} gap={12} style={{ opacity: sv.isActive ? 1 : 0.6 }}>
              <Pressable accessibilityRole="link" accessibilityLabel={sv.name} onPress={() => router.push(`/onboarding/6/${sv.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Img src={photos[0]?.url ?? salon.coverUrl} radius={16} style={{ width: 88, height: 88 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={21} weight={700} ls={-0.3} lh={26}>
                    {sv.name}
                  </Tx>
                  <Tx size={16} color={C.muted} lh={22}>
                    {formatDuration(sv.durationMinutes)} · {formatDA(sv.priceDa)}
                    {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                  </Tx>
                </View>
                <I icon={ChevronRight} size={20} color={C.disabled} />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.lineSoft, paddingTop: 12 }}>
                <Tx size={16} color={C.muted} lh={22}>
                  {sv.isActive ? 'Visible et réservable' : 'Désactivée'}
                </Tx>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/onboarding/7/${sv.id}` as never)}>
                    <Tx size={15} color={C.muted} lh={20} style={{ textDecorationLine: 'underline' }}>
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
    </Screen>
  );
}
