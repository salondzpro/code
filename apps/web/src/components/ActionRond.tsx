/**
 * ROND D'ACTION (13 nov. 2026, charte `docs/CHARTE.md`) : l'icône dans un rond de 56 px, le mot
 * dessous. Le même partout où l'on décide d'un rendez-vous (fenêtre de l'agenda, page du rendez-vous).
 *   ton="oui" → vert plein iOS (#34c759) : accepter, terminé
 *   ton="non" → rouge plein iOS (#ff3b30) : refuser, absent, retard
 *   sans ton  → blanc cerclé de gris : reporter, annuler, confier, fiche…
 * À ranger dans `.ag-acts` (grille qui répartit les ronds sur la largeur).
 */
import type { LucideIcon } from 'lucide-react';
import { I } from './ui';

export function ActionRond({
  icon,
  label,
  title,
  ton,
  busy,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  title?: string;
  ton?: 'oui' | 'non';
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`ag-act ${ton ?? ''}`} title={title ?? label} aria-label={title ?? label} disabled={busy} onClick={onClick}>
      <span className="ag-act-r" aria-hidden>
        {busy ? <span className="btn-spin" /> : <I icon={icon} size={22} strokeWidth={2} />}
      </span>
      <span className="ag-act-l">{label}</span>
    </button>
  );
}
