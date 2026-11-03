/**
 * Cadre d'application : sur téléphone, la colonne du design (390–430 px) centrée, fond
 * « écran », barre d'onglets flottante « verre » en bas. À partir de 768 px, le cadre prend
 * la largeur de l'écran (`--shell-w`) au lieu de rester une colonne perdue dans le gris ;
 * c'est la seule différence, et elle est entièrement portée par la feuille de style.
 */
import { type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useProPendingUnseenCount, useProSalon, useProUnseenBookings } from '@salondz/api-client';
import { Calendar, CalendarDays, House, Inbox, LayoutGrid, Store, User, type LucideIcon } from 'lucide-react';
import { I } from './ui';
import { PushToast } from './PushToast';
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
    // Les marges système ne sont PLUS réservées ici : elles le sont sur `#root` (voir index.css),
    // donc sur absolument tout ce que l'application affiche — y compris les écrans d'erreur et de
    // chargement, qui passaient avant l'entrée dans ce cadre et s'affichaient sous la barre d'état.
    // Les valeurs restent mesurées sur l'appareil par `MainActivity`, jamais devinées.
    <div className={`relative mx-auto h-app w-full max-w-[var(--shell-w)] bg-bg ${className}`}>
      {children}
      {/* Notification reçue application ouverte : un bandeau, sur tous les écrans. */}
      <PushToast />
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
  /** Onglet « Profil » : allumé sur toute page de gestion qui n'a pas son propre onglet. */
  rest?: boolean;
}

const CLIENT_NAV: NavItem[] = [
  { to: '/', label: t("Marketplace"), icon: LayoutGrid, end: true },
  { to: '/rendez-vous', label: t("Rendez-vous"), icon: Calendar },
  { to: '/profil', label: t("Profil"), icon: User },
];

/**
 * Navigation pro (3 nov. 2026, demande du propriétaire) : QUATRE onglets égaux, dans l'ordre du
 * quotidien — Accueil · Agenda · Demandes · Profil. Plus de rond central en relief : aucun onglet ne
 * prend plus de place qu'un autre. Profil mène à toute la gestion (clientèle, prestations, ma page,
 * avis, chiffre d'affaires, équipe, paramètres, aide) ; il reste allumé sur ces pages, pour qu'on
 * sache toujours où l'on est.
 */
const PRO_NAV: NavItem[] = [
  { to: '/pro', label: t("Accueil"), icon: House, end: true },
  { to: '/pro/agenda', label: t("Agenda"), icon: CalendarDays },
  { to: '/pro/reservations', label: t("Demandes"), icon: Inbox },
  { to: '/pro/profil', label: t("Profil"), icon: Store, rest: true },
];

export function BottomNav({ kind }: { kind: 'client' | 'pro' }) {
  // Seulement côté pro : un client n'a pas de salon (la requête répondrait une erreur).
  const salon = useProSalon(kind === 'pro').data?.salon ?? null;
  const items = kind === 'client' ? CLIENT_NAV : PRO_NAV;
  /**
   * À partir de 1 024 px, la navigation vit dans l'en-tête (client) ou dans le rail
   * permanent (pro) : une pastille flottante au milieu d'un écran de 1 900 px n'a plus de
   * sens. En dessous, rien ne change.
   */
  const desktop = useDesktop();
  /**
   * Demandes à confirmer PAS ENCORE VUES : leur nombre, en abricot, sur l'onglet Demandes, visible
   * depuis n'importe quel écran de l'espace pro. Même requête que l'accueil : le cache est partagé
   * et le temps réel met la pastille à jour sans rien actualiser. Elle retombe dès qu'un écran les a
   * affichées ; le nombre de demandes en attente reste sur l'accueil.
   */
  const pending = useProPendingUnseenCount(kind === 'pro');
  /**
   * Rendez-vous PAS ENCORE VUS, quelle que soit leur date (pris pour la semaine prochaine, par
   * exemple) : un simple point sur l'Agenda — le détail, jour par jour, est dans l'agenda.
   */
  const unseen = useProUnseenBookings(kind === 'pro').data?.total ?? 0;
  const { pathname } = useLocation();
  const restActive =
    kind === 'pro' &&
    !items.some((it) => !it.rest && (it.end ? pathname === it.to : pathname.startsWith(it.to))) &&
    !pathname.startsWith('/pro/rendez-vous');

  if (desktop) return null;
  return (
    <nav className="nvb" aria-label={kind === 'client' ? t('Navigation') : t('Navigation professionnelle')}>
      {items.map((it) => {
        const count = kind === 'pro' && it.to === '/pro/reservations' ? pending : 0;
        const dot = kind === 'pro' && it.to === '/pro/agenda' && unseen > 0;
        const label = count
          ? `${it.label} · ${t('{n} nouvelle(s) demande(s) à confirmer', { n: count })}`
          : dot
            ? `${it.label} · ${t('{n} rendez-vous pas encore vu(s)', { n: unseen })}`
            : undefined;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => `nvi${isActive || (it.rest && restActive) ? ' on' : ''}`}
            title={it.label}
            aria-label={label}
          >
            {({ isActive }) => {
              const on = isActive || (!!it.rest && restActive);
              return (
                <>
                  <span className="relative flex items-center justify-center">
                    {kind === 'pro' && it.rest && salon ? (
                      // Profil : la photo du salon (ou son initiale) plutôt qu'une icône de plus.
                      <span className="nva" aria-hidden>
                        {(salon.logoUrl ?? salon.coverUrl) ? (
                          <img src={(salon.logoUrl ?? salon.coverUrl)!} alt="" />
                        ) : (
                          salon.name.trim().charAt(0).toUpperCase()
                        )}
                      </span>
                    ) : (
                      <I icon={it.icon} size={22} strokeWidth={on ? 2 : 1.7} className="text-current" />
                    )}
                    {count > 0 && (
                      <span className="nvd" aria-hidden>
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                    {dot && <span className="nvd dot" aria-hidden />}
                  </span>
                  <span className="nvl">{it.label}</span>
                </>
              );
            }}
          </NavLink>
        );
      })}
    </nav>
  );
}
