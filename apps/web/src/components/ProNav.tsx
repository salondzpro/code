/**
 * Navigation de l'espace pro : TOUTE la gestion (agenda, réservations, clients, catalogue,
 * équipe, horaires, blocages, règles, chiffre d'affaires, page publique, compte), groupée.
 *
 * Un seul contenu, deux places selon la place disponible — c'est la seule différence :
 *   • téléphone et tablette : dans le TIROIR qui glisse depuis la gauche (`ProHeader`) ;
 *   • à partir de 1 024 px : dans le RAIL permanent à gauche de l'écran (`ProLayout`),
 *     comme les outils du métier, et la barre d'onglets flottante disparaît.
 *
 * Les libellés, l'ordre, les groupes et la pastille des demandes sont les mêmes des deux
 * côtés : passer d'un téléphone à un ordinateur ne demande rien à réapprendre.
 */
import { Link, NavLink, useNavigate } from 'react-router';
import {
  Bell,
  CalendarCog,
  CalendarDays,
  CalendarOff,
  ChartColumn,
  Clock,
  ContactRound,
  Eye,
  House,
  Inbox,
  LogOut,
  Share2,
  Store,
  Tag,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SalonOwnerView } from '@salondz/types';
import { useAuth } from '@/lib/auth';
import { Avatar, Badge, I } from './ui';
import { usePublicUrl } from '@/pages/pro/Link';
import { t } from '@/i18n';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Compteur rouge (demandes à confirmer). */
  count?: number;
}

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="flex flex-col border-t border-line-soft pt-2.5">
      <span className="h3 pb-1">{title}</span>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex items-center gap-3 py-2.5 ${isActive ? 'font-semibold' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              <I
                icon={it.icon}
                size={20}
                strokeWidth={isActive ? 2 : 1.6}
                className={`flex-none ${isActive ? 'text-text' : 'text-muted'}`}
              />
              <span className="min-w-0 flex-1 truncate text-[1.143rem]">{it.label}</span>
              {!!it.count && (
                <span className="flex h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-[0.857rem] font-bold text-white">
                  {it.count > 9 ? '9+' : it.count}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

export function ProNav({
  salon,
  pending,
  after,
}: {
  salon: SalonOwnerView | null;
  pending: number;
  /** Fin de la navigation : le tiroir se referme, le rail n'a rien à fermer. */
  after?: () => void;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { short } = usePublicUrl(salon?.slug ?? '');
  return (
    <>
      {salon && (
        <Link to="/pro/profil" className="flex items-center gap-3 py-2" aria-label={t("Profil du salon")}>
          <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
              {salon.name}
            </span>
            <span className="block truncate text-[0.857rem] text-muted">{short}</span>
          </span>
          <Badge tone={salon.isPublished ? 'ok' : 'pd'}>
            {salon.isPublished ? 'En ligne' : 'Non publiée'}
          </Badge>
        </Link>
      )}

      <Group
        title={t("Au quotidien")}
        items={[
          { to: '/pro', label: t("Accueil"), icon: House, end: true },
          { to: '/pro/agenda', label: t("Agenda"), icon: CalendarDays },
          { to: '/pro/reservations', label: t("Réservations"), icon: Inbox, count: pending },
          { to: '/pro/clients', label: t("Clients"), icon: ContactRound },
          { to: '/pro/chiffre-affaires', label: t("Chiffre d'affaires"), icon: ChartColumn },
        ]}
      />
      <Group
        title={t("Mon établissement")}
        items={[
          { to: '/pro/mon-salon', label: t("Mon salon"), icon: Store },
          { to: '/pro/catalogue', label: t("Catalogue"), icon: Tag },
          { to: '/pro/equipe', label: t("Équipe"), icon: Users },
          { to: '/pro/profil/horaires', label: t("Horaires d'ouverture"), icon: Clock },
          { to: '/pro/blocages', label: t("Fermetures et blocages"), icon: CalendarOff },
          { to: '/pro/reglages/rendez-vous', label: t("Règles de rendez-vous"), icon: CalendarCog },
        ]}
      />
      <Group
        title={t("Page publique")}
        items={[
          ...(salon ? [{ to: `/s/${salon.slug}`, label: t("Voir ma page"), icon: Eye }] : []),
          { to: '/pro/lien', label: t("Lien et partage"), icon: Share2 },
        ]}
      />
      <Group
        title={t("Compte")}
        items={[
          { to: '/pro/compte', label: t("Mon compte"), icon: UserCircle },
          { to: '/pro/notifications', label: t("Notifications"), icon: Bell },
        ]}
      />

      <div className="mt-auto flex flex-col pt-2">
        <button
          type="button"
          className="flex items-center gap-3 py-2.5 text-danger"
          onClick={async () => {
            after?.();
            await signOut();
            navigate('/pro/bienvenue');
          }}
        >
          <I icon={LogOut} size={20} className="flex-none text-current" />
          <span className="text-[1.143rem]">{t("Se déconnecter")}</span>
        </button>
      </div>
    </>
  );
}

/**
 * Rail permanent, monté seulement à partir de 1 024 px (voir `useDesktop`). Sa largeur et sa
 * position collante vivent dans `.rail` (feuille de style) : elles n'existent pas en dessous.
 */
export function ProRail({ salon, pending }: { salon: SalonOwnerView | null; pending: number }) {
  return (
    <nav className="rail" aria-label={t("Menu professionnel")}>
      <ProNav salon={salon} pending={pending} />
    </nav>
  );
}
