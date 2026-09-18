/**
 * En-tête Salon DZ du parcours client : menu à gauche, wordmark au centre (→ accueil),
 * compte à droite. Affiché sur TOUT le parcours client, avec ou sans compte — c'est le
 * repère qui permet de revenir à l'accueil ou d'ouvrir le menu depuis n'importe où.
 *
 * Le menu est un TIROIR qui glisse depuis la gauche par-dessus la page assombrie.
 *
 * Il est monté par un PORTAIL sur `document.body`, et non dans l'en-tête : un en-tête
 * `sticky z-30` crée son propre contexte d'empilement, si bien que le z-index du tiroir ne
 * comptait plus face à la barre d'onglets, elle aussi en 30. La barre passait devant et
 * masquait le bouton de déconnexion.
 *
 * Contenu volontairement court : quelques destinations, puis les catégories séparées par
 * marché — les prestations pour hommes et pour femmes n'ont rien à voir, mélanger les deux
 * listes obligeait la cliente à faire le tri elle-même.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router';
import { CalendarClock, ChevronDown, Home, LogOut, Menu, Store, User, X } from 'lucide-react';
import { CATEGORIES, MARKET_LABELS_FR, MARKETS, type Market } from '@salondz/constants';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { I, Dim } from './ui';
import { t } from '@/i18n';

/** Trois catégories par marché : au-delà, le tiroir devient une liste à faire défiler. */
const PER_MARKET = 3;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  /**
   * Marché déplié : celui du compte tant qu'on n'a rien touché, puis celui qu'on ouvre.
   * « none » existe pour pouvoir tout replier, ce qu'un simple `Market | null` ne
   * distinguerait pas du « on n'a encore rien choisi ».
   */
  const [picked, setPicked] = useState<Market | 'none' | null>(null);
  // `key` change à CHAQUE navigation, y compris quand seule la recherche (`?category=`) change :
  // un lien de catégorie depuis la marketplace laissait le tiroir ouvert sur la page.
  const { pathname, key: navKey } = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const me = useMe(!!session);
  // Le marché du compte s'ouvre d'office : c'est celui que la cliente ou le client consulte.
  const market = me.data?.profile.market ?? MARKETS[0];
  const shown = picked === null ? market : picked === 'none' ? null : picked;
  const next = encodeURIComponent(pathname);
  useEffect(() => setOpen(false), [pathname, navKey]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = session
    ? [
        { to: '/', icon: Home, label: t("Accueil") },
        { to: '/rendez-vous', icon: CalendarClock, label: t("Mes rendez-vous") },
        { to: '/profil', icon: User, label: t("Mon profil") },
      ]
    : [
        { to: '/', icon: Home, label: t("Accueil") },
        {
          to: `/connexion?next=${encodeURIComponent('/rendez-vous')}`,
          icon: CalendarClock,
          label: t("Mes rendez-vous"),
        },
      ];

  const drawer = (
    <>
      {/* Le voile passe SOUS le tiroir : en 60 contre 50, il le grisait entièrement et
          rendait la déconnexion incliquable. */}
      <Dim onClose={() => setOpen(false)} className="!z-[45]" />
      <nav className="drw" aria-label={t("Menu Salon DZ")}>
        <button
          type="button"
          className="ib !ml-auto !border-0 !bg-transparent"
          aria-label={t("Fermer le menu")}
          onClick={() => setOpen(false)}
        >
          <I icon={X} size={24} />
        </button>

        {!session && (
          <Link to={`/connexion?next=${next}`} className="btn">
            {t("Se connecter")}
          </Link>
        )}

        <div className="flex flex-col">
          {links.map((it) => (
            <Link key={it.to} to={it.to} className="flex items-center gap-3 py-2.5">
              <I icon={it.icon} size={20} className="flex-none text-muted" />
              <span className="text-[1.143rem]">{it.label}</span>
            </Link>
          ))}
        </div>

        {/* Chaque marché est une section qui s'ouvre et se ferme, titre en gras : côte à
            côte et à plat, les deux listes se lisaient comme une seule et on ne savait plus
            si « Coiffure » était celle des hommes ou celle des femmes. */}
        {MARKETS.map((market) => {
          const on = shown === market;
          return (
            <div key={market} className="flex flex-col border-t border-line-soft">
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setPicked(on ? 'none' : market)}
                className="flex items-center justify-between gap-3 py-3 text-start"
              >
                <span className="text-[1.143rem] font-bold tracking-[-0.3px]">
                  {t(MARKET_LABELS_FR[market])}
                </span>
                <I
                  icon={ChevronDown}
                  size={20}
                  className={`flex-none text-muted transition-transform duration-150${on ? ' rotate-180' : ''}`}
                />
              </button>
              {on && (
                <div className="mb-2 flex flex-col border-s-2 border-line ps-3.5">
                  {CATEGORIES.filter((c) => c.market === market && !c.legacy)
                    .slice(0, PER_MARKET)
                    .map((c) => (
                      <Link
                        key={c.id}
                        to={`/?category=${c.id}&market=${market}`}
                        className="py-2 text-[1.143rem] text-muted"
                      >
                        {t(c.labelFr)}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Dégagement sous le dernier élément : la barre d'onglets flotte à 78 px du bas. */}
        <div className="mt-auto flex flex-col pt-2" style={{ paddingBottom: '5.5rem' }}>
          {session ? (
            <button
              type="button"
              className="flex items-center gap-3 py-2.5 text-danger"
              onClick={async () => {
                setOpen(false);
                await signOut();
                navigate('/intro');
              }}
            >
              <I icon={LogOut} size={20} className="flex-none text-current" />
              <span className="text-[1.143rem]">{t("Se déconnecter")}</span>
            </button>
          ) : (
            <Link to="/pro" className="flex items-center gap-3 py-2.5">
              <I icon={Store} size={20} className="flex-none text-muted" />
              <span className="text-[1.143rem]">{t("Je suis professionnel")}</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--app-max-width)] items-center justify-between px-4">
        <button
          type="button"
          className="ib !border-0 !bg-transparent"
          aria-label={t("Menu")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <I icon={Menu} size={24} />
        </button>
        <Link
          to="/"
          className="text-[1.429rem] leading-none tracking-[-0.6px]"
          aria-label={t("Salon DZ · accueil")}
        >
          <span className="font-semibold">Salon</span>
          <span className="ms-[0.16em] font-light text-muted">DZ</span>
        </Link>
        <Link
          to={session ? '/profil' : `/connexion?next=${next}`}
          className="flex h-[2.5rem] w-[2.5rem] items-center justify-center rounded-[var(--radius-card-sm)] bg-ink text-white"
          aria-label={session ? 'Mon profil' : 'Se connecter ou créer un compte'}
        >
          <I icon={User} size={20} className="text-current" />
        </Link>
      </div>
      {open && createPortal(drawer, document.body)}
    </header>
  );
}
