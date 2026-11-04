/**
 * Menu « Plus » de l'espace pro (refonte du 1er nov. 2026, ergonomie mew3id) : une feuille qui monte
 * du bas, l'identité du salon en tête, une GRILLE DE TUILES sans sous-menus, « Se déconnecter » en bas.
 * Il remplace le tiroir de 18 entrées : une indépendante n'y trouve que ce qui lui sert.
 * « Équipe » n'apparaît qu'à partir de deux personnes actives (95 % des pros travaillent seuls).
 */
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { ChartColumn, CircleHelp, ContactRound, Link2, LogOut, Scissors, Settings, Star, Users, X, type LucideIcon } from 'lucide-react';
import { useProReviewsUnanswered, useProSalon } from '@salondz/api-client';
import { useSignOut } from '@/lib/auth';
import { usePublicUrl } from '@/pages/pro/Link';
import { Avatar, BottomSheet, Dim, I } from './ui';
import { t } from '@/i18n';

interface Tile {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

/** Entrées du menu « Plus » — partagées avec le rail de l'ordinateur (`ProNav`). */
export function usePlusTiles(): Tile[] {
  const salon = useProSalon().data?.salon ?? null;
  const unanswered = useProReviewsUnanswered(!!salon).data?.count ?? 0;
  const team = (salon?.staff.filter((m) => m.isActive).length ?? 0) > 1;
  return [
    // « Clientes » pour un salon de femmes (comme la maquette 11), « Clients » sinon.
    { to: '/pro/clients', label: salon?.genderTarget === 'women' ? t('Clientes') : t('Clients'), icon: ContactRound },
    { to: '/pro/catalogue', label: t('Prestations'), icon: Scissors },
    { to: '/pro/lien', label: t('Ma page'), icon: Link2 },
    { to: '/pro/avis', label: t('Avis'), icon: Star, count: unanswered },
    { to: '/pro/chiffre-affaires', label: t("Chiffre d'affaires"), icon: ChartColumn },
    ...(team ? [{ to: '/pro/equipe', label: t('Équipe'), icon: Users }] : []),
    { to: '/pro/parametres', label: t('Paramètres'), icon: Settings },
    { to: '/aide', label: t('Aide'), icon: CircleHelp },
  ];
}

export function ProPlusSheet({ onClose }: { onClose: () => void }) {
  const salon = useProSalon().data?.salon ?? null;
  const { short } = usePublicUrl(salon?.slug ?? '');
  const tiles = usePlusTiles();
  const { seDeconnecter, enCours } = useSignOut();
  // Portail sur le corps : la barre du bas est TRANSFORMÉE (centrage), elle deviendrait le repère
  // de la feuille fixe, qui s'afficherait dans la barre au lieu de l'écran.
  return createPortal(
    <>
      <Dim onClose={onClose} className="!z-[45]" />
      <BottomSheet modal className="plus-sheet !z-[50]">
        <div className="flex items-center gap-3">
          {salon && <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={44} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[1.214rem] font-semibold">{salon?.name ?? 'Salon DZ'}</span>
            <span className="block truncate text-[0.929rem] text-muted" dir="ltr">
              {short}
            </span>
          </span>
          <button type="button" className="rx" aria-label={t('Fermer')} onClick={onClose}>
            <I icon={X} size={18} />
          </button>
        </div>
        <nav className="plus-grid" aria-label={t('Plus')}>
          {tiles.map((it) => (
            <Link key={it.to} to={it.to} className="plus-tile" onClick={onClose}>
              <I icon={it.icon} size={22} strokeWidth={1.9} className="text-accent" />
              <span>{it.label}</span>
              {!!it.count && <span className="plus-n">{it.count > 9 ? '9+' : it.count}</span>}
            </Link>
          ))}
        </nav>
        <button type="button" className="btn d2" disabled={enCours} aria-busy={enCours || undefined} onClick={() => void seDeconnecter(onClose)}>
          {enCours ? <span className="btn-spin" aria-hidden /> : <I icon={LogOut} size={18} />}
          {enCours ? t('Déconnexion…') : t('Se déconnecter')}
        </button>
      </BottomSheet>
    </>,
    document.body,
  );
}
