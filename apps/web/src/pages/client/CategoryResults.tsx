/** C-H 06 / C-F 02 — Résultats d'une catégorie : filtres rapides (dispo aujourd'hui, < 2 km, prix, note). */
import { useState } from 'react';
import { useParams } from 'react-router';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { categoryLabel } from '@salondz/constants';
import { useLocationPrefs } from '@/lib/clientPrefs';
import { Pill, Skeleton, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { SalonListCard } from '@/components/SalonListCard';
import { ErrorMessage } from '@/components/ErrorMessage';

export function CategoryResults() {
  const { category = '' } = useParams();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const [today, setToday] = useState(true);
  const [near, setNear] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'price_asc' | 'rating'>('relevance');

  const query = useSalonSearch({
    gender: market,
    category,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? (near ? 2 : prefs.radiusKm) : undefined,
    availableToday: today ? '1' : undefined,
    sort,
    limit: 30,
  } as Parameters<typeof useSalonSearch>[0]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;
  const noun = market === 'men' ? 'barbiers' : 'salons';

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/" right={<span className="pill soft !text-[15px] !font-semibold">{market === 'men' ? 'Homme' : 'Femme'}</span>} />
      <h1 className="h1">{categoryLabel(category)}</h1>
      <div className="pills -mx-5 px-5">
        <Pill lg on={today} onClick={() => setToday((v) => !v)}>
          Dispo aujourd'hui
        </Pill>
        <Pill lg on={near} onClick={() => setNear((v) => !v)} disabled={prefs.lat == null}>
          &lt; 2 km
        </Pill>
        <Pill lg on={sort === 'price_asc'} onClick={() => setSort(sort === 'price_asc' ? 'relevance' : 'price_asc')}>
          Prix
        </Pill>
        <Pill lg on={sort === 'rating'} onClick={() => setSort(sort === 'rating' ? 'relevance' : 'rating')}>
          Note
        </Pill>
      </div>
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-[200px] w-full !rounded-[20px]" />
          <Skeleton className="h-[200px] w-full !rounded-[20px]" />
        </div>
      ) : query.isError ? (
        <ErrorMessage error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <p className="text-[17px] text-muted">
            {total} {noun} autour {/^[aeiouyhé]/i.test(prefs.label) ? "d'" : 'de '}
            {prefs.label}
          </p>
          {items.length === 0 && <p className="p">Aucun résultat avec ces filtres.</p>}
          <div className="flex flex-col gap-3.5">
            {items.map((s) => (
              <SalonListCard key={s.id} salon={s} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
