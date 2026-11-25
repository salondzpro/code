/**
 * Agenda mobile-first : le contenu du jour glisse librement avec le doigt (carrousel à trois panneaux :
 * veille, jour, lendemain, avec accroche au panneau) et une bande de jours défilable horizontalement.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  DAY_LABELS_SHORT_FR,
  addDaysToKey,
  dayOfWeekFromKey,
  formatLocale,
  toLocalDateKey,
} from '@salondz/constants';
import { dayNumber } from './DaySelector';
import { t } from '@/i18n';

/** Abréviation du mois dans la langue de l'écran : « oct. », « Nov », « نوفمبر ». */
const shortMonth = (key: string) =>
  new Intl.DateTimeFormat(formatLocale(), { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${key}T12:00:00Z`),
  );

/** Bande de jours défilable (± 3 semaines autour du jour choisi), jour sélectionné centré. */
export function DayScroller({
  selected,
  onSelect,
  disabledDays,
  minDate,
  marks,
}: {
  selected: string;
  /** Jours qui portent du NOUVEAU (rendez-vous pas encore vus) : une pastille rouge les signale. */
  marks?: Record<string, number>;
  onSelect: (dateKey: string) => void;
  disabledDays?: readonly number[];
  /** Jours avant cette clé grisés et non sélectionnables (création : jamais le passé). */ minDate?:
    string | null;
}) {
  const today = toLocalDateKey();
  const ref = useRef<HTMLDivElement | null>(null);
  const anchor = useRef(selected);
  // La liste est ancrée sur le premier jour choisi et s'étend de −21 à +42 jours ; on la recentre si on sort de la fenêtre.
  if (selected < addDaysToKey(anchor.current, -14) || selected > addDaysToKey(anchor.current, 35))
    anchor.current = selected;
  const days: string[] = [];
  // Avec `minDate` (création de rendez-vous), le passé n'est pas seulement grisé : il n'est pas listé du tout.
  for (let i = -21; i <= 42; i++) {
    const d = addDaysToKey(anchor.current, i);
    if (minDate && d < minDate) continue;
    days.push(d);
  }

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`);
    // Défilement de la RANGÉE seulement. `scrollIntoView` faisait aussi défiler la PAGE pour
    // rendre la rangée visible : un écran qui place le choix du jour plus bas (Nouveau
    // rendez-vous) s'ouvrait déjà descendu, son titre caché sous l'en-tête.
    const row = ref.current;
    if (el && row) {
      // Écart MESURÉ entre le jour et le milieu de la rangée : juste dans les deux sens d'écriture
      // (en arabe, `scrollLeft` part de 0 à droite et devient négatif — un calcul par positions
      // absolues y envoyait le jour hors de l'écran).
      const a = el.getBoundingClientRect();
      const c = row.getBoundingClientRect();
      row.scrollBy({ left: a.left + a.width / 2 - (c.left + c.width / 2), behavior: 'smooth' });
    }
  }, [selected]);

  let lastMonth = '';
  return (
    <div
      ref={ref}
      className="pills bleed !gap-1"
      role="listbox"
      aria-label={t("Choisir un jour")}
      style={{ scrollSnapType: 'x proximity' }}
    >
      {days.map((d) => {
        const dow = dayOfWeekFromKey(d);
        const past = !!minDate && d < minDate;
        const out = !!disabledDays?.includes(dow) || past;
        const on = d === selected;
        const month = d.slice(0, 7);
        const showMonth = month !== lastMonth;
        lastMonth = month;
        return (
          <button
            key={d}
            type="button"
            role="option"
            aria-selected={on}
            aria-disabled={past || undefined}
            disabled={past}
            data-day={d}
            onClick={() => onSelect(d)}
            className={`relative flex w-[3.25rem] flex-none flex-col items-center gap-1 rounded-[var(--radius-card-sm)] py-2 ${on ? 'bg-ink text-white' : out ? 'text-disabled' : 'text-text'}`}
            style={{ scrollSnapAlign: 'center' }}
            aria-label={`${t(DAY_LABELS_SHORT_FR[dow])} ${dayNumber(d)}${marks?.[d] ? ` · ${t('{n} nouveau(x)', { n: marks[d] })}` : ''}`}
          >
            {!!marks?.[d] && (
              <span aria-hidden className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-[var(--color-bg)]" />
            )}
            <span
              className={`text-[0.857rem] ${on ? 'text-white/70' : 'text-subtle'}`}
            >
              {t(DAY_LABELS_SHORT_FR[dow])}
            </span>
            <span className="text-[1rem] font-semibold">{dayNumber(d)}</span>
            {/* Premier jour d'un mois : le mois SOUS le chiffre (« oct. », « nov. »). Il remplaçait
                le nom du jour, et l'on lisait « OCT. 28 » sans savoir quel jour c'était. Sinon,
                aujourd'hui : un point sous le chiffre (blanc sur le jour choisi). */}
            {showMonth && d !== today ? (
              <span aria-hidden className={`h-[0.786rem] text-[0.714rem] leading-none ${on ? 'text-white/70' : 'text-subtle'}`}>
                {shortMonth(d)}
              </span>
            ) : (
              <span aria-hidden className="flex h-[0.786rem] items-center">
                <span className={`h-1 w-1 rounded-full ${d === today ? (on ? 'bg-white' : 'bg-ink') : 'bg-transparent'}`} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Trois panneaux (période précédente / courante / suivante — jour, semaine ou mois) : on glisse librement,
 * l'accroche retombe sur un panneau, puis la date change et le carrousel se recale silencieusement au centre.
 */
export function DayCarousel({
  date,
  onChange,
  render,
  prev,
  next,
}: {
  date: string;
  onChange: (dateKey: string) => void;
  render: (dateKey: string) => ReactNode;
  /** Clés des périodes voisines (défaut : veille / lendemain) — semaine ± 7 jours, mois ± 1 mois. */ prev?: string;
  next?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settling = useRef<number | null>(null);
  const days = [prev ?? addDaysToKey(date, -1), date, next ?? addDaysToKey(date, 1)];

  const recenter = (behavior: ScrollBehavior = 'auto') => {
    const el = ref.current;
    if (el) el.scrollTo({ left: el.clientWidth, behavior });
  };
  useLayoutEffect(() => recenter(), [date]);

  /**
   * GLISSEMENT MAÎTRISÉ (25 nov. 2026, signalé par le propriétaire : « en défilant vite vers le
   * bas, l'agenda passe à la veille ou au lendemain »). Le défilement horizontal NATIF, avec
   * accroche obligatoire, transformait le léger biais d'un geste vertical rapide en changement de
   * jour. Désormais le navigateur ne gère plus que le vertical (`touch-action: pan-y`) et c'est ce
   * code qui décide :
   *   - le geste devient horizontal seulement s'il l'est NETTEMENT (|dx| ≥ 2 × |dy| et ≥ 14 px) —
   *     un geste parti en vertical reste vertical jusqu'au bout ;
   *   - le jour change si l'on a glissé d'au moins un quart de la largeur, ou d'un geste vif
   *     (≥ 0,5 px/ms sur au moins 50 px) ; sinon le panneau revient au centre.
   * Sur ordinateur (pavé tactile, molette), le défilement horizontal reste natif et l'on recale sur
   * le panneau le plus proche quand il s'arrête.
   */
  const geste = useRef<{ x: number; y: number; t: number; mode: 'aucun' | 'h' | 'v' } | null>(null);
  const VERROU_PX = 14;
  const RAPPORT = 2;

  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    if (!t0 || e.touches.length > 1) return;
    geste.current = { x: t0.clientX, y: t0.clientY, t: performance.now(), mode: 'aucun' };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = geste.current;
    const t0 = e.touches[0];
    const el = ref.current;
    if (!g || !t0 || !el) return;
    const dx = t0.clientX - g.x;
    const dy = t0.clientY - g.y;
    if (g.mode === 'aucun') {
      if (Math.abs(dx) >= VERROU_PX && Math.abs(dx) >= RAPPORT * Math.abs(dy)) g.mode = 'h';
      else if (Math.abs(dy) >= VERROU_PX) g.mode = 'v';
    }
    if (g.mode === 'h') el.scrollLeft = el.clientWidth - dx;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = geste.current;
    geste.current = null;
    const el = ref.current;
    if (!g || !el || g.mode !== 'h') return;
    const t1 = e.changedTouches[0];
    const dx = (t1?.clientX ?? g.x) - g.x;
    const vitesse = Math.abs(dx) / Math.max(1, performance.now() - g.t);
    const assez = Math.abs(dx) >= el.clientWidth / 4 || (vitesse >= 0.5 && Math.abs(dx) >= 50);
    const cible = assez ? (dx < 0 ? 2 : 0) : 1;
    el.scrollTo({ left: cible * el.clientWidth, behavior: 'smooth' });
  };

  const onScroll = () => {
    if (geste.current?.mode === 'h') return; // doigt encore posé : rien ne se décide
    if (settling.current) window.clearTimeout(settling.current);
    // Fin de défilement : le panneau le plus proche gagne (« scrollend » n'est pas encore partout).
    settling.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el || el.clientWidth === 0 || geste.current) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      if (index === 1) {
        if (Math.abs(el.scrollLeft - el.clientWidth) > 1) recenter('smooth');
        return;
      }
      onChange(days[index]!);
    }, 120);
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      // Toujours de gauche à droite : en RTL, `scrollLeft` devient négatif et le panneau
      // central ne se recale plus (la date passait à `undefined` et l'agenda plantait).
      // Les panneaux gardent le sens d'écriture de la page.
      dir="ltr"
      className="-mx-4 flex overflow-x-auto"
      style={{
        // Plus d'accroche native : c'est le geste ci-dessus qui choisit le panneau.
        scrollbarWidth: 'none',
        overscrollBehaviorX: 'contain',
        touchAction: 'pan-y',
      }}
      aria-label={t("Glisser pour changer de jour")}
    >
      {days.map((d) => (
        <div
          key={d}
          dir={typeof document !== 'undefined' ? document.documentElement.dir || 'ltr' : 'ltr'}
          className="w-full flex-none px-4"
          aria-hidden={d !== date}
        >
          {render(d)}
        </div>
      ))}
    </div>
  );
}
