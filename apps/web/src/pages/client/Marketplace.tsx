/**
 * C-H 01 / C-F 01 — Marketplace « Pour Hommes » / « Pour Femmes ».
 *
 * L'écran ne garde que ce qui INFORME : la recherche en cours, le marché affiché et les
 * résultats. Les CHOIX (prestations, disponibilité, note, tri) vivent dans les deux
 * panneaux de `SearchTools` — avant, une quinzaine de cibles s'empilaient avant le premier
 * salon (localisation, titre, avatar, champ, toutes les catégories, trois puces, Liste/Carte,
 * tri), et il fallait défiler pour voir un seul professionnel.
 *
 * L'avatar a disparu d'ici : l'en-tête client porte déjà le bouton de compte à droite, et la
 * même destination deux fois sur un écran ne sert personne. C-H 08 — aucun résultat.
 */
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeftRight, Search } from 'lucide-react';
import { pagesItems, useMe, useSalonSearchInfinite, useUpdateProfile } from '@salondz/api-client';
import { LoadMore } from '@/components/LoadMore';
import {
  MARKET_LABELS_FR,
  categoryLabel,
  type CategoryId,
  type Market,
} from '@salondz/constants';
import { useLocationPrefs } from '@/lib/clientPrefs';
import { I, IconButton, Pill, Skeleton } from '@/components/ui';
import { SearchField, SearchTools } from '@/components/SearchTools';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { SalonListCard } from '@/components/SalonListCard';
import { ErrorMessage } from '@/components/ErrorMessage';

const NOUN: Record<Market, [string, string]> = {
  men: ['barbier', 'barbiers'],
  women: ['salon', 'salons'],
};

export function Marketplace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const market: Market = me.data?.profile.market ?? 'women';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';

  const query = useSalonSearchInfinite({
    q: q || undefined,
    gender: market,
    category: category ? (category as CategoryId) : undefined,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? prefs.radiusKm : undefined,
    sort: prefs.sort,
    availableToday: prefs.availableToday || undefined,
    ratingMin: prefs.ratingMin ?? undefined,
    limit: 20,
  });

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('category', id);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('q', v);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const swapMarket = () => update.mutate({ market: market === 'men' ? 'women' : 'men' });

  const all = pagesItems(query.data);
  // « Ouvert maintenant » se filtre côté client : l'état d'ouverture est déjà dans chaque carte.
  const items = prefs.openNow ? all.filter((s) => s.isOpenNow) : all;
  const total = prefs.openNow ? items.length : (query.data?.pages[0]?.total ?? items.length);

  const noun = NOUN[market][total > 1 ? 1 : 0];
  // Compteur honnête : « disponibles aujourd'hui » seulement si des créneaux du jour existent dans la page.
  const todayCount = items.filter((x) => x.nextSlots.length > 0).length;
  const countLabel =
    todayCount > 0
      ? `${todayCount} ${NOUN[market][todayCount > 1 ? 1 : 0]} disponible${todayCount > 1 ? 's' : ''} aujourd'hui`
      : `${total} ${noun} · prochaines disponibilités ci-dessous`;

  return (
    <Screen bottom={NAV_PAD} gap={10}>
      <SearchField
        market={market}
        q={q}
        place={prefs.label}
        radiusKm={prefs.radiusKm}
        wilaya={prefs.wilaya}
        onQuery={setQuery}
      />
      <SearchTools
        market={market}
        category={category}
        onCategory={setCategory}
        view="list"
        onView={() => navigate(`/carte${category ? `?category=${category}` : ''}`)}
      />

      {/* Titre du marché affiché, au-dessus des résultats qu'il commande. */}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
        <h1 className="h1">
          {/* Mode femmes : titre en rose pour lever toute ambiguïté sur le catalogue affiché. */}
          {market === 'women' ? (
            <>
              Pour <span className="text-women">Femmes</span>
            </>
          ) : (
            MARKET_LABELS_FR[market]
          )}
        </h1>
        <IconButton
          aria-label="Changer de marché"
          onClick={swapMarket}
          disabled={update.isPending}
          className="!h-9 !w-9 !rounded-[var(--radius-card-sm)]"
        >
          <I icon={ArrowLeftRight} size={16} />
        </IconButton>
      </div>

      {/* Résultats */}
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-[23.75rem] w-full !rounded-[var(--radius-card)]" />
          <Skeleton className="h-[12.5rem] w-full !rounded-[var(--radius-card)]" />
        </div>
      ) : query.isError ? (
        <ErrorMessage error={query.error} retry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-2 pt-6 text-center">
          <div className="flex h-[5rem] w-[5rem] items-center justify-center rounded-full bg-fill text-subtle">
            <I icon={Search} size={44} />
          </div>
          <div className="mt-2 text-[1.429rem] font-bold leading-tight tracking-[-0.4px]">
            Aucun professionnel{category ? ` « ${categoryLabel(category)} »` : ''} à {prefs.label}
          </div>
          <p className="p">Essayez d'élargir le rayon ou de retirer un filtre.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            {prefs.radiusKm < 10 && (
              <Pill lg onClick={() => setPrefs({ radiusKm: 10 })}>
                Rayon 10 km
              </Pill>
            )}
            {(prefs.availableToday || prefs.openNow || prefs.ratingMin != null) && (
              <Pill
                lg
                onClick={() => setPrefs({ availableToday: false, openNow: false, ratingMin: null })}
              >
                Retirer les filtres
              </Pill>
            )}
            {category && (
              <Pill lg onClick={() => setCategory('')}>
                Retirer « {categoryLabel(category).split(' ')[0]} »
              </Pill>
            )}
            <Link to="/localisation" className="pill lg">
              Autres quartiers
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[1rem] font-semibold text-text">{countLabel}</p>
          <div className="flex flex-col gap-3.5">
            {items.map((s) => (
              <SalonListCard key={s.id} salon={s} />
            ))}
          </div>
          <LoadMore
            hasMore={query.hasNextPage}
            loading={query.isFetchingNextPage}
            onMore={() => void query.fetchNextPage()}
            label="Voir plus de professionnels"
          />
        </>
      )}
    </Screen>
  );
}
