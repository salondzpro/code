/**
 * Ligne de fiche de rendez-vous, sur le modèle des outils du métier : une icône ronde, le
 * fait en gras, le détail en gris dessous, quelque chose à droite si besoin (statut,
 * prix). Même lecture sur la fenêtre de l'agenda, la fiche pro et les écrans clients.
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { I } from './ui';

export function FactRow({
  icon,
  title,
  sub,
  right,
  tone,
}: {
  icon: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  /** `danger` : motif d'annulation, absence. */
  tone?: 'danger';
}) {
  return (
    <div className="li !items-center">
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${tone === 'danger' ? 'bg-cancel-bg text-danger' : 'bg-fill text-muted'}`}
        >
          <I icon={icon} size={18} />
        </span>
        <span className="min-w-0">
          <span className={`block text-[1rem] font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>
            {title}
          </span>
          {sub && <span className="block text-[0.857rem] text-muted">{sub}</span>}
        </span>
      </span>
      {right && <span className="flex-none">{right}</span>}
    </div>
  );
}
