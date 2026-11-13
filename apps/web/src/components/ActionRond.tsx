/**
 * ROND D'ACTION (13 nov. 2026, charte `docs/CHARTE.md`) : l'icône dans un rond de 56 px, le mot
 * dessous. Le même partout où l'on décide d'un rendez-vous (fenêtre de l'agenda, page du rendez-vous).
 *   ton="oui" → vert plein iOS (#34c759) : accepter, terminé
 *   ton="non" → rouge plein iOS (#ff3b30) : refuser, absent, retard
 *   ton="orange" → reporter · ton="bleu" → fiche, reprendre · ton="violet" → confier
 *   sans ton  → blanc cerclé de gris (geste secondaire rare)
 * Les couleurs disent l'action avant le mot (13 nov. 2026, demande du propriétaire).
 * À ranger dans `.ag-acts` (grille qui répartit les ronds sur la largeur).
 */
import type { LucideIcon } from 'lucide-react';
import { I } from './ui';
import { ICONES_DETAILLEES } from '@/lib/customIcons';

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
  ton?: 'oui' | 'non' | 'orange' | 'bleu' | 'violet';
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`ag-act ${ton ?? ''}`} title={title ?? label} aria-label={title ?? label} disabled={busy} onClick={onClick}>
      <span className="ag-act-r" aria-hidden>
        {busy ? <span className="btn-spin" /> : <I icon={icon} size={ICONES_DETAILLEES.has(icon) ? 28 : 22} strokeWidth={ICONES_DETAILLEES.has(icon) ? 1.5 : 2} />}
      </span>
      <span className="ag-act-l">{label}</span>
    </button>
  );
}
