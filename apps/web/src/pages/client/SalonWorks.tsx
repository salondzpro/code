/** C-F 05 — Réalisations du salon : les photos du travail réel (section « Réalisations » du pro), en grille. */
import { useParams } from 'react-router';
import { Images } from 'lucide-react';
import { useSalon } from '@salondz/api-client';
import { EmptyState, Img, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

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
      <h1 className="h1">{t("Réalisations")}</h1>
      {photos.length === 0 ? (
        <EmptyState
          icon={Images}
          title={t("Pas encore de réalisations")}
          description={t("{salon} n'a pas encore publié de photos de son travail.", { salon: s.name })}
        />
      ) : (
        <>
          <p className="p -mt-2">{t('{n} photo(s)', { n: photos.length })}</p>
          <div className="g2">
            {photos.map((p) => (
              <Img key={p.id} src={p.url} className="aspect-[3/4] w-full" />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
