/** C-F 05 — Réalisations du salon : les photos du travail réel (section « Réalisations » du pro), en grille. */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSalon } from '@salondz/api-client';
import { ErrorText, Grid, H1, Img, P, TopBar } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';

export default function SalonWorks() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const salon = useSalon(slug);
  if (salon.isPending) return <Splash />;
  if (salon.isError)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );
  const s = salon.data;
  const photos = s.works;
  return (
    <Screen gap={13}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <H1>Réalisations</H1>
      <P>
        {photos.length} photo{photos.length > 1 ? 's' : ''} du travail de {s.name}.
      </P>
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
