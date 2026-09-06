/** C-F 06 — Prestations illustrées : vignette, nom, durée · nombre de photos, prix, chevron vers le détail. */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useSalon } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Card, ErrorText, H1, I, Img, P, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function SalonServices() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const salon = useSalon(slug);
  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  return (
    <Screen gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <H1>Prestations</H1>
      <View style={{ gap: 14 }}>
        {s.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <Card key={sv.id} row gap={16} onPress={() => router.push(`/s/${s.slug}/prestation/${sv.id}` as never)} accessibilityLabel={sv.name}>
              <Img src={photos[0]?.url ?? s.coverUrl} radius={16} style={{ width: 112, height: 112 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={21} weight={700} ls={-0.3} lh={26}>
                  {sv.name}
                </Tx>
                <Tx size={16} color={C.muted} lh={22}>
                  {formatDuration(sv.durationMinutes)}
                  {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                </Tx>
                <Tx size={20} weight={700} lh={25} style={{ marginTop: 6 }}>
                  {formatDA(sv.priceDa)}
                </Tx>
              </View>
              <I icon={ChevronRight} size={20} color={C.disabled} />
            </Card>
          );
        })}
        {s.services.length === 0 && <P>Aucune prestation pour le moment.</P>}
      </View>
    </Screen>
  );
}
