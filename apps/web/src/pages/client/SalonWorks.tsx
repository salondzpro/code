/** C-F 05 — Réalisations du salon : filtre par prestation, grille de photos. */
import { useState } from 'react';
import { useParams } from 'react-router';
import { useSalon } from '@salondz/api-client';
import { Img, Pill, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function SalonWorks() {
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  const [filter, setFilter] = useState<string>('all');
  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const withPhotos = s.services.filter((sv) => (sv.photos?.length ?? 0) > 0);
  const photos = filter === 'all' ? [...s.photos.map((p) => ({ id: p.id, url: p.url })), ...withPhotos.flatMap((sv) => sv.photos!.map((p) => ({ id: p.id, url: p.url })))] : (withPhotos.find((sv) => sv.id === filter)?.photos ?? []);
  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <h1 className="h1">Réalisations</h1>
      <div className="pills -mx-5 px-5">
        <Pill lg on={filter === 'all'} onClick={() => setFilter('all')}>
          Tout
        </Pill>
        {withPhotos.map((sv) => (
          <Pill key={sv.id} lg on={filter === sv.id} onClick={() => setFilter(sv.id)}>
            {sv.name}
          </Pill>
        ))}
      </div>
      {photos.length === 0 ? (
        <p className="p">Pas encore de réalisations.</p>
      ) : (
        <div className="g2">
          {photos.map((p) => (
            <Img key={p.id} src={p.url} className="aspect-[3/4] w-full" />
          ))}
        </div>
      )}
    </Screen>
  );
}
