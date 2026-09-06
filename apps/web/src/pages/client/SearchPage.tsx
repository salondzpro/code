/** C-H 07 — Recherche : contexte conservé (marché, catégorie, quartier), suggestions, recherches récentes. */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Clock, Scissors, Search } from 'lucide-react';
import { useMe, useSalonSearch } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoryLabel } from '@salondz/constants';
import { clearRecentSearches, formatRating, pushRecentSearch, readRecentSearches, useLocationPrefs } from '@/lib/clientPrefs';
import { Avatar, I, Pill, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';

export function SearchPage() {
  const navigate = useNavigate();
  const me = useMe();
  const market = me.data?.profile.market ?? 'women';
  const [prefs] = useLocationPrefs();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState(readRecentSearches);
  const results = useSalonSearch({ q: q.trim() || undefined, gender: market, city: prefs.city ?? undefined, wilaya: prefs.city ? undefined : prefs.wilaya, lat: prefs.lat ?? undefined, lng: prefs.lng ?? undefined, limit: 8 }, q.trim().length >= 2);
  const items = results.data?.items ?? [];

  /** Suggestions « Prestation · N salons » : prestations phares dont le nom contient la saisie. */
  const serviceHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as { name: string; count: number }[];
    const map = new Map<string, number>();
    for (const s of items) for (const t of s.topServices) if (t.name.toLowerCase().includes(needle)) map.set(t.name, (map.get(t.name) ?? 0) + 1);
    return [...map.entries()].map(([name, count]) => ({ name, count })).slice(0, 4);
  }, [items, q]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    pushRecentSearch(v);
    navigate(`/?q=${encodeURIComponent(v)}`);
  };

  return (
    <Screen bottom={NAV_PAD} gap={14}>
      <TopBar backTo="/" right={<span className="text-[15px] text-muted">{MARKET_LABELS_FR[market]}</span>} />
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
      </form>
      <div className="pills -mx-5 px-5">
        <Pill soft>{MARKET_LABELS_FR[market].replace('Pour ', '')}</Pill>
        <Pill soft>{prefs.label}</Pill>
        <Pill soft>Note 4,5+</Pill>
        <Pill soft>Aujourd'hui</Pill>
      </div>

      {q.trim().length >= 2 ? (
        <>
          <div className="flex items-center justify-between">
            <span className="h3">Suggestions</span>
            <span className="s">{results.data?.total ?? 0} résultats</span>
          </div>
          <div className="crd !gap-0 !py-1">
            {serviceHits.map((h) => (
              <button key={h.name} type="button" className="li w-full text-left" onClick={() => submit(h.name)}>
                <span className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill">
                    <I icon={Scissors} size={18} />
                  </span>
                  <span>
                    <span className="block text-[17px] font-medium">{h.name}</span>
                    <span className="s block">Prestation · {h.count} {market === 'men' ? 'barbier' : 'salon'}{h.count > 1 ? 's' : ''}</span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </button>
            ))}
            {items.map((s) => (
              <Link key={s.id} to={`/s/${s.slug}`} className="li">
                <span className="flex items-center gap-3.5">
                  <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={40} />
                  <span>
                    <span className="block text-[17px] font-medium">{s.name}</span>
                    <span className="s block">
                      {s.zone ?? s.city}
                      {s.ratingCount > 0 ? ` · ${formatRating(s.ratingAvg)}` : ''}
                      {s.categoryIds[0] ? ` · ${categoryLabel(s.categoryIds[0])}` : ''}
                    </span>
                  </span>
                </span>
                <I icon={ChevronRight} size={18} className="text-disabled" />
              </Link>
            ))}
            {!results.isPending && items.length === 0 && serviceHits.length === 0 && <p className="p py-3">Aucune suggestion.</p>}
          </div>
        </>
      ) : (
        recent.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="h3">Recherches récentes</span>
              <button
                type="button"
                className="text-[15px] text-muted"
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
        )
      )}
    </Screen>
  );
}
