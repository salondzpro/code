/**
 * C-H 01 / C-F 01 — Marketplace « Pour Hommes » / « Pour Femmes » : localisation, recherche,
 * catégories (filtres), Liste/Carte, tri, résultats. C-H 05 — feuille « Trier par ». C-H 08 — aucun résultat.
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeftRight, Check, ChevronDown, List, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { useMe, useSalonSearch, useUpdateProfile } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, categoryLabel, type CategoryId, type Market } from '@salondz/constants';
import { SORT_OPTIONS, useLocationPrefs, type SortKey } from '@/lib/clientPrefs';
import { Avatar, BottomSheet, Button, I, IconButton, Pill, Skeleton } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { SalonListCard } from '@/components/SalonListCard';
import { ErrorMessage } from '@/components/ErrorMessage';

const PLACEHOLDER: Record<Market, string> = { men: 'Barbier, coupe, barbe…', women: 'Coiffure, ongles, cils…' };
const NOUN: Record<Market, [string, string]> = { men: ['barbier', 'barbiers'], women: ['salon', 'salons'] };

export function Marketplace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const update = useUpdateProfile();
  const [prefs, setPrefs] = useLocationPrefs();
  const market: Market = me.data?.profile.market ?? 'women';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const [sortOpen, setSortOpen] = useState(false);
  const [sortDraft, setSortDraft] = useState<SortKey>(prefs.sort);

  const query = useSalonSearch({
    q: q || undefined,
    gender: market,
    category: category ? (category as CategoryId) : undefined,
    city: prefs.city ?? undefined,
    wilaya: prefs.city ? undefined : prefs.wilaya,
    lat: prefs.lat ?? undefined,
    lng: prefs.lng ?? undefined,
    radiusKm: prefs.lat != null ? prefs.radiusKm : undefined,
    sort: prefs.sort,
    limit: 30,
  });

  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id && id !== category) next.set('category', id);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  const swapMarket = () => update.mutate({ market: market === 'men' ? 'women' : 'men' });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? items.length;
  const noun = NOUN[market][total > 1 ? 1 : 0];
  const sortLabel = SORT_OPTIONS.find((o) => o.value === prefs.sort)?.label ?? 'Sans préférence';

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      {/* En-tête : localisation, titre + bascule, avatar */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/localisation" className="flex items-center gap-1.5 text-[17px]">
            <I icon={MapPin} size={18} className="text-muted" />
            <span className="truncate">{prefs.label}</span>
            <span className="text-muted">· {prefs.radiusKm} km</span>
            <I icon={ChevronDown} size={16} className="text-subtle" />
          </Link>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="h1 !text-[34px]">{MARKET_LABELS_FR[market]}</h1>
            <IconButton aria-label="Changer de marché" onClick={swapMarket} disabled={update.isPending} className="!h-9 !w-9 !rounded-[12px]">
              <I icon={ArrowLeftRight} size={16} />
            </IconButton>
          </div>
        </div>
        <Link to="/profil" aria-label="Profil" className="mt-1">
          <Avatar src={me.data?.profile.avatarUrl} name={me.data?.profile.fullName ?? 'Moi'} size={40} />
        </Link>
      </div>

      {/* Recherche */}
      <Link to="/recherche" className="search" aria-label="Rechercher">
        <I icon={Search} size={22} />
        <span className={`flex-1 ${q ? 'text-text' : 'text-subtle'}`}>{q || PLACEHOLDER[market]}</span>
        {q && (
          <button
            type="button"
            className="text-[15px] text-muted"
            aria-label="Effacer la recherche"
            onClick={(e) => {
              e.preventDefault();
              const next = new URLSearchParams(params);
              next.delete('q');
              setParams(next, { replace: true });
            }}
          >
            ✕
          </button>
        )}
      </Link>

      {/* Catégories = filtres */}
      <div className="pills -mx-5 px-5">
        {categoriesForMarket(market).map((c) => (
          <Pill key={c.id} lg on={category === c.id} onClick={() => setCategory(c.id)}>
            {c.labelFr}
          </Pill>
        ))}
      </div>

      {/* Liste / Carte + tri */}
      <div className="flex items-center justify-between gap-3">
        <div className="seg !p-1">
          <button type="button" className="on !flex !items-center !gap-1.5 !px-3.5 !py-2.5 !text-[16px]" aria-pressed>
            <I icon={List} size={17} /> Liste
          </button>
          <button type="button" className="!flex !items-center !gap-1.5 !px-3.5 !py-2.5 !text-[16px]" onClick={() => navigate(`/carte${category ? `?category=${category}` : ''}`)}>
            <I icon={MapIcon} size={17} /> Carte
          </button>
        </div>
        <button type="button" className="btn g auto !gap-1.5 whitespace-nowrap !px-3.5 !py-3 !text-[16px] !font-medium" onClick={() => setSortOpen(true)} aria-haspopup="dialog">
          <span className="text-muted">⇅</span> {sortLabel} <I icon={ChevronDown} size={16} className="text-subtle" />
        </button>
      </div>

      {/* Résultats */}
      {query.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-[380px] w-full !rounded-[20px]" />
          <Skeleton className="h-[200px] w-full !rounded-[20px]" />
        </div>
      ) : query.isError ? (
        <ErrorMessage error={query.error} retry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-2 pt-16 text-center">
          <div className="flex h-[128px] w-[128px] items-center justify-center rounded-full bg-fill text-subtle">
            <I icon={Search} size={44} />
          </div>
          <div className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.4px]">
            Aucun professionnel{category ? ` « ${categoryLabel(category)} »` : ''} à {prefs.label}
          </div>
          <p className="p">Essayez d'élargir le rayon ou de retirer un filtre.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            {prefs.radiusKm < 10 && (
              <Pill lg onClick={() => setPrefs({ radiusKm: 10 })}>
                Rayon 10 km
              </Pill>
            )}
            {category && (
              <Pill lg onClick={() => setCategory('')}>
                Retirer « {categoryLabel(category).split(' ')[0]} »
              </Pill>
            )}
            <Pill lg onClick={() => navigate('/localisation')}>
              Autres quartiers
            </Pill>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[17px] text-muted">
            {total} {noun} disponible{total > 1 ? 's' : ''} aujourd'hui
          </p>
          <div className="flex flex-col gap-3.5">
            {items.map((s, i) => (
              <SalonListCard key={s.id} salon={s} large={i === 0} />
            ))}
          </div>
        </>
      )}

      {/* C-H 05 — Trier par */}
      {sortOpen && (
        <>
          <div className="dim" onClick={() => setSortOpen(false)} />
          <BottomSheet>
            <div className="h2 text-center !text-[22px]">Trier par</div>
            <div className="crd !gap-0 !py-1" role="radiogroup" aria-label="Trier par">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={sortDraft === o.value} className="li w-full text-left" onClick={() => setSortDraft(o.value)}>
                  <span>
                    <span className="block text-[20px] font-semibold">{o.label}</span>
                    <span className="p block">{o.hint}</span>
                  </span>
                  {sortDraft === o.value && <I icon={Check} size={20} />}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                setPrefs({ sort: sortDraft });
                setSortOpen(false);
              }}
            >
              Appliquer
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
