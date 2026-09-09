/**
 * C-H 07 — Recherche : contexte conservé (marché, catégorie, quartier), suggestions, recherches récentes.
 * Interactive : dès deux caractères, suggestions typées (catégories, prestations, salons, lieux) servies par
 * l'API en une requête, retardées de 250 ms ; les puces « Aujourd'hui » et « Note 4,5+ » sont de vrais filtres.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Clock, MapPin, Scissors, Search, Tag } from 'lucide-react';
import { useMe, useSalonSuggest } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoriesForMarket, categoryLabel, formatDA, wilayaName } from '@salondz/constants';
import { clearRecentSearches, formatRating, pushRecentPlace, pushRecentSearch, readRecentSearches, useLocationPrefs } from '@/lib/clientPrefs';
import { useDebounced } from '@/lib/useDebounced';
import { Avatar, I, Pill, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function SearchPage() {
  const navigate = useNavigate();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs, setPrefs] = useLocationPrefs();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const [recent, setRecent] = useState(readRecentSearches);
  const active = dq.length >= 2;
  const suggest = useSalonSuggest({ q: dq, gender: market, wilaya: prefs.wilaya }, active);
  const data = suggest.data;

  /** Catégories du marché dont le libellé contient la saisie (statique, instantané). */
  const categoryHits = useMemo(() => (active ? categoriesForMarket(market).filter((c) => normalize(c.labelFr).includes(normalize(dq))).slice(0, 3) : []), [active, dq, market]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    pushRecentSearch(v);
    navigate(`/?q=${encodeURIComponent(v)}`);
  };

  const goPlace = (city: string, parentCity: string | null, wilaya: number) => {
    const label = parentCity ? `${city}, ${parentCity}` : city;
    setPrefs({ city, wilaya, lat: null, lng: null, label });
    pushRecentPlace({ label, city, wilaya, lat: null, lng: null });
    navigate('/');
  };

  const noun = market === 'men' ? 'barbier' : 'salon';
  const nothing = active && !suggest.isPending && categoryHits.length === 0 && (data?.salons.length ?? 0) === 0 && (data?.services.length ?? 0) === 0 && (data?.places.length ?? 0) === 0;

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      <TopBar backTo="/" right={<span className="text-[0.9375rem] text-muted">{MARKET_LABELS_FR[market]}</span>} />
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
      >
        <I icon={Search} size={22} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={market === 'men' ? 'Barbier, coupe, barbe…' : 'Coiffure, ongles, cils…'} aria-label="Recherche" autoFocus />
        {q && (
          <button type="button" className="text-[0.9375rem] text-muted" aria-label="Effacer" onClick={() => setQ('')}>
            ✕
          </button>
        )}
      </form>
      <div className="pills -mx-5 px-5">
        <Pill soft>{MARKET_LABELS_FR[market].replace('Pour ', '')}</Pill>
        <Pill soft onClick={() => navigate('/localisation')}>
          <I icon={MapPin} size={14} /> {prefs.label}
        </Pill>
        <Pill soft on={prefs.ratingMin != null} aria-pressed={prefs.ratingMin != null} onClick={() => setPrefs({ ratingMin: prefs.ratingMin ? null : 4.5 })}>
          Note 4,5+
        </Pill>
        <Pill soft on={prefs.availableToday} aria-pressed={prefs.availableToday} onClick={() => setPrefs({ availableToday: !prefs.availableToday })}>
          Aujourd'hui
        </Pill>
      </div>

      {active ? (
        <>
          <div className="flex items-center justify-between">
            <span className="h3">Suggestions</span>
            <span className="s">{suggest.isFetching ? 'Recherche…' : `${(data?.salons.length ?? 0) + (data?.services.length ?? 0) + (data?.places.length ?? 0) + categoryHits.length} suggestions`}</span>
          </div>
          <div className="crd !gap-0 !py-1" aria-live="polite">
            {categoryHits.map((c) => (
              <button key={`cat-${c.id}`} type="button" className="li w-full text-left" onClick={() => navigate(`/?category=${c.id}`)}>
                <span className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                    <I icon={Tag} size={18} />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-medium">{c.labelFr}</span>
                    <span className="s block">Catégorie</span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </button>
            ))}
            {(data?.services ?? []).map((h) => (
              <button key={`svc-${h.name}`} type="button" className="li w-full text-left" onClick={() => submit(h.name)}>
                <span className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
                    <I icon={Scissors} size={18} />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-medium">{h.name}</span>
                    <span className="s block">
                      Prestation · {h.salonCount} {noun}
                      {h.salonCount > 1 ? 's' : ''}
                      {h.minPriceDa != null ? ` · dès ${formatDA(h.minPriceDa)}` : ''}
                    </span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </button>
            ))}
            {(data?.salons ?? []).map((s) => (
              <Link key={s.id} to={`/s/${s.slug}`} className="li">
                <span className="flex items-center gap-3.5">
                  <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={40} />
                  <span>
                    <span className="block text-[0.8125rem] font-medium">{s.name}</span>
                    <span className="s block">
                      {s.zone ?? s.city}
                      {s.ratingCount > 0 ? ` · ★ ${formatRating(Number(s.ratingAvg))}` : ''}
                      {s.categoryId ? ` · ${categoryLabel(s.categoryId)}` : ''}
                    </span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </Link>
            ))}
            {(data?.places ?? []).map((p) => (
              <button key={`pl-${p.city}-${p.wilayaCode}`} type="button" className="li w-full text-left" onClick={() => goPlace(p.city, p.parentCity, p.wilayaCode)}>
                <span className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
                    <I icon={MapPin} size={18} />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-medium">{p.parentCity ? `${p.city}, ${p.parentCity}` : p.city}</span>
                    <span className="s block">
                      Lieu · {p.salonCount} {noun}
                      {p.salonCount > 1 ? 's' : ''} · {wilayaName(p.wilayaCode)}
                    </span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </button>
            ))}
            {nothing && (
              <button type="button" className="li w-full text-left" onClick={() => submit(q)}>
                <span className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
                    <I icon={Search} size={18} />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-medium">Rechercher « {q.trim()} »</span>
                    <span className="s block">Aucune suggestion · lancer la recherche dans toute la marketplace</span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="h3">Recherches récentes</span>
                <button
                  type="button"
                  className="text-[0.9375rem] text-muted"
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                >
                  Effacer
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {recent.map((r) => (
                  <Pill key={r} lg onClick={() => submit(r)}>
                    <I icon={Clock} size={16} className="text-subtle" /> {r}
                  </Pill>
                ))}
              </div>
            </>
          )}
          <span className="h3">Catégories</span>
          <div className="flex flex-wrap gap-2.5">
            {categoriesForMarket(market).map((c) => (
              <Pill key={c.id} lg onClick={() => navigate(`/?category=${c.id}`)}>
                {c.labelFr}
              </Pill>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
