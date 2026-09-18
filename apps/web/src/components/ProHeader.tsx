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
 *
 * À partir de 1 024 px, ce même contenu (`ProNav`) est affiché en permanence dans le rail
 * de gauche : le bouton de menu disparaît, la marque prend la largeur du rail et le nom de
 * l'établissement se range à gauche. Rien d'autre ne change.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { Menu, Plus, X } from 'lucide-react';
import { useProPendingBookings, useProSalon } from '@salondz/api-client';
import { Avatar, I, Dim } from './ui';
import { ProNav } from './ProNav';
import { useDesktop } from '@/lib/breakpoint';
import { t } from '@/i18n';

export function ProHeader() {
  const [open, setOpen] = useState(false);
  // `key` change à CHAQUE navigation, y compris quand seule la recherche (`?category=`) change :
  // un lien de catégorie depuis la marketplace laissait le tiroir ouvert sur la page.
  const { pathname, key: navKey } = useLocation();
  const salon = useProSalon().data?.salon ?? null;
  const pending = useProPendingBookings(!!salon).data?.items.length ?? 0;
  const desktop = useDesktop();
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
            <span className="ms-[0.16em] font-light text-muted">DZ</span>
            <span className="ms-2 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
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

        <ProNav salon={salon} pending={pending} after={() => setOpen(false)} />
        {/* Dégagement sous le dernier élément : la barre d'onglets flotte à 78 px du bas. */}
        <div aria-hidden className="h-[5.5rem] flex-none" />
      </nav>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--shell-w)] items-center gap-2 px-2">
        <button
          type="button"
          className="ib !border-0 !bg-transparent lg:hidden"
          aria-label={t("Menu")}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <I icon={Menu} size={24} />
        </button>
        {/* Sur ordinateur, la marque tient exactement la largeur du rail : l'en-tête et le
            rail sont alignés, comme dans un outil de bureau. */}
        <span className="hidden w-[var(--rail-w)] flex-none items-center ps-3 text-[1.143rem] leading-none tracking-[-0.4px] lg:flex">
          <span className="font-semibold">Salon</span>
          <span className="ms-[0.16em] font-light text-muted">DZ</span>
          <span className="ms-2 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
            {t("Pro")}
          </span>
        </span>
        <Link
          to="/pro"
          className="flex min-w-0 flex-1 items-center justify-center gap-2 lg:justify-start"
          aria-label={salon ? `${salon.name} · accueil` : 'Accueil'}
        >
          {salon && <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={28} />}
          <span className="truncate text-[1.143rem] font-semibold tracking-[-0.3px]">
            {salon?.name ?? 'Salon DZ'}
          </span>
        </Link>
        <Link
          to="/pro/rendez-vous/nouveau"
          className="me-2 flex h-[2.5rem] w-[2.5rem] flex-none items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-ink text-white lg:w-auto lg:px-3.5"
          aria-label={t("Nouveau rendez-vous")}
          title={t("Nouveau rendez-vous")}
        >
          <I icon={Plus} size={22} className="text-current" />
          <span className="hidden text-[1rem] font-semibold lg:inline">{t("Rendez-vous")}</span>
        </Link>
      </div>
      {!desktop && open && createPortal(drawer, document.body)}
    </header>
  );
}
