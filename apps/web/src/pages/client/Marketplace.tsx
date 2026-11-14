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
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Bell, Search, User } from 'lucide-react';
import { pagesItems, useMe, useSalonSearchInfinite, useUnreadNotifications } from '@salondz/api-client';
import { formatLocale } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { useDesktop } from '@/lib/breakpoint';
import { NotificationsSheet } from '@/pages/AccountNotifications';
import { LoadMore } from '@/components/LoadMore';
import {
  MARKET_LABELS_FR,
  categoryLabel,
  type CategoryId,
  type Market,
} from '@salondz/constants';
import { useLocationPrefs } from '@/lib/clientPrefs';
import { useClientMarket } from '@/lib/useClientMarket';
import { I, Pill, Skeleton } from '@/components/ui';
import { SearchField, SearchTools } from '@/components/SearchTools';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { SalonListCard } from '@/components/SalonListCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { t } from '@/i18n';
import { MARCHE } from '@/lib/flavor';

const NOUN: Record<Market, [string, string]> = {
  men: ['barbier', 'barbiers'],
  women: ['salon', 'salons'],
};

export function Marketplace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { session } = useAuth();
  const me = useMe(!!session);
  const nonLues = useUnreadNotifications(!!session);
  const desktop = useDesktop();
  const [bell, setBell] = useState(false);
  const { market, setMarket, ready } = useClientMarket();
  const [prefs, setPrefs] = useLocationPrefs();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  /**
   * `?market=men|women` (tiroir, lien de catégorie) : on bascule le marché du compte, puis on
   * retire le paramètre. Une catégorie « femmes » ouverte depuis un compte réglé sur les
   * hommes donnait zéro résultat sans explication ; ici le marché suit ce qu'on a touché.
   */
  const wantedMarket = params.get('market');
  useEffect(() => {
    if (!ready || (wantedMarket !== 'men' && wantedMarket !== 'women')) return;
    if (market !== wantedMarket) setMarket(wantedMarket);
    const next = new URLSearchParams(params);
    next.delete('market');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedMarket, market, ready]);

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

  const swapMarket = () => setMarket(market === 'men' ? 'women' : 'men');

  const all = pagesItems(query.data);
  // « Ouvert maintenant » se filtre côté client : l'état d'ouverture est déjà dans chaque carte.
  const items = prefs.openNow ? all.filter((s) => s.isOpenNow) : all;
  const total = prefs.openNow ? items.length : (query.data?.pages[0]?.total ?? items.length);

  const noun = t(NOUN[market][total > 1 ? 1 : 0]);
  // Compteur honnête : « disponibles aujourd'hui » seulement si des créneaux du jour existent dans la page.
  const todayCount = items.filter((x) => x.nextSlots.length > 0).length;
  const countLabel =
    todayCount > 0
      ? t('{n} {noun} disponible(s) aujourd’hui', { n: todayCount, noun: t(NOUN[market][todayCount > 1 ? 1 : 0]) })
      : t('{n} {noun} · prochaines disponibilités ci-dessous', { n: total, noun });

  // ACCUEIL CLIENT = ACCUEIL PRO (14 nov. 2026) : la date, « Bonjour », la cloche, sur la photo du
  // premier salon proposé, très floutée (`.h12-top.photo`, thème minimal éditorial). Sur ordinateur,
  // l'en-tête de la coque porte déjà la cloche : on ne la répète pas.
  const firstName = (me.data?.profile.fullName ?? '').split(' ')[0];
  const fond = items[0]?.photoUrls?.[0] ?? items[0]?.coverUrl ?? null;
  const dateLine = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Algiers' }).format(new Date());

  return (
    <Screen bottom={NAV_PAD} gap={12} width="page" className="h12 cl-home">
      <header className={`h12-top${fond ? ' photo' : ''}`} style={fond ? { ['--fond-salon' as string]: `url("${fond}")` } : undefined}>
        <div className="h12-hd">
          <div className="min-w-0 flex-1">
            <span className="h12-date">{dateLine}</span>
            <span className="h12-hi">
              {t('Bonjour')} {firstName}
            </span>
          </div>
          {!desktop &&
            (session ? (
              <button type="button" className="h12-bell" aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')} onClick={() => setBell(true)}>
                <I icon={Bell} size={20} strokeWidth={1.8} />
                {nonLues > 0 && <i aria-hidden />}
              </button>
            ) : (
              <Link to={`/intro?next=${encodeURIComponent(MARCHE)}`} className="h12-bell" aria-label={t('Se connecter ou créer un compte')}>
                <I icon={User} size={20} strokeWidth={1.8} />
              </Link>
            ))}
        </div>
      </header>
      {bell && <NotificationsSheet onClose={() => setBell(false)} />}
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

      {/* Titre du marché affiché, au-dessus des résultats qu'il commande — comme « Ma page » sur
          l'accueil pro : le titre de section, et le changement en lien souligné. */}
      <h2 className="h12-h mt-1">
        {t(MARKET_LABELS_FR[market])}
        <button type="button" onClick={swapMarket}>
          {market === 'men' ? t('Voir Pour Femmes') : t('Voir Pour Hommes')}
        </button>
      </h2>

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
          <div className="mt-2 text-[1.429rem] font-semibold leading-tight tracking-[-0.4px]">
            {t("Aucun professionnel")}{category ? ` « ${categoryLabel(category)} »` : ''} {t("à")}{' '}{prefs.label}
          </div>
          <p className="p">{t("Essayez d'élargir le rayon ou de retirer un filtre.")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            {prefs.radiusKm < 10 && (
              <Pill lg onClick={() => setPrefs({ radiusKm: 10 })}>
                {t("Rayon 10 km")}
              </Pill>
            )}
            {(prefs.availableToday || prefs.openNow || prefs.ratingMin != null) && (
              <Pill
                lg
                onClick={() => setPrefs({ availableToday: false, openNow: false, ratingMin: null })}
              >
                {t("Retirer les filtres")}
              </Pill>
            )}
            {category && (
              <Pill lg onClick={() => setCategory('')}>
                {t("Retirer «")}{' '}{categoryLabel(category).split(' ')[0]} »
              </Pill>
            )}
            <Link to="/localisation" className="pill lg">
              {t("Autres quartiers")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="cl-count">{countLabel}</p>
          {/* `gr` : la liste se range en colonnes dès qu'il y a la place (rien en dessous de 768 px). */}
          <div className="gr flex flex-col gap-3.5">
            {items.map((s) => (
              <SalonListCard key={s.id} salon={s} />
            ))}
          </div>
          <LoadMore
            hasMore={query.hasNextPage}
            loading={query.isFetchingNextPage}
            onMore={() => void query.fetchNextPage()}
            label={t("Voir plus de professionnels")}
          />
        </>
      )}
    </Screen>
  );
}
