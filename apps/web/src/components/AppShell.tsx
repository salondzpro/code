import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useMe, useNotifications } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { useRealtimeMyBookings } from '@/lib/realtime';

const navClass = ({ isActive }: { isActive: boolean }) => `rounded-[var(--radius-pill)] px-3 py-1.5 text-sm ${isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-bg'}`;

export function AppShell() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const me = useMe(!!session);
  const notifs = useNotifications(!!session);
  useRealtimeMyBookings(session?.user.id);
  const unread = notifs.data?.unreadCount ?? 0;
  const isPro = me.data?.profile.role === 'pro' || !!me.data?.salon;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-xl font-bold tracking-tight text-primary">
            SalonDZ
          </Link>
          <nav className="flex items-center gap-1" aria-label="Navigation principale">
            <NavLink to="/recherche" className={navClass}>
              Rechercher
            </NavLink>
            {session ? (
              <>
                <NavLink to="/compte/reservations" className={navClass}>
                  Mes réservations
                </NavLink>
                <NavLink to="/compte/notifications" className={navClass}>
                  Notifications{unread > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-contrast">{unread}</span>}
                </NavLink>
                <NavLink to={isPro ? '/pro' : '/pro/onboarding'} className={navClass}>
                  Espace pro
                </NavLink>
                <NavLink to="/compte/favoris" className={navClass}>
                  Favoris
                </NavLink>
                <NavLink to="/compte" className={navClass}>
                  Compte
                </NavLink>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-sm"
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                  }}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <NavLink to="/connexion?role=pro" className={navClass}>
                  Espace pro
                </NavLink>
                <NavLink to="/connexion" className="btn-primary px-3 py-1.5 text-sm">
                  Connexion
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">SalonDZ · Réservation de salons en Algérie · Prix en DA</footer>
    </div>
  );
}
