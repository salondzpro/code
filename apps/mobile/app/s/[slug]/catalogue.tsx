/** C-F 06 — Prestations illustrées : vignette, nom, durée · nombre de photos, prix, chevron vers le détail. */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useSalon } from '@salondz/api-client';
import { formatDA, groupServices } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { Card, ErrorText, H1, I, Img, P, TopBar, Tx, SectionLabel } from '@/ui';
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
    <Screen gap={13}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <H1>Prestations</H1>
      {groupServices(s.services).map((g) => (
        <View key={g.name} style={{ gap: 11 }}>
          <SectionLabel>{g.name}</SectionLabel>
          {g.services.map((sv) => {
            const photos = sv.photos ?? [];
            return (
              <Card
                key={sv.id}
                row
                gap={13}
                onPress={() => router.push(`/s/${s.slug}/prestation/${sv.id}` as never)}
                accessibilityLabel={sv.name}
              >
                <Img
                  src={photos[0]?.url ?? s.coverUrl}
                  radius={13}
                  style={{ width: 91, height: 91 }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Tx size={14} weight={700} ls={-0.3} lh={18}>
                    {sv.name}
                  </Tx>
                  <Tx size={10.5} color={C.muted} lh={15.5}>
                    {formatDuration(sv.durationMinutes)}
                    {photos.length
                      ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}`
                      : ''}
                  </Tx>
                  <Tx size={13} weight={700} lh={17} style={{ marginTop: 5 }}>
                    {formatDA(sv.priceDa)}
                  </Tx>
                </View>
                <I icon={ChevronRight} size={16} color={C.disabled} />
              </Card>
            );
          })}
        </View>
      ))}
      {s.services.length === 0 && <P>Aucune prestation pour le moment.</P>}
    </Screen>
  );
}
