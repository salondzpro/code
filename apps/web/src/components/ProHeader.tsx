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
import { Bell, Plus, X } from 'lucide-react';
import { useProPendingUnseenCount, useProSalon, useUnreadNotifications } from '@salondz/api-client';
import { I, Dim } from './ui';
import { ProNav } from './ProNav';
import { useDesktop } from '@/lib/breakpoint';
import { t } from '@/i18n';

/** Événement qui ouvre le menu pro (envoyé par l'onglet « Plus » de la barre du bas). */
export const PRO_MENU_EVENT = 'salondz:pro-menu';

export function ProHeader() {
  const [open, setOpen] = useState(false);
  // `key` change à CHAQUE navigation, y compris quand seule la recherche (`?category=`) change :
  // un lien de catégorie depuis la marketplace laissait le tiroir ouvert sur la page.
  const { pathname, key: navKey } = useLocation();
  const salon = useProSalon().data?.salon ?? null;
  const pending = useProPendingUnseenCount(!!salon);
  // Pastille des NON-LUES sur la cloche : la même requête que le menu et la liste des notifications.
  const nonLues = useUnreadNotifications(!!salon);
  const desktop = useDesktop();
  useEffect(() => setOpen(false), [pathname, navKey]);
  // Refonte du 1er nov. 2026 : le menu s'ouvre depuis l'onglet « Plus » de la barre du bas
  // (`BottomNav`), plus depuis un bouton d'en-tête — un seul chemin, sous le pouce.
  useEffect(() => {
    const ouvrir = () => setOpen(true);
    window.addEventListener(PRO_MENU_EVENT, ouvrir);
    return () => window.removeEventListener(PRO_MENU_EVENT, ouvrir);
  }, []);
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
    <header className="hdr sticky top-0 z-30">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--shell-w)] items-center gap-2 px-4 lg:px-2">
        {/* Sur ordinateur, la marque tient exactement la largeur du rail : l'en-tête et le
            rail sont alignés, comme dans un outil de bureau. */}
        <span className="hidden w-[var(--rail-w)] flex-none items-center ps-3 text-[1.143rem] leading-none tracking-[-0.4px] lg:flex">
          <span className="font-semibold">Salon</span>
          <span className="ms-[0.16em] font-light text-muted">DZ</span>
          <span className="ms-2 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
            {t("Pro")}
          </span>
        </span>
        <span className="flex-1" />
        {/* Cloche : la liste des notifications, avec le compte des non-lues. Rouge discret, chiffre
            exact, même règle que les autres pastilles — il baisse quand on LIT, pas quand on traite. */}
        <Link
          to="/pro/notifications"
          className="hdr-b relative"
          aria-label={nonLues ? `${t("Notifications")} · ${nonLues}` : t("Notifications")}
          title={t("Notifications")}
        >
          <I icon={Bell} size={20} strokeWidth={1.8} className="text-current" />
          {nonLues > 0 && (
            <span className="nvd !left-auto !-right-1 !-top-1" aria-hidden>
              {nonLues > 9 ? '9+' : nonLues}
            </span>
          )}
        </Link>
        <Link
          to="/pro/rendez-vous/nouveau"
          className="hdr-b acc lg:me-2 lg:w-auto lg:gap-2 lg:rounded-[var(--radius-btn)] lg:px-3.5"
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
