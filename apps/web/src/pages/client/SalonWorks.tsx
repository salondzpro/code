/** C-F 05 — Réalisations du salon : les photos du travail réel (section « Réalisations » du pro), en grille. */
import { useParams } from 'react-router';
import { useSalon } from '@salondz/api-client';
import { Img, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function SalonWorks() {
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  const photos = s.works;
  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <h1 className="h1">Réalisations</h1>
      <p className="p -mt-2">
        {photos.length} photo{photos.length > 1 ? 's' : ''} du travail de {s.name}.
      </p>
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
