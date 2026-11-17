/**
 * Carte d'un rendez-vous, UNE pour trois écrans : confirmer, confirmation, fiche du rendez-vous.
 * L'ESSENTIEL SEULEMENT (17 nov. 2026, demande du propriétaire : « droit au but », aucun texte gris
 * inutile) : le salon et l'état ; le jour (« Demain », « Mer. 18 nov. ») et l'heure en grand ; la
 * prestation et son prix. Plus d'adresse (le bouton Itinéraire y mène), plus de date complète sous
 * « Demain », plus de durée, plus de « Paiement sur place » ni de règle de retard. Le pied n'existe
 * que pour un VERSEMENT (`payNote`), seule information d'argent qui change quelque chose.
 */
import type { ReactNode } from 'react';
import { CalendarDays, Scissors, Banknote } from 'lucide-react';
import type { BookingStatus, CancellationKind, CancelledBy } from '@salondz/constants';
import { formatDA, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import { Avatar, StatusBadge } from './ui';
import { FactRow } from './BookingFacts';
import { t } from '@/i18n';

export interface SummaryLine {
  id: string;
  name: string;
  minutes?: number | null;
  priceDa: number;
}

export function BookingSummary({
  salon,
  status,
  cancelledBy,
  cancellationKind,
  startsAt,
  lines,
  priceDa,
  payNote,
  extra,
  muted,
  className = '',
}: {
  salon: { name: string; logoUrl?: string | null; coverUrl?: string | null };
  status?: BookingStatus;
  cancelledBy?: CancelledBy | null;
  cancellationKind?: CancellationKind | null;
  startsAt: string;
  lines: SummaryLine[];
  priceDa: number;
  /** Seulement pour un versement : « Versement de 500 DA à faire · reste 1 000 DA sur place ». */
  payNote?: string | null;
  /** Lignes propres à l'écran (pour qui, note, motif d'annulation). */
  extra?: ReactNode;
  /** Rendez-vous passé ou annulé : l'heure en gris. */
  muted?: boolean;
  className?: string;
}) {
  const dayLabel = relativeDayLabelDZ(toLocalDateKey(new Date(startsAt)));
  const single = lines.length === 1;

  return (
    <div className={`crd !gap-0 !py-1 ${className}`}>
      <div className="li !items-center !gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={40} />
          <span className="min-w-0 truncate text-[1rem] font-semibold">{salon.name}</span>
        </span>
        {status && (
          <span className="bk-badge flex-none">
            <StatusBadge status={status} cancelledBy={cancelledBy} kind={cancellationKind} />
          </span>
        )}
      </div>
      <FactRow
        icon={CalendarDays}
        title={dayLabel}
        right={
          <span className={`mono text-[1.429rem] font-semibold tracking-[-0.5px] ${muted ? 'text-muted' : ''}`} dir="ltr">
            {formatTimeDZ(startsAt)}
          </span>
        }
      />
      {lines.map((l) => (
        <FactRow
          key={l.id}
          icon={Scissors}
          title={l.name}
          right={<span className="text-[1rem] font-semibold">{formatDA(l.priceDa)}</span>}
        />
      ))}
      {!single && (
        <FactRow
          icon={Banknote}
          title={t('Total')}
          right={<span className="text-[1rem] font-semibold">{formatDA(priceDa)}</span>}
        />
      )}
      {extra}
      {payNote && <p className="px-0.5 pb-2 pt-2.5 text-[0.857rem] font-medium">{payNote}</p>}
    </div>
  );
}
