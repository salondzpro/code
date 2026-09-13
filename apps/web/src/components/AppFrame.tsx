/**
 * Cadre d'application : une colonne de largeur téléphone (390–430 px) centrée sur
 * grand écran, fond « écran » du design, barre d'onglets flottante « verre » en bas.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Calendar, CalendarDays, House, Inbox, LayoutGrid, Store, User, type LucideIcon } from 'lucide-react';
import { I } from './ui';

/**
 * Hauteur réservée sous le contenu quand une barre d'onglets ou une feuille est affichée.
 * La barre flottante déployée mesure 4,5 rem et se pose à 0,875 rem du bas, soit 76 px :
 * 96 laisse le dégagement nécessaire, voile compris, sans réserver de vide inutile.
 */
export const NAV_PAD = 96;
export const SHEET_PAD = 132;

export function AppFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto min-h-dvh w-full max-w-[var(--app-max-width)] bg-bg ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Corps d'écran. Les valeurs par défaut commandent la densité de TOUTE l'application :
 * un écran qui ne passe rien reprend ces chiffres, donc c'est ici qu'on gagne du scroll
 * partout à la fois. Gouttière latérale de 16 px, l'écart entre blocs fait le reste.
 */
export function Screen({
  children,
  bottom = 16,
  gap = 12,
  className = '',
}: {
  children: ReactNode;
  bottom?: number;
  gap?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col px-4 pt-3 ${className}`}
      style={{ gap: `${gap / 16}rem`, paddingBottom: `${bottom / 16}rem` }}
    >
      {children}
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const CLIENT_NAV: NavItem[] = [
  { to: '/', label: 'Marketplace', icon: LayoutGrid, end: true },
  { to: '/rendez-vous', label: 'Rendez-vous', icon: Calendar },
  { to: '/profil', label: 'Profil', icon: User },
];

/** Navigation pro réduite à l'essentiel du quotidien : la gestion (salon, catalogue, équipe, clients, règles, compte) passe par Profil. */
const PRO_NAV: NavItem[] = [
  { to: '/pro', label: 'Accueil', icon: House, end: true },
  { to: '/pro/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/pro/reservations', label: 'Réservations', icon: Inbox },
  { to: '/pro/profil', label: 'Profil', icon: Store },
];

export function BottomNav({ kind }: { kind: 'client' | 'pro' }) {
  const items = kind === 'client' ? CLIENT_NAV : PRO_NAV;
  /**
   * La barre se réduit aux icônes pendant le défilement, et se rouvre avec ses libellés dès
   * qu'on s'arrête : elle rend de la hauteur au contenu quand on parcourt, et redevient
   * explicite quand on cherche où aller.
   */
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      // Tout en haut, la barre reste ouverte : rien à gagner à la réduire.
      setCompact(window.scrollY > 24);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setCompact(false), 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <span aria-hidden className="nvb-veil" />
      <nav
        className={`nvb${compact ? ' cmp' : ''}`}
        aria-label={kind === 'client' ? 'Navigation' : 'Navigation professionnelle'}
      >
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => `nvi${isActive ? ' on' : ''}`}
            title={it.label}
          >
            {({ isActive }) => (
              <>
                <I
                  icon={it.icon}
                  size={22}
                  strokeWidth={isActive ? 2 : 1.6}
                  className="text-current"
                />
                <span className="nvl">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
