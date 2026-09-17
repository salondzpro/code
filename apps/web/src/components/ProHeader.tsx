/**
 * En-tête de l'espace pro, sur le modèle des outils du métier (Planity Pro) : menu à
 * gauche, l'établissement au centre (→ accueil), « + » à droite pour ajouter un
 * rendez-vous depuis n'importe quel écran.
 *
 * Le menu est un TIROIR qui glisse depuis la gauche : il donne accès à TOUTE la gestion
 * (agenda, réservations, clients, catalogue, équipe, horaires, blocages, règles, chiffre
 * d'affaires, page publique, compte) sans passer par l'onglet Profil. La barre d'onglets
 * du bas ne garde que le quotidien ; le tiroir porte le reste, à un geste.
 *
 * Monté par un PORTAIL sur `document.body` (voir `PublicHeader`) : un en-tête `sticky`
 * crée son propre contexte d'empilement, et le tiroir passerait sous la barre d'onglets.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
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
  Menu,
  Plus,
  Share2,
  Store,
  Tag,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useProPendingBookings, useProSalon } from '@salondz/api-client';
import { supabase } from '@/lib/supabase';
import { Avatar, Badge, I, Dim } from './ui';
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

export function ProHeader() {
  const [open, setOpen] = useState(false);
  // `key` change à CHAQUE navigation, y compris quand seule la recherche (`?category=`) change :
  // un lien de catégorie depuis la marketplace laissait le tiroir ouvert sur la page.
  const { pathname, key: navKey } = useLocation();
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const pending = useProPendingBookings(!!salon).data?.items.length ?? 0;
  const { short } = usePublicUrl(salon?.slug ?? '');
  useEffect(() => setOpen(false), [pathname, navKey]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const drawer = (
    <>
      <Dim onClose={() => setOpen(false)} className="!z-[45]" />
      <nav className="drw !gap-1" aria-label={t("Menu professionnel")}>
        <div className="flex items-center justify-between">
          <span className="text-[1.143rem] leading-none tracking-[-0.4px]">
            <span className="font-semibold">Salon</span>
            <span className="ml-[0.16em] font-light text-muted">DZ</span>
            <span className="ml-2 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
              {t("Pro")}
            </span>
          </span>
          <button
            type="button"
            className="ib !border-0 !bg-transparent"
            aria-label={t("Fermer le menu")}
            onClick={() => setOpen(false)}
          >
            <I icon={X} size={24} />
          </button>
        </div>

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

        {/* Dégagement sous le dernier élément : la barre d'onglets flotte à 78 px du bas. */}
        <div className="mt-auto flex flex-col pt-2" style={{ paddingBottom: '5.5rem' }}>
          <button
            type="button"
            className="flex items-center gap-3 py-2.5 text-danger"
            onClick={async () => {
              setOpen(false);
              await supabase.auth.signOut();
              navigate('/pro/bienvenue');
            }}
          >
            <I icon={LogOut} size={20} className="flex-none text-current" />
            <span className="text-[1.143rem]">{t("Se déconnecter")}</span>
          </button>
        </div>
      </nav>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--app-max-width)] items-center gap-2 px-2">
        <button
          type="button"
          className="ib !border-0 !bg-transparent"
          aria-label={t("Menu")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <I icon={Menu} size={24} />
        </button>
        <Link
          to="/pro"
          className="flex min-w-0 flex-1 items-center justify-center gap-2"
          aria-label={salon ? `${salon.name} · accueil` : 'Accueil'}
        >
          {salon && <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={28} />}
          <span className="truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
            {salon?.name ?? 'Salon DZ'}
          </span>
        </Link>
        <Link
          to="/pro/rendez-vous/nouveau"
          className="mr-2 flex h-[2.5rem] w-[2.5rem] flex-none items-center justify-center rounded-[var(--radius-btn)] bg-ink text-white"
          aria-label={t("Nouveau rendez-vous")}
          title={t("Nouveau rendez-vous")}
        >
          <I icon={Plus} size={22} className="text-current" />
        </Link>
      </div>
      {open && createPortal(drawer, document.body)}
    </header>
  );
}
