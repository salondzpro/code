/**
 * En-tête Salon DZ du parcours client : menu à gauche, wordmark au centre (→ accueil),
 * compte à droite. Affiché sur TOUT le parcours client, avec ou sans compte — c'est le
 * repère qui permet de revenir à l'accueil ou d'ouvrir le menu depuis n'importe où.
 *
 * Le menu est un TIROIR qui glisse depuis la gauche par-dessus la page assombrie, et non
 * plus un panneau qui repoussait le contenu vers le bas : ouvrir le menu ne doit pas
 * déplacer ce qu'on était en train de lire.
 *
 * Son contenu dépend de la session : un visiteur voit d'abord comment se connecter, une
 * cliente connectée voit ses propres écrans. Les catégories sont communes : c'est le
 * raccourci le plus utile depuis une fiche salon.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  CalendarClock,
  Heart,
  LogIn,
  LogOut,
  Menu,
  Search,
  Settings2,
  Store,
  User,
  X,
} from 'lucide-react';
import { CATEGORIES } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { I } from './ui';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const next = encodeURIComponent(pathname);
  useEffect(() => setOpen(false), [pathname]);
  // Le tiroir ouvert ne doit pas laisser la page défiler derrière lui.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const links = session
    ? [
        { to: '/rendez-vous', icon: CalendarClock, label: 'Mes rendez-vous' },
        { to: '/favoris', icon: Heart, label: 'Mes favoris' },
        { to: '/profil', icon: User, label: 'Mon profil' },
        { to: '/reglages', icon: Settings2, label: 'Réglages' },
      ]
    : [
        { to: '/', icon: Search, label: 'Explorer les salons' },
        {
          to: `/connexion?next=${encodeURIComponent('/rendez-vous')}`,
          icon: CalendarClock,
          label: 'Mes rendez-vous',
        },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--app-max-width)] items-center justify-between px-4">
        <button
          type="button"
          className="ib !border-0 !bg-transparent"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <I icon={Menu} size={24} />
        </button>
        <Link
          to="/"
          className="text-[1.429rem] leading-none tracking-[-0.6px]"
          aria-label="Salon DZ · accueil"
        >
          <span className="font-semibold">Salon</span>
          <span className="ml-[0.16em] font-light text-muted">DZ</span>
        </Link>
        {session ? (
          <Link
            to="/profil"
            className="flex h-[2.5rem] w-[2.5rem] items-center justify-center rounded-[0.875rem] bg-ink text-white"
            aria-label="Mon profil"
          >
            <I icon={User} size={20} className="text-current" />
          </Link>
        ) : (
          <Link
            to={`/connexion?next=${next}`}
            className="flex h-[2.5rem] w-[2.5rem] items-center justify-center rounded-[0.875rem] bg-ink text-white"
            aria-label="Se connecter ou créer un compte"
          >
            <I icon={User} size={20} className="text-current" />
          </Link>
        )}
      </div>

      {open && (
        <>
          <div className="dim !z-40" onClick={() => setOpen(false)} />
          <nav className="drw" aria-label="Menu Salon DZ">
            <button
              type="button"
              className="ib !ml-auto !border-0 !bg-transparent"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
            >
              <I icon={X} size={24} />
            </button>

            {!session && (
              <>
                <Link to={`/connexion?next=${next}`} className="btn">
                  Se connecter
                </Link>
                <Link to="/pro" className="btn g">
                  Je suis professionnel
                </Link>
              </>
            )}

            <div className="flex flex-col">
              {links.map((it) => (
                <Link key={it.to} to={it.to} className="flex items-center gap-3 py-3">
                  <I icon={it.icon} size={20} className="flex-none text-muted" />
                  <span className="text-[1.143rem]">{it.label}</span>
                </Link>
              ))}
            </div>

            <span className="h3">Catégories</span>
            <div className="flex flex-col">
              {CATEGORIES.filter((c) => !c.legacy)
                .slice(0, 8)
                .map((c) => (
                  <Link
                    key={c.id}
                    to={`/categorie/${c.id}`}
                    className="py-2.5 text-[1.143rem] text-muted"
                  >
                    {c.labelFr}
                  </Link>
                ))}
            </div>

            {session ? (
              <button
                type="button"
                className="mt-auto flex items-center gap-3 py-3 text-danger"
                onClick={async () => {
                  setOpen(false);
                  await supabase.auth.signOut();
                  navigate('/intro');
                }}
              >
                <I icon={LogOut} size={20} className="flex-none text-current" />
                <span className="text-[1.143rem]">Se déconnecter</span>
              </button>
            ) : (
              <Link to="/pro" className="mt-auto flex items-center gap-3 py-3">
                <I icon={Store} size={20} className="flex-none text-muted" />
                <span className="text-[1.143rem]">Espace professionnel</span>
              </Link>
            )}
            {!session && (
              <Link
                to={`/connexion?next=${next}`}
                className="flex items-center gap-3 pb-2 text-muted"
              >
                <I icon={LogIn} size={18} className="flex-none text-current" />
                <span className="text-[1rem]">Déjà cliente ? Se connecter</span>
              </Link>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
