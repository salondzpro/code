/** C-F 21 — Salons favoris : filtre Tous / Pour Femmes / Pour Hommes, cœur plein pour retirer. */
import { useState } from 'react';
import { Link } from 'react-router';
import { Heart } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '@salondz/api-client';
import { categoryLabel, salonMarkets, type Market } from '@salondz/constants';
import { Avatar, LinkButton, Pill, Skeleton, TopBar } from '@/components/ui';
import { RatingPill } from '@/components/SalonListCard';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';

export function Favorites() {
  const favs = useFavorites();
  const toggle = useToggleFavorite();
  const [filter, setFilter] = useState<'all' | Market>('all');
  const all = favs.data?.items ?? [];
  const items = filter === 'all' ? all : all.filter((s) => salonMarkets(s.genderTarget).includes(filter));

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/profil" right="Favoris" />
      <h1 className="h1">Mes favoris</h1>
      <div className="pills -mx-5 px-5">
        <Pill lg on={filter === 'all'} onClick={() => setFilter('all')}>
          Tous · {all.length}
        </Pill>
        <Pill lg on={filter === 'women'} onClick={() => setFilter('women')}>
          Pour Femmes
        </Pill>
        <Pill lg on={filter === 'men'} onClick={() => setFilter('men')}>
          Pour Hommes
        </Pill>
      </div>
      {favs.isPending ? (
        <>
          <Skeleton className="h-[140px] w-full !rounded-[20px]" />
          <Skeleton className="h-[140px] w-full !rounded-[20px]" />
        </>
      ) : favs.isError ? (
        <ErrorMessage error={favs.error} retry={() => favs.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 pt-14 text-center">
          <div className="text-[22px] font-bold">Aucun salon en favori</div>
          <p className="p">Touchez le cœur sur la page d'un salon pour le retrouver ici.</p>
          <LinkButton to="/" className="mt-2">
            Explorer les salons
          </LinkButton>
        </div>
      ) : (
        items.map((s) => (
          <div key={s.id} className="crd !flex-row items-center gap-3.5">
            <Link to={`/s/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-3.5">
              <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={108} />
              <span className="min-w-0">
                <span className="block text-[22px] font-bold tracking-[-0.4px]">{s.name}</span>
                <span className="block text-[17px] text-muted">{[...s.categoryIds.slice(0, 2).map((c) => categoryLabel(c)), s.zone ?? s.city].join(' · ')}</span>
                <span className="mt-1 block text-[17px]">{s.nextSlots?.length ? `Dispo ${s.nextSlots[0]}` : "Complet aujourd'hui"}</span>
              </span>
            </Link>
            <div className="flex flex-col items-end gap-3">
              {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
              <button type="button" aria-label="Retirer des favoris" onClick={() => toggle.mutate({ salonId: s.id, on: false })} disabled={toggle.isPending}>
                <Heart size={26} strokeWidth={1.6} fill="currentColor" />
              </button>
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
