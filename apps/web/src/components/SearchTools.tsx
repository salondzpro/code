/**
 * Recherche et filtres de la marketplace, en deux pièces seulement :
 *
 *   `SearchField`  — ce que l'on cherche et où. Refermé, une carte ; touché, il s'ouvre sur
 *   DEUX champs et rien d'autre : le nom du professionnel (ou un mot-clé) et le lieu.
 *   `SearchTools`  — TROIS touches : Prestations, la vue opposée (Carte ou Liste), Filtres.
 *
 * Avant, l'accueil posait à l'écran la localisation, le titre, l'avatar, le champ de
 * recherche, toutes les catégories, trois puces de filtre, le sélecteur Liste/Carte et le
 * tri : une quinzaine de cibles avant le premier salon. Tout ce qui est un CHOIX vit
 * désormais dans l'un des deux panneaux, et l'écran ne garde que ce qui informe.
 *
 * La recherche s'ouvre SUR PLACE (Planity) et non sur un écran dédié : l'ancien écran
 * reposait les catégories et les filtres déjà présents ici, et faisait perdre les résultats
 * de vue. Ne restent que les deux choses qu'on ne peut faire nulle part ailleurs — chercher
 * un professionnel par son nom, et changer de quartier pour en découvrir d'autres.
 *
 * Une seule requête de suggestions sert les deux champs : celui qui a le focus décide des
 * rubriques montrées (prestations et salons pour la saisie, quartiers pour le lieu).
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
  ChevronRight,
  Crosshair,
  List,
  Map as MapIcon,
  MapPin,
  Scissors,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { useSalonSuggest } from '@salondz/api-client';
import { categoriesForMarket, formatDA, wilayaName, type Market } from '@salondz/constants';
import {
  SORT_OPTIONS,
  formatRating,
  pushRecentPlace,
  useLocationPrefs,
  type LocationPrefs,
  type SortKey,
  RADIUS_OPTIONS,
} from '@/lib/clientPrefs';
import { useDebounced } from '@/lib/useDebounced';
import { Accordion, Avatar, Button, I, Pill } from './ui';
import { t } from '@/i18n';

const PLACEHOLDER: Record<Market, string> = {
  men: 'Barbier, coupe, barbe…',
  women: 'Coiffure, ongles, cils…',
};
/** Notes proposées : en dessous de 4, le filtre ne retire plus rien d'utile. */
const RATINGS = [4, 4.5] as const;

/** Champ de recherche : carte refermée, deux champs ouverts (professionnel, lieu). */
export function SearchField({
  market,
  q,
  place,
  radiusKm,
  wilaya,
  onQuery,
  shadow,
  className = '',
}: {
  market: Market;
  q: string;
  place: string;
  radiusKm: number;
  wilaya: number;
  /** Lancer une recherche par nom ou mot-clé (la page décide où elle s'affiche). */
  onQuery: (v: string) => void;
  /** Posé sur la carte, un champ blanc se perd dans les rues : l'ombre le décolle. */
  shadow?: boolean;
  className?: string;
}) {
  const [, setPrefs] = useLocationPrefs();
  const [open, setOpen] = useState(false);
  const [qDraft, setQDraft] = useState(q);
  const [placeDraft, setPlaceDraft] = useState('');
  const [focus, setFocus] = useState<'q' | 'place'>('q');
  useEffect(() => setQDraft(q), [q]);

  const dq = useDebounced((focus === 'q' ? qDraft : placeDraft).trim(), 250);
  const active = open && dq.length >= 2;
  const suggest = useSalonSuggest({ q: dq, gender: market, wilaya }, active);
  const data = active ? suggest.data : undefined;
  const noun = market === 'men' ? 'barbier' : 'salon';

  const close = () => {
    setOpen(false);
    setPlaceDraft('');
    setFocus('q');
  };
  const submit = (v: string) => {
    onQuery(v.trim());
    close();
  };
  const pickPlace = (city: string, parentCity: string | null, wilayaCode: number) => {
    const label = parentCity ? `${city}, ${parentCity}` : city;
    setPrefs({ city, wilaya: wilayaCode, lat: null, lng: null, label });
    pushRecentPlace({ label, city, wilaya: wilayaCode, lat: null, lng: null });
    close();
  };

  if (!open)
    return (
      <button
        type="button"
        className={`srch${shadow ? ' sh' : ''} w-full text-left ${className}`}
        aria-label={t("Modifier la recherche")}
        onClick={() => setOpen(true)}
      >
        <I icon={Search} size={20} className="flex-none text-muted" />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[1.143rem] font-semibold tracking-[-0.3px] ${q ? '' : 'text-subtle'}`}
          >
            {q || PLACEHOLDER[market]}
          </span>
          <span className="block truncate text-[1rem] text-muted">
            {place} · {radiusKm} {t("km")}
          </span>
        </span>
      </button>
    );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        className="ib -ml-2.5 !border-0 !bg-transparent"
        aria-label={t("Fermer")}
        onClick={close}
      >
        <I icon={X} size={24} />
      </button>

      <form
        className={`srch${shadow ? ' sh' : ''}`}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(qDraft);
        }}
      >
        <I icon={Search} size={20} className="flex-none text-muted" />
        <input
          aria-label={t("Recherche")}
          autoFocus
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          onFocus={() => setFocus('q')}
          placeholder={PLACEHOLDER[market]}
          className="min-w-0 flex-1 bg-transparent text-[1.143rem] outline-none placeholder:text-subtle"
        />
        {!!qDraft && (
          <button
            type="button"
            className="flex-none text-[1rem] text-muted"
            aria-label={t("Effacer la recherche")}
            onClick={() => setQDraft('')}
          >
            ✕
          </button>
        )}
      </form>

      <div className={`srch${shadow ? ' sh' : ''}`}>
        <I icon={MapPin} size={20} className="flex-none text-muted" />
        <input
          aria-label={t("Lieu")}
          value={placeDraft}
          onChange={(e) => setPlaceDraft(e.target.value)}
          onFocus={() => setFocus('place')}
          placeholder={place}
          className="min-w-0 flex-1 bg-transparent text-[1.143rem] outline-none placeholder:text-text"
        />
      </div>

      {/* Suggestions du champ qui a le focus. */}
      {focus === 'q' && !!data && (
        <div className="crd !gap-0 !py-1" aria-live="polite">
          {data.services.map((h) => (
            <button
              key={`svc-${h.name}`}
              type="button"
              className="li w-full text-left"
              onClick={() => submit(h.name)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
                  <I icon={Scissors} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-semibold">{h.name}</span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {`${h.salonCount} ${noun}${h.salonCount > 1 ? 's' : ''}${h.minPriceDa != null ? ` · dès ${formatDA(h.minPriceDa)}` : ''}`}
                  </span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="flex-none text-disabled" />
            </button>
          ))}
          {data.salons.map((s) => (
            <Link key={s.id} to={`/s/${s.slug}`} className="li">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar src={s.logoUrl ?? s.coverUrl} name={s.name} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-semibold">{s.name}</span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {[s.zone ?? s.city, s.ratingCount > 0 ? `★ ${formatRating(Number(s.ratingAvg))}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="flex-none text-disabled" />
            </Link>
          ))}
          {data.services.length === 0 && data.salons.length === 0 && (
            <button type="button" className="li w-full text-left" onClick={() => submit(qDraft)}>
              <span className="text-[1rem] font-semibold">{t("Rechercher «")}{' '}{qDraft.trim()} »</span>
              <I icon={ChevronRight} size={18} className="flex-none text-disabled" />
            </button>
          )}
        </div>
      )}

      {focus === 'place' && (
        <div className="crd !gap-0 !py-1" aria-live="polite">
          {(data?.places ?? []).map((p) => (
            <button
              key={`pl-${p.city}-${p.wilayaCode}`}
              type="button"
              className="li w-full text-left"
              onClick={() => pickPlace(p.city, p.parentCity, p.wilayaCode)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
                  <I icon={MapPin} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[1rem] font-semibold">
                    {p.parentCity ? `${p.city}, ${p.parentCity}` : p.city}
                  </span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {`${p.salonCount} ${noun}${p.salonCount > 1 ? 's' : ''} · ${wilayaName(p.wilayaCode)}`}
                  </span>
                </span>
              </span>
              <I icon={ChevronRight} size={18} className="flex-none text-disabled" />
            </button>
          ))}
          {/* Position de l'appareil et rayon : le seul réglage de lieu qu'un champ de
              saisie ne sait pas exprimer. */}
          <Link to="/localisation" className="li">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
                <I icon={Crosshair} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[1rem] font-semibold">{t("Autour de moi")}</span>
                <span className="block truncate text-[0.857rem] text-muted">
                  {t("Ma position · rayon")}{' '}{radiusKm} {t("km")}
                </span>
              </span>
            </span>
            <I icon={ChevronRight} size={18} className="flex-none text-disabled" />
          </Link>
        </div>
      )}
    </div>
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
          aria-label={t("Fermer")}
          onClick={onClose}
        >
          <I icon={X} size={24} />
        </button>
        <div className="flex items-end justify-between gap-3">
          <h2 className="h1">{title}</h2>
          <button type="button" className="text-[1rem] text-muted underline" onClick={onReset}>
            {t("Réinitialiser")}
          </button>
        </div>
      </div>
      <div className="pnl-bd">{children}</div>
      <div className="pnl-ft">
        <Button onClick={onSave}>{t("Enregistrer")}</Button>
      </div>
    </div>,
    document.body,
  );
}

type Draft = Pick<LocationPrefs, 'availableToday' | 'openNow' | 'ratingMin' | 'sort' | 'radiusKm'>;
/** Rayon par défaut : au-delà, le filtre compte comme actif. */
const DEFAULT_RADIUS = 5;

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
    (prefs.lat != null && prefs.radiusKm !== DEFAULT_RADIUS ? 1 : 0) +
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
      <div className={`tools ${className}`} aria-label={t("Prestations, vue et filtres")}>
        <button
          type="button"
          className={`tool${category ? ' on' : ''}`}
          aria-haspopup="dialog"
          onClick={openCategories}
        >
          <I icon={Tag} size={18} className="text-muted" />
          {t("Prestations")}
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
          {t("Filtres")}
          {filterCount > 0 && <span className="n">{filterCount}</span>}
        </button>
      </div>

      {open === 'cat' && (
        <Panel
          title={t("Prestations")}
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
          title={t("Filtres")}
          onClose={() => setOpen(null)}
          onReset={() =>
            setDraft({
              availableToday: false,
              openNow: false,
              ratingMin: null,
              sort: 'relevance',
              radiusKm: DEFAULT_RADIUS,
            })
          }
          onSave={() => {
            setPrefs(draft);
            setOpen(null);
          }}
        >
          <Accordion
            title={t("Disponibilités")}
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
                {t("Disponible aujourd'hui")}
              </Pill>
              <Pill
                lg
                on={draft.openNow}
                aria-pressed={draft.openNow}
                onClick={() => setDraft({ ...draft, openNow: !draft.openNow })}
              >
                {t("Ouvert maintenant")}
              </Pill>
            </div>
          </Accordion>

          {/* Le rayon est le troisième paramètre d'une recherche, avec le quoi et le où : il
              vit ici, à côté des autres filtres, et se lit dans la carte de recherche. */}
          <Accordion
            title={t("Distance")}
            hint={prefs.lat != null ? `Autour de ${prefs.label}` : 'Autour de votre position'}
            open={section === 'dist'}
            onToggle={() => toggleSection('dist')}
          >
            <div className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Rayon")}>
                {RADIUS_OPTIONS.map((km) => (
                  <Pill
                    key={km}
                    lg
                    on={draft.radiusKm === km}
                    role="radio"
                    aria-checked={draft.radiusKm === km}
                    onClick={() => setDraft({ ...draft, radiusKm: km })}
                  >
                    {km} {t("km")}
                  </Pill>
                ))}
              </div>
              {prefs.lat == null && (
                <p className="p text-[0.857rem]">
                  {t("Le rayon s'applique autour d'une position : touchez « Ma position » ou une adresse précise dans la recherche.")}
                </p>
              )}
            </div>
          </Accordion>

          <Accordion title={t("Note")} open={section === 'note'} onToggle={() => toggleSection('note')}>
            <div className="flex flex-wrap gap-2 py-3">
              {RATINGS.map((r) => (
                <Pill
                  key={r}
                  lg
                  on={draft.ratingMin === r}
                  aria-pressed={draft.ratingMin === r}
                  onClick={() => setDraft({ ...draft, ratingMin: draft.ratingMin === r ? null : r })}
                >
                  {r.toFixed(1).replace('.', ',')} {t("et plus")}
                </Pill>
              ))}
            </div>
          </Accordion>

          {withSort && (
            <Accordion
              title={t("Trier par")}
              open={section === 'sort'}
              onToggle={() => toggleSection('sort')}
            >
              <div role="radiogroup" aria-label={t("Trier par")}>
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
