/**
 * Recherche et filtres de la marketplace, en deux pièces seulement :
 *
 *   `SearchSummary` — ce que l'on cherche et où, dans une carte que l'on touche pour tout
 *   modifier (Planity : « Manucure · Paris / À tout moment » + crayon).
 *   `SearchTools`   — TROIS touches : Prestations, la vue opposée (Carte ou Liste), Filtres.
 *
 * Avant, l'accueil posait à l'écran la localisation, le titre, l'avatar, le champ de
 * recherche, toutes les catégories, trois puces de filtre, le sélecteur Liste/Carte et le
 * tri : une quinzaine de cibles avant le premier salon. Tout ce qui est un CHOIX vit
 * désormais dans l'un des deux panneaux, et l'écran ne garde que ce qui informe.
 *
 * Les panneaux sont montés par un PORTAIL sur `document.body` : l'en-tête client est
 * `sticky z-30`, donc il crée son propre contexte d'empilement et un panneau rendu à
 * l'intérieur passerait sous la barre d'onglets (même leçon que le tiroir de menu).
 *
 * Les filtres se règlent dans un BROUILLON et ne s'appliquent qu'à « Enregistrer » : sur
 * une liste servie par le serveur, chaque touche appliquée immédiatement relance une
 * requête et fait sauter les résultats sous le doigt.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import {
  Check,
  List,
  Map as MapIcon,
  Pencil,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { categoriesForMarket, type Market } from '@salondz/constants';
import {
  SORT_OPTIONS,
  useLocationPrefs,
  type LocationPrefs,
  type SortKey,
} from '@/lib/clientPrefs';
import { Accordion, Button, I, Pill } from './ui';

const PLACEHOLDER: Record<Market, string> = {
  men: 'Barbier, coupe, barbe…',
  women: 'Coiffure, ongles, cils…',
};
/** Notes proposées : en dessous de 4, le filtre ne retire plus rien d'utile. */
const RATINGS = [4, 4.5] as const;

/** Carte de recherche : la saisie et le lieu réunis, le crayon ouvre l'écran de recherche. */
export function SearchSummary({
  market,
  q,
  place,
  radiusKm,
  className = '',
}: {
  market: Market;
  q: string;
  place: string;
  radiusKm: number;
  className?: string;
}) {
  return (
    <Link to="/recherche" className={`srch ${className}`} aria-label="Modifier la recherche">
      <I icon={Search} size={20} className="flex-none text-muted" />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[1.143rem] font-semibold tracking-[-0.3px] ${q ? '' : 'text-subtle'}`}
        >
          {q || PLACEHOLDER[market]}
        </span>
        <span className="block truncate text-[1rem] text-muted">
          {place} · {radiusKm} km
        </span>
      </span>
      <I icon={Pencil} size={18} className="flex-none text-muted" />
    </Link>
  );
}

/** Panneau plein écran : fermeture, titre, réinitialisation, puis « Enregistrer ». */
function Panel({
  title,
  onClose,
  onReset,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="pnl" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex flex-col gap-1 px-5 pb-2 pt-3">
        <button
          type="button"
          className="ib -ml-2.5 !border-0 !bg-transparent"
          aria-label="Fermer"
          onClick={onClose}
        >
          <I icon={X} size={24} />
        </button>
        <div className="flex items-end justify-between gap-3">
          <h2 className="h1">{title}</h2>
          <button type="button" className="text-[1rem] text-muted underline" onClick={onReset}>
            Réinitialiser
          </button>
        </div>
      </div>
      <div className="pnl-bd">{children}</div>
      <div className="pnl-ft">
        <Button onClick={onSave}>Enregistrer</Button>
      </div>
    </div>,
    document.body,
  );
}

type Draft = Pick<LocationPrefs, 'availableToday' | 'openNow' | 'ratingMin' | 'sort'>;

export function SearchTools({
  market,
  category,
  onCategory,
  view,
  onView,
  withSort = true,
  className = '',
}: {
  market: Market;
  category: string;
  onCategory: (id: string) => void;
  /** Vue affichée ; la touche du milieu mène toujours à l'AUTRE vue. */
  view: 'list' | 'map';
  onView: () => void;
  /** Le tri n'a pas de sens sur une carte : il n'y a pas de premier résultat. */
  withSort?: boolean;
  className?: string;
}) {
  const [prefs, setPrefs] = useLocationPrefs();
  const [open, setOpen] = useState<'cat' | 'filters' | null>(null);
  const [catDraft, setCatDraft] = useState(category);
  const [draft, setDraft] = useState<Draft>(prefs);
  const [section, setSection] = useState<string | null>(null);

  const filterCount =
    (prefs.availableToday ? 1 : 0) +
    (prefs.openNow ? 1 : 0) +
    (prefs.ratingMin != null ? 1 : 0) +
    (withSort && prefs.sort !== 'relevance' ? 1 : 0);

  const openCategories = () => {
    setCatDraft(category);
    setOpen('cat');
  };
  const openFilters = () => {
    setDraft(prefs);
    setSection(null);
    setOpen('filters');
  };
  const toggleSection = (id: string) => setSection((s) => (s === id ? null : id));

  return (
    <>
      <div className={`tools ${className}`} aria-label="Prestations, vue et filtres">
        <button
          type="button"
          className={`tool${category ? ' on' : ''}`}
          aria-haspopup="dialog"
          onClick={openCategories}
        >
          <I icon={Tag} size={18} className="text-muted" />
          Prestations
          {!!category && <span className="n">1</span>}
        </button>
        <button type="button" className="tool" onClick={onView}>
          <I icon={view === 'list' ? MapIcon : List} size={18} className="text-muted" />
          {view === 'list' ? 'Carte' : 'Liste'}
        </button>
        <button
          type="button"
          className={`tool${filterCount ? ' on' : ''}`}
          aria-haspopup="dialog"
          onClick={openFilters}
        >
          <I icon={SlidersHorizontal} size={18} className="text-muted" />
          Filtres
          {filterCount > 0 && <span className="n">{filterCount}</span>}
        </button>
      </div>

      {open === 'cat' && (
        <Panel
          title="Prestations"
          onClose={() => setOpen(null)}
          onReset={() => setCatDraft('')}
          onSave={() => {
            onCategory(catDraft);
            setOpen(null);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {categoriesForMarket(market).map((c) => (
              <Pill
                key={c.id}
                lg
                on={catDraft === c.id}
                aria-pressed={catDraft === c.id}
                onClick={() => setCatDraft(catDraft === c.id ? '' : c.id)}
              >
                {c.labelFr}
              </Pill>
            ))}
          </div>
        </Panel>
      )}

      {open === 'filters' && (
        <Panel
          title="Filtres"
          onClose={() => setOpen(null)}
          onReset={() =>
            setDraft({ availableToday: false, openNow: false, ratingMin: null, sort: 'relevance' })
          }
          onSave={() => {
            setPrefs(draft);
            setOpen(null);
          }}
        >
          <Accordion
            title="Disponibilités"
            open={section === 'dispo'}
            onToggle={() => toggleSection('dispo')}
          >
            <div className="flex flex-wrap gap-2 py-3">
              <Pill
                lg
                on={draft.availableToday}
                aria-pressed={draft.availableToday}
                onClick={() => setDraft({ ...draft, availableToday: !draft.availableToday })}
              >
                Disponible aujourd&apos;hui
              </Pill>
              <Pill
                lg
                on={draft.openNow}
                aria-pressed={draft.openNow}
                onClick={() => setDraft({ ...draft, openNow: !draft.openNow })}
              >
                Ouvert maintenant
              </Pill>
            </div>
          </Accordion>

          <Accordion title="Note" open={section === 'note'} onToggle={() => toggleSection('note')}>
            <div className="flex flex-wrap gap-2 py-3">
              {RATINGS.map((r) => (
                <Pill
                  key={r}
                  lg
                  on={draft.ratingMin === r}
                  aria-pressed={draft.ratingMin === r}
                  onClick={() => setDraft({ ...draft, ratingMin: draft.ratingMin === r ? null : r })}
                >
                  {r.toFixed(1).replace('.', ',')} et plus
                </Pill>
              ))}
            </div>
          </Accordion>

          {withSort && (
            <Accordion
              title="Trier par"
              open={section === 'sort'}
              onToggle={() => toggleSection('sort')}
            >
              <div role="radiogroup" aria-label="Trier par">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.sort === o.value}
                    className="li w-full text-left"
                    onClick={() => setDraft({ ...draft, sort: o.value as SortKey })}
                  >
                    <span className="text-[1rem] font-semibold">{o.label}</span>
                    {draft.sort === o.value && <I icon={Check} size={20} className="flex-none" />}
                  </button>
                ))}
              </div>
            </Accordion>
          )}
        </Panel>
      )}
    </>
  );
}
