/**
 * Cadre d'application : une colonne de largeur téléphone (390–430 px) centrée sur
 * grand écran, fond « écran » du design, barre d'onglets fixe en bas.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Calendar, Home, LayoutGrid, Menu, User, Users, type LucideIcon } from 'lucide-react';
import { I } from './ui';

/** Hauteur réservée sous le contenu quand une barre d'onglets ou une feuille est affichée. */
export const NAV_PAD = 110;
export const SHEET_PAD = 150;

export function AppFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative mx-auto min-h-dvh w-full max-w-[var(--app-max-width)] bg-bg ${className}`}>{children}</div>;
}

/** Corps d'écran (design .bd : padding 6px 20px 0, gap 16px). */
export function Screen({ children, bottom = 24, gap = 16, className = '' }: { children: ReactNode; bottom?: number; gap?: number; className?: string }) {
  return (
    <div className={`flex flex-col px-5 pt-4 ${className}`} style={{ gap, paddingBottom: bottom }}>
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

const PRO_NAV: NavItem[] = [
  { to: '/pro', label: 'Accueil', icon: Home, end: true },
  { to: '/pro/agenda', label: 'Agenda', icon: Calendar },
  { to: '/pro/clients', label: 'Clients', icon: User },
  { to: '/pro/equipe', label: 'Équipe', icon: Users },
  { to: '/pro/prestations', label: 'Prestations', icon: Menu },
  { to: '/pro/profil', label: 'Profil', icon: User },
];

export function BottomNav({ kind }: { kind: 'client' | 'pro' }) {
  const items = kind === 'client' ? CLIENT_NAV : PRO_NAV;
  return (
    <nav className="nvb" aria-label={kind === 'client' ? 'Navigation' : 'Navigation professionnelle'}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nvi${isActive ? ' on' : ''}`}>
          {({ isActive }) => (
            <>
              <I icon={it.icon} size={24} className={isActive ? 'text-ink' : 'text-subtle'} />
              <span>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
