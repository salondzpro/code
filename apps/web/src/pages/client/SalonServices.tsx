/** C-F 06 — Prestations illustrées : vignette, nom, durée · nombre de photos, prix, chevron vers le détail. */
import { Link, useParams } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useSalon } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { I, Img, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function SalonServices() {
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <h1 className="h1">Prestations</h1>
      <div className="flex flex-col gap-3.5">
        {s.services.map((sv) => {
          const photos = sv.photos ?? [];
          return (
            <Link key={sv.id} to={`/s/${s.slug}/prestation/${sv.id}`} className="crd !flex-row items-center gap-4">
              <Img src={photos[0]?.url ?? s.coverUrl} className="h-[112px] w-[112px] flex-none !rounded-[16px]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[21px] font-bold tracking-[-0.3px]">{sv.name}</span>
                <span className="block text-[16px] text-muted">
                  {formatDuration(sv.durationMinutes)}
                  {photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}
                </span>
                <span className="mt-1.5 block text-[20px] font-bold">{formatDA(sv.priceDa)}</span>
              </span>
              <I icon={ChevronRight} size={20} className="text-disabled" />
            </Link>
          );
        })}
        {s.services.length === 0 && <p className="p">Aucune prestation pour le moment.</p>}
      </div>
    </Screen>
  );
}
