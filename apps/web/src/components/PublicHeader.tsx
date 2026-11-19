/**
 * En-tête du parcours client, FAÇON PLANITY (19 nov. 2026, demande du propriétaire : « refais tout le
 * design, 100 % comme Planity, remets le drawer exactement comme eux ») : bande blanche, menu à
 * gauche, marque en capitales espacées au centre, bouton NOIR carré du compte à droite. Affiché sur
 * téléphone ET ordinateur, sur tout le parcours client.
 *
 * Le menu est un TIROIR blanc qui glisse depuis la gauche par-dessus la page assombrie : croix en
 * haut à droite, « Se connecter » (bouton noir), « Je suis professionnel… » (bouton cerclé, SITE
 * seulement — l'application cliente ne mène jamais à l'espace pro, règle n° 4), la liste des métiers,
 * et en bas « Plus de fonctionnalités dans l'application » (site seulement).
 *
 * Monté par un PORTAIL sur `document.body` : un en-tête `sticky` crée son propre contexte
 * d'empilement et la barre d'onglets passait devant le tiroir.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router';
import { Bell, CalendarClock, Heart, Home, Menu, User, X } from 'lucide-react';
import { CATEGORIES, MARKETS } from '@salondz/constants';
import { useMe, useUnreadNotifications } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { guestMarket } from '@/lib/useClientMarket';
import { I, Dim } from './ui';
import { NotificationsSheet } from '@/pages/AccountNotifications';
import { t } from '@/i18n';
import { MARCHE, NATIF } from '@/lib/flavor';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname, key: navKey } = useLocation();
  const [bell, setBell] = useState(false);
  const { session } = useAuth();
  const me = useMe(!!session);
  const nonLues = useUnreadNotifications(!!session);
  const market = me.data?.profile.market ?? guestMarket() ?? MARKETS[0];
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
        { to: MARCHE, icon: Home, label: t('Accueil') },
        { to: '/rendez-vous', icon: CalendarClock, label: t('Mes rendez-vous') },
        { to: '/profil', icon: User, label: t('Mon profil') },
      ]
    : [{ to: MARCHE, icon: Home, label: t('Accueil') }];

  // Deux blocs SÉPARÉS (19 nov. 2026, demande du propriétaire) : « Pour Hommes » et « Pour Femmes »,
  // celui de la personne d'abord ; les prestations femmes en ROSE (`--color-women`).
  const blocs = [...MARKETS]
    .sort((a) => (a === market ? -1 : 1))
    .map((m) => ({ m, items: CATEGORIES.filter((c) => c.market === m && !c.legacy) }));

  const drawer = (
    <>
      <Dim onClose={() => setOpen(false)} className="pl-dim" />
      <nav className="pl-drw" aria-label={t('Menu Salon DZ')}>
        <button type="button" className="pl-drw-x" aria-label={t('Fermer le menu')} onClick={() => setOpen(false)}>
          <I icon={X} size={22} />
        </button>

        {session ? (
          <div className="pl-drw-me">
            <Link to="/rendez-vous" className="pl-drw-a">
              <I icon={CalendarClock} size={20} /> {t('Mes rendez-vous')}
            </Link>
            <Link to="/favoris" className="pl-drw-a">
              <I icon={Heart} size={20} /> {t('Mes favoris')}
            </Link>
            <Link to="/profil" className="pl-drw-a">
              <I icon={User} size={20} /> {t('Mon profil')}
            </Link>
          </div>
        ) : (
          <Link to={`/acces?next=${next}`} className="pl-btn pl-btn-ink">
            {t('Se connecter')}
          </Link>
        )}

        {!NATIF && (
          <Link to="/professionnels" className="pl-btn pl-btn-out">
            {t('Je suis professionnel')}
            <br />
            {t('de la beauté ou du bien-être')}
          </Link>
        )}

        {blocs.map(({ m, items }) => (
          <div key={m} className={`pl-drw-list${m === 'women' ? ' women' : ''}`}>
            <span className="pl-drw-h">{m === 'women' ? t('Pour Femmes') : t('Pour Hommes')}</span>
            {items.map((c) => (
              <Link key={c.id} to={`${MARCHE}?category=${c.id}&market=${m}`} className="pl-drw-li">
                {t(c.labelFr)}
              </Link>
            ))}
          </div>
        ))}

        {!NATIF && (
          <Link to="/app" className="pl-drw-app">
            <span className="pl-drw-logo" aria-hidden>
              S
            </span>
            <span className="underline underline-offset-2">{t('Plus de fonctionnalités dans l’application.')}</span>
          </Link>
        )}
      </nav>
    </>
  );

  return (
    <header className="pl-hdr sticky top-0 z-30">
      <div className="pl-hdr-in">
        <button type="button" className="pl-hdr-menu" aria-label={t('Menu')} aria-expanded={open} onClick={() => setOpen(true)}>
          <I icon={Menu} size={26} strokeWidth={1.8} />
        </button>
        <Link to={MARCHE} className="pl-mark" aria-label={t('Salon DZ · accueil')}>
          SALON DZ
        </Link>
        <nav className="pl-hdr-nav" aria-label={t('Navigation')}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === MARCHE} className={({ isActive }) => (isActive ? 'on' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <span className="pl-hdr-r">
          {session && (
            <button
              type="button"
              onClick={() => setBell(true)}
              className="pl-hdr-bell"
              aria-label={nonLues ? `${t('Notifications')} · ${nonLues}` : t('Notifications')}
            >
              <I icon={Bell} size={22} strokeWidth={1.8} />
              {nonLues > 0 && (
                <span className="nvd !left-auto !-right-1 !-top-1" aria-hidden>
                  {nonLues > 9 ? '9+' : nonLues}
                </span>
              )}
            </button>
          )}
          <Link
            to={session ? '/profil' : `/acces?next=${next}`}
            className="pl-hdr-me"
            aria-label={session ? t('Mon profil') : t('Se connecter ou créer un compte')}
          >
            <I icon={User} size={22} strokeWidth={1.8} />
          </Link>
        </span>
      </div>
      {open && createPortal(drawer, document.body)}
      {bell && <NotificationsSheet onClose={() => setBell(false)} />}
    </header>
  );
}
