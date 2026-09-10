/**
 * C-F 04 → Avis du salon : ouverts depuis la puce « ★ 4,8 · 12 avis » de la page du salon. Résumé (note, étoiles,
 * nombre), tri « Mieux notés » (défaut) / « Plus récents », cartes (étoiles, date, prénom, commentaire), pagination.
 */
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  pagesItems,
  useSalon,
  useSalonReviewsInfinite,
  type ReviewSort,
} from '@salondz/api-client';
import { formatDateShortDZ } from '@salondz/constants';
import { LoadMore } from '@/components/LoadMore';
import { formatRating } from '@/lib/clientPrefs';
import { Pill, Skeleton, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Splash } from '@/pages/auth/Splash';

export function SalonReviews() {
  const { slug = '' } = useParams();
  const salon = useSalon(slug);
  const [sort, setSort] = useState<ReviewSort>('best');
  const reviews = useSalonReviewsInfinite(salon.data?.id ?? '', 10, sort);
  const reviewItems = pagesItems(reviews.data);
  if (salon.isPending) return <Splash />;
  if (salon.isError) return <ErrorMessage error={salon.error} retry={() => salon.refetch()} />;
  const s = salon.data;
  // La fiche salon est mise en cache 60 s : juste après un nouvel avis, on se fie aussi à la liste.
  const count = Math.max(s.ratingCount, reviewItems.length);
  const avg =
    s.ratingCount > 0 || reviewItems.length === 0
      ? s.ratingAvg
      : reviewItems.reduce((a, r) => a + r.rating, 0) / reviewItems.length;
  const has = count > 0;

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={`/s/${s.slug}`} right={s.name} />
      <h1 className="h1">Avis</h1>
      {has ? (
        <div className="crd !flex-row !items-center !gap-4">
          <span className="text-[2.5rem] font-bold leading-none tracking-[-1px]">
            {formatRating(avg)}
          </span>
          <span className="min-w-0">
            <span className="block text-[1.125rem] font-semibold">
              {'★'.repeat(Math.round(avg))}
              <span className="text-disabled">{'★'.repeat(5 - Math.round(avg))}</span>
            </span>
            <span className="block text-[0.9375rem] text-muted">
              {count} avis vérifié{count > 1 ? 's' : ''} · après rendez-vous
            </span>
          </span>
        </div>
      ) : (
        <p className="p py-3 text-center">
          Pas encore d'avis : soyez le premier après votre rendez-vous.
        </p>
      )}
      {has && (
        <div className="pills -mx-5 px-5" role="group" aria-label="Trier les avis">
          <Pill lg on={sort === 'best'} onClick={() => setSort('best')}>
            Mieux notés
          </Pill>
          <Pill lg on={sort === 'recent'} onClick={() => setSort('recent')}>
            Plus récents
          </Pill>
        </div>
      )}
      {reviews.isPending && has && <Skeleton className="h-[6rem] w-full !rounded-[1.25rem]" />}
      {reviewItems.map((r) => (
        <div key={r.id} className="crd !gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[1.0625rem] font-semibold">
              {'★'.repeat(r.rating)}
              <span className="text-disabled">{'★'.repeat(5 - r.rating)}</span>
            </span>
            <span className="text-[0.8125rem] text-muted">{formatDateShortDZ(r.createdAt)}</span>
          </div>
          <span className="text-[1rem] font-semibold">{r.authorName}</span>
          {r.comment && <span className="p text-[0.9375rem]">{r.comment}</span>}
        </div>
      ))}
      <LoadMore
        hasMore={reviews.hasNextPage}
        loading={reviews.isFetchingNextPage}
        onMore={() => void reviews.fetchNextPage()}
        label="Voir plus d'avis"
        auto={false}
      />
    </Screen>
  );
}
