/** C-F 05 — Réalisations du salon : filtre par prestation, grille de photos. */
import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSalon } from '@salondz/api-client';
import { ErrorText, Grid, H1, Img, P, Pill, TopBar } from '@/ui';
import { Screen } from '@/ui/Screen';
import { PillRow } from '@/ui/Pills';
import { Splash } from '@/ui/Splash';

export default function SalonWorks() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const salon = useSalon(slug);
  const [filter, setFilter] = useState<string>('all');
  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  const withPhotos = s.services.filter((sv) => (sv.photos?.length ?? 0) > 0);
  const photos = filter === 'all' ? [...s.photos.map((p) => ({ id: p.id, url: p.url })), ...withPhotos.flatMap((sv) => sv.photos!.map((p) => ({ id: p.id, url: p.url })))] : (withPhotos.find((sv) => sv.id === filter)?.photos ?? []);
  return (
    <Screen gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <H1>Réalisations</H1>
      <PillRow>
        <Pill lg on={filter === 'all'} onPress={() => setFilter('all')}>
          Tout
        </Pill>
        {withPhotos.map((sv) => (
          <Pill key={sv.id} lg on={filter === sv.id} onPress={() => setFilter(sv.id)}>
            {sv.name}
          </Pill>
        ))}
      </PillRow>
      {photos.length === 0 ? (
        <P>Pas encore de réalisations.</P>
      ) : (
        <Grid cols={2}>
          {photos.map((p) => (
            <Img key={p.id} src={p.url} style={{ width: '100%', aspectRatio: 3 / 4 }} />
          ))}
        </Grid>
      )}
    </Screen>
  );
}
