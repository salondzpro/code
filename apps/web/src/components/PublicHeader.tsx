/**
 * En-tête Salon DZ des pages publiques (visiteur arrivé par le lien d'un professionnel, sans compte), façon Planity :
 * menu à gauche, wordmark au centre (→ accueil), bouton compte à droite (→ connexion, puis retour sur la page).
 * Le menu ouvre un panneau simple : explorer les salons, mes rendez-vous, se connecter, espace professionnel.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarClock, LogIn, Menu, Search, Store, User, X } from 'lucide-react';
import { I } from './ui';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const next = encodeURIComponent(pathname);
  useEffect(() => setOpen(false), [pathname]);
  const items = [
    {
      to: '/',
      icon: Search,
      label: 'Explorer les salons',
      hint: 'Coiffure, barbier, beauté près de vous',
    },
    {
      to: `/connexion?next=${encodeURIComponent('/rendez-vous')}`,
      icon: CalendarClock,
      label: 'Mes rendez-vous',
      hint: 'Retrouver, reporter, annuler',
    },
    {
      to: `/connexion?next=${next}`,
      icon: LogIn,
      label: 'Se connecter',
      hint: 'Avec votre numéro de téléphone',
    },
    {
      to: '/pro',
      icon: Store,
      label: 'Espace professionnel',
      hint: 'Vous gérez un salon ? Rejoignez Salon DZ',
    },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.75rem] max-w-[var(--app-max-width)] items-center justify-between px-4">
        <button
          type="button"
          className="ib !border-0 !bg-transparent"
          aria-label={open ? 'Fermer le menu' : 'Menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <I icon={open ? X : Menu} size={24} />
        </button>
        <Link
          to="/"
          className="text-[1.5rem] leading-none tracking-[-0.6px]"
          aria-label="Salon DZ · accueil"
        >
          <span className="font-semibold">Salon</span>
          <span className="ml-[0.16em] font-light text-muted">DZ</span>
        </Link>
        <Link
          to={`/connexion?next=${next}`}
          className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-[0.875rem] bg-ink text-white"
          aria-label="Se connecter ou créer un compte"
        >
          <I icon={User} size={22} />
        </Link>
      </div>
      {open && (
        <nav
          className="border-t border-line-soft bg-surface px-4 pb-3 pt-1"
          aria-label="Menu Salon DZ"
        >
          {items.map((it) => (
            <Link key={it.label} to={it.to} className="flex items-center gap-3.5 py-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
                <I icon={it.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[1rem] font-semibold">{it.label}</span>
                <span className="block text-[0.8125rem] text-muted">{it.hint}</span>
              </span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
