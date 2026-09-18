/**
 * Cadre d'application : sur téléphone, la colonne du design (390–430 px) centrée, fond
 * « écran », barre d'onglets flottante « verre » en bas. À partir de 768 px, le cadre prend
 * la largeur de l'écran (`--shell-w`) au lieu de rester une colonne perdue dans le gris ;
 * c'est la seule différence, et elle est entièrement portée par la feuille de style.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useProPendingBookings } from '@salondz/api-client';
import { Calendar, CalendarDays, House, Inbox, LayoutGrid, Store, User, type LucideIcon } from 'lucide-react';
import { I } from './ui';
import { useDesktop } from '@/lib/breakpoint';
import { t } from '@/i18n';

/**
 * Hauteur réservée sous le contenu quand une barre d'onglets ou une feuille est affichée.
 * La barre flottante déployée mesure 4,5 rem et se pose à 0,875 rem du bas, soit 76 px :
 * 96 laisse le dégagement nécessaire, voile compris, sans réserver de vide inutile.
 */
export const NAV_PAD = 96;
export const SHEET_PAD = 132;
/** Feuille basse à DEUX boutons (action secondaire au-dessus de la principale) : la dernière ligne du contenu reste visible. */
export const SHEET_PAD_2 = 196;

export function AppFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto min-h-dvh w-full max-w-[var(--shell-w)] bg-bg ${className}`}>
      {children}
    </div>
  );
}

/**
 * Corps d'écran. Les valeurs par défaut commandent la densité de TOUTE l'application :
 * un écran qui ne passe rien reprend ces chiffres, donc c'est ici qu'on gagne du scroll
 * partout à la fois. Gouttière latérale de 16 px, l'écart entre blocs fait le reste.
 *
 * `width` n'a d'effet qu'à partir de 768 px — sur téléphone il n'y a qu'une largeur :
 *   • `read` (défaut) : colonne de lecture centrée. Un formulaire, un réglage ou une fiche
 *     étirés sur 1 900 px sont illisibles ;
 *   • `page` : page de contenu qui range ses cartes en colonnes (marketplace, favoris) ;
 *   • `wide` : écran de TRAVAIL qui prend toute la largeur (agenda, carte).
 */
export function Screen({
  children,
  bottom = 16,
  gap = 12,
  width = 'read',
  className = '',
  style,
}: {
  children: ReactNode;
  bottom?: number;
  gap?: number;
  width?: 'read' | 'page' | 'wide';
  className?: string;
  /** Rare : un écran qui calcule sa propre largeur utile (l'agenda, d'après son nombre de colonnes). */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`scr flex flex-col px-4 pt-3 ${width === 'read' ? '' : width} ${className}`}
      // `--scr-b` porte la marge basse demandée : la règle `padding-bottom` vit dans la feuille
      // de style (et non ici) pour qu'une requête de média puisse la reprendre quand la barre
      // d'onglets disparaît. Sur téléphone, le calcul est exactement celui d'avant : au moins la
      // marge demandée, au moins la hauteur réelle de la feuille basse (`--sheet-h`, publiée par
      // BottomSheet), pour que rien ne reste caché derrière.
      style={{ gap: `${gap / 16}rem`, ['--scr-b' as string]: `${bottom / 16}rem`, ...style }}
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
  { to: '/', label: t("Marketplace"), icon: LayoutGrid, end: true },
  { to: '/rendez-vous', label: t("Rendez-vous"), icon: Calendar },
  { to: '/profil', label: t("Profil"), icon: User },
];

/** Navigation pro réduite à l'essentiel du quotidien : la gestion (salon, catalogue, équipe, clients, règles, compte) passe par Profil. */
const PRO_NAV: NavItem[] = [
  { to: '/pro', label: t("Accueil"), icon: House, end: true },
  { to: '/pro/agenda', label: t("Agenda"), icon: CalendarDays },
  { to: '/pro/reservations', label: t("Réservations"), icon: Inbox },
  { to: '/pro/profil', label: t("Profil"), icon: Store },
];

export function BottomNav({ kind }: { kind: 'client' | 'pro' }) {
  const items = kind === 'client' ? CLIENT_NAV : PRO_NAV;
  /**
   * À partir de 1 024 px, la navigation vit dans l'en-tête (client) ou dans le rail
   * permanent (pro) : une pastille flottante au milieu d'un écran de 1 900 px n'a plus de
   * sens. En dessous, rien ne change.
   */
  const desktop = useDesktop();
  /**
   * Demandes à confirmer à la main : le compte est posé en rouge sur l'onglet Réservations,
   * visible depuis n'importe quel écran de l'espace pro. Un rendez-vous qui attend une
   * confirmation est de l'argent et un client en suspens ; le professionnel ne doit pas
   * avoir à ouvrir un écran pour l'apprendre.
   *
   * Même requête que l'accueil (`['pro','bookings','pending']`) : le cache est partagé,
   * donc aucune requête de plus, et l'invalidation du temps réel met la pastille à jour
   * sans rien actualiser.
   */
  const pending = useProPendingBookings(kind === 'pro');
  const badge = kind === 'pro' ? (pending.data?.items.length ?? 0) : 0;
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

  if (desktop) return null;
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
            aria-label={
              it.to === '/pro/reservations' && badge > 0
                ? `${it.label} · ${badge} à confirmer`
                : undefined
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative flex items-center justify-center">
                  <I
                    icon={it.icon}
                    size={22}
                    strokeWidth={isActive ? 2 : 1.6}
                    className="text-current"
                  />
                  {it.to === '/pro/reservations' && badge > 0 && (
                    <span className="nvd" aria-hidden>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="nvl">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
