/**
 * Espace d'administration de la place de marché — coque et navigation (voir `docs/ADMIN.md`).
 *
 * Le garde est SERVEUR : chaque route `/v1/admin/*` passe par `requireAdmin`. Ce qui suit ne fait
 * qu'afficher — cacher un écran ne protège rien, et une adresse devinée ne donne rien.
 *
 * L'espace reprend les primitives du design (cartes, listes, pastilles) : ce n'est pas un autre
 * produit, c'est le même outil vu de l'autre côté du comptoir. Seul l'en-tête change, pour qu'on
 * sache à tout instant qu'on agit en tant que plateforme et non en tant que salon.
 */
import { NavLink, Outlet, Navigate } from 'react-router';
import { CalendarSearch, ContactRound, LayoutGrid, ScrollText, Store } from 'lucide-react';
import { useAdminMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { I } from '@/components/ui';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

const NAV = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutGrid, end: true },
  { to: '/admin/salons', label: 'Professionnels', icon: Store },
  { to: '/admin/comptes', label: 'Comptes', icon: ContactRound },
  { to: '/admin/rendez-vous', label: 'Rendez-vous', icon: CalendarSearch },
  { to: '/admin/journal', label: 'Journal', icon: ScrollText },
];

/**
 * Le journal enregistre une clé technique — c'est ce qu'on veut y garder, stable et cherchable —
 * mais à l'écran on lit une phrase. Une clé inconnue s'affiche telle quelle : un journal ne cache
 * rien, et une ligne sans traduction vaut mieux qu'une ligne vide.
 */
export function actionLabel(action: string): string {
  if (action === 'view_salon') return t('Fiche salon consultée');
  if (action === 'view_profile') return t('Fiche compte consultée');
  return action;
}

/**
 * Garde d'affichage. Une réponse 403 n'est pas une panne : c'est la réponse normale pour qui n'est
 * pas administrateur. On renvoie à l'accueil sans message d'erreur — inutile d'apprendre à
 * quelqu'un qu'une porte existe.
 */
export function AdminLayout() {
  const { session, loading } = useAuth();
  const me = useAdminMe(!!session);
  if (loading || (!!session && me.isPending)) return <Splash />;
  if (!session || me.isError) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--shell-w)] bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-[3.5rem] max-w-[var(--page-w)] items-center gap-3 px-[calc(1rem+var(--shell-px))]">
          <span className="flex items-center gap-2 text-[1.143rem] leading-none tracking-[-0.4px]">
            <span className="font-semibold">Salon</span>
            <span className="font-light text-muted">DZ</span>
            <span className="rounded-[var(--radius-btn)] bg-ink px-1.5 py-0.5 text-[0.75rem] font-bold uppercase tracking-[0.08em] text-on-ink">
              {t('Plateforme')}
            </span>
          </span>
          <span className="ms-auto text-[0.857rem] text-muted">
            {me.data?.level === 'owner' ? t('Propriétaire') : t('Support')}
          </span>
        </div>
        <nav className="pills mx-auto max-w-[var(--page-w)] px-[calc(1rem+var(--shell-px))] pb-2" aria-label={t('Administration')}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `pill${isActive ? ' on' : ''} !gap-1.5`}
            >
              <I icon={n.icon} size={16} /> {t(n.label)}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
