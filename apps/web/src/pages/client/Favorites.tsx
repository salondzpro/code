/** C-F 21 — Salons favoris : filtre Tous / Pour Femmes / Pour Hommes, cœur plein pour retirer. */
import { useState } from 'react';
import { Link } from 'react-router';
import { Heart } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '@salondz/api-client';
import { categoryLabel, salonMarkets, type Market, relativeDayLabelDZ } from '@salondz/constants';
import { Avatar, LinkButton, Pill, Skeleton } from '@/components/ui';
import { RatingPill } from '@/components/SalonListCard';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { t } from '@/i18n';

export function Favorites() {
  const favs = useFavorites();
  const toggle = useToggleFavorite();
  const [filter, setFilter] = useState<'all' | Market>('all');
  const all = favs.data?.items ?? [];
  const items = filter === 'all' ? all : all.filter((s) => salonMarkets(s.genderTarget).includes(filter));

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t("Mes favoris")}</h1>
        {all.length > 0 && <span className="text-[1rem] text-muted">{all.length}</span>}
      </div>
      {/* Le filtre par marché n'a de sens que s'il y a des favoris des deux côtés. */}
      {all.some((s) => salonMarkets(s.genderTarget).includes('men')) &&
        all.some((s) => salonMarkets(s.genderTarget).includes('women')) && (
          <div className="pills -mx-4 px-4">
            <Pill on={filter === 'all'} onClick={() => setFilter('all')}>
              {t("Tous")}
            </Pill>
            <Pill on={filter === 'women'} onClick={() => setFilter('women')}>
              {t("Pour Femmes")}
            </Pill>
            <Pill on={filter === 'men'} onClick={() => setFilter('men')}>
              {t("Pour Hommes")}
            </Pill>
          </div>
        )}
      {favs.isPending ? (
        <>
          <Skeleton className="h-[8.75rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[8.75rem] w-full !rounded-[var(--radius-card)]" />
        </>
      ) : favs.isError ? (
        <ErrorMessage error={favs.error} retry={() => favs.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 pt-8 text-center">
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-fill text-muted">
            <Heart size={30} strokeWidth={1.6} />
          </span>
          <div className="text-[1.143rem] font-semibold">{t("Aucun salon en favori")}</div>
          <p className="p">{t("Touchez le cœur sur la page d'un salon pour le retrouver ici et réserver plus vite.")}</p>
          <LinkButton to="/" className="mt-2">
            {t("Explorer les salons")}
          </LinkButton>
        </div>
      ) : (
        items.map((s) => (
          <div key={s.id} className="crd !flex-row items-center gap-3.5">
            <Link to={`/s/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-3.5">
              <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={72} />
              <span className="min-w-0">
                <span className="block text-[1.143rem] font-bold tracking-[-0.4px]">{s.name}</span>
                <span className="block text-[0.857rem] text-muted">{[...s.categoryIds.slice(0, 2).map((c) => categoryLabel(c)), s.zone ?? s.city].join(' · ')}</span>
                <span className={`mt-1 block text-[0.857rem] ${s.nextAvailable ? 'font-semibold text-ok-fg' : 'text-muted'}`}>{s.nextAvailable ? t('Dispo {day} à {time}', { day: relativeDayLabelDZ(s.nextAvailable.date).toLowerCase(), time: s.nextAvailable.slots[0]! }) : t('Aucune disponibilité cette semaine')}</span>
              </span>
            </Link>
            <div className="flex flex-col items-end gap-3">
              {s.ratingCount > 0 && <RatingPill avg={s.ratingAvg} />}
              <button type="button" aria-label={t("Retirer des favoris")} onClick={() => toggle.mutate({ salonId: s.id, on: false })} disabled={toggle.isPending}>
                <Heart size={26} strokeWidth={1.6} fill="currentColor" />
              </button>
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
