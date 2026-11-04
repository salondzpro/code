/**
 * Cadre d'application : sur téléphone, la colonne du design (390–430 px) centrée, fond
 * « écran », barre d'onglets flottante « verre » en bas. À partir de 768 px, le cadre prend
 * la largeur de l'écran (`--shell-w`) au lieu de rester une colonne perdue dans le gris ;
 * c'est la seule différence, et elle est entièrement portée par la feuille de style.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useProPendingUnseenCount, useProSalon, useProUnseenBookings } from '@salondz/api-client';
import { Calendar, CalendarDays, Inbox, LayoutGrid, Menu, User, type LucideIcon, BellRing } from 'lucide-react';
import { I } from './ui';
import { PushToast } from './PushToast';
import { ProPlusSheet } from './ProPlusSheet';
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
  /** Grand rond central en relief (l'Agenda, côté pro). */
  center?: boolean;
  /** « Plus » : actif sur toute page de gestion qui n'a pas son propre onglet. */
  rest?: boolean;
}

const CLIENT_NAV: NavItem[] = [
  { to: '/', label: t("Marketplace"), icon: LayoutGrid, end: true },
  { to: '/rendez-vous', label: t("Rendez-vous"), icon: Calendar },
  { to: '/profil', label: t("Profil"), icon: User },
];

/**
 * Navigation pro (refonte du 1er nov. 2026, façon mew3id) : les quatre écrans du quotidien et
 * « Plus », qui mène à toute la gestion (salon, catalogue, équipe, règles, compte). L'Agenda est
 * au CENTRE, en grand rond : c'est l'écran qu'on ouvre le plus, il est sous le pouce.
 */
const PRO_NAV: NavItem[] = [
  { to: '/pro', label: t("Accueil"), icon: LayoutGrid, end: true },
  { to: '/pro/reservations', label: t("Demandes"), icon: Inbox },
  { to: '/pro/agenda', label: t("Agenda"), icon: CalendarDays, center: true },
  { to: '/pro/rappels', label: t("Rappels"), icon: BellRing },
  { to: '/pro/plus', label: t("Plus"), icon: Menu, rest: true },
];

export function BottomNav({ kind }: { kind: 'client' | 'pro' }) {
  const items = kind === 'client' ? CLIENT_NAV : PRO_NAV;
  const [plus, setPlus] = useState(false);
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
  const pending = useProPendingUnseenCount(kind === 'pro');
  /**
   * Rendez-vous PAS ENCORE VUS, quelle que soit leur date. Un rendez-vous pris pour la semaine
   * prochaine n'apparaissait nulle part tant qu'on ne descendait pas jusqu'à ce jour-là : on
   * pouvait passer à côté pendant des jours. Le compteur de l'agenda le signale.
   */
  const unseen = useProUnseenBookings(kind === 'pro');
  const badges: Record<string, number> =
    kind === 'pro'
      ? {
          '/pro/reservations': pending,
          '/pro/agenda': unseen.data?.total ?? 0,
        }
      : {};
  /**
   * « Plus » ouvre le menu en tuiles (`ProPlusSheet`) : il reste allumé sur toutes les pages de
   * gestion qui n'ont pas leur propre onglet (prestations, ma page, paramètres…), pour qu'on sache
   * toujours où l'on est.
   */
  const { pathname } = useLocation();
  const restActive =
    kind === 'pro' &&
    !items.some((it) => !it.rest && (it.end ? pathname === it.to : pathname.startsWith(it.to))) &&
    !pathname.startsWith('/pro/rendez-vous');

  if (desktop) return null;
  return (
    <nav className="nvb" aria-label={kind === 'client' ? 'Navigation' : 'Navigation professionnelle'}>
      {items.map((it) =>
        it.rest ? (
          // « Plus » ouvre le menu en tuiles (prestations, ma page, avis, paramètres, aide…).
          <button
            key={it.to}
            type="button"
            className={`nvi${restActive || plus ? ' on' : ''}`}
            onClick={() => setPlus(true)}
            aria-haspopup="dialog"
          >
            <span className="relative flex items-center justify-center">
              <I icon={it.icon} size={22} strokeWidth={restActive ? 2 : 1.6} className="text-current" />
            </span>
            <span className="nvl">{it.label}</span>
          </button>
        ) : (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          // Maquette 9 : l'onglet garde son libellé, la pastille d'accent porte le compte des
          // demandes PAS ENCORE VUES et PAS ENCORE CONFIRMÉES ; il retombe dès que la liste les a
          // affichées.
          className={({ isActive }) => {
            const on = isActive || (it.rest && restActive);
            return `nvi${it.center ? ' ctr' : ''}${on ? ' on' : ''}`;
          }}
          title={it.label}
          aria-label={
            badges[it.to]
              ? `${it.label} · ${badges[it.to]} ${it.to === '/pro/agenda' ? t('nouveau(x)') : t('nouvelle(s) demande(s) à confirmer')}`
              : undefined
          }
        >
          {({ isActive }) => {
            const on = isActive || (!!it.rest && restActive);
            const badge = !!badges[it.to] && (
              <span className="nvd" aria-hidden>
                {badges[it.to]! > 9 ? '9+' : badges[it.to]}
              </span>
            );
            return (
              <>
                {it.center ? (
                  <span className="nvc">
                    <I icon={it.icon} size={24} strokeWidth={1.9} className="text-current" />
                    {badge}
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center">
                    <I icon={it.icon} size={22} strokeWidth={on ? 2 : 1.6} className="text-current" />
                    {badge}
                  </span>
                )}
                <span className="nvl">{it.label}</span>
              </>
            );
          }}
        </NavLink>
        ),
      )}
      {plus && <ProPlusSheet onClose={() => setPlus(false)} />}
    </nav>
  );
}
