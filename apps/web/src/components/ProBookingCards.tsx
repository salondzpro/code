/**
 * Cartes de rendez-vous de l'espace pro, PARTAGÉES par l'accueil et les réservations (28 oct. 2026).
 *
 * - `RequestCard` : une demande à valider. L'heure et le jour en pavé (on lit QUAND avant QUI),
 *   puis confirmer / reporter / refuser. Chaque carte a SA PROPRE mutation : confirmer une demande
 *   ne met en attente que son bouton, les autres restent utilisables.
 * - `TimelineList` / `TimelineRow` / `TimelineNow` : une journée en frise verticale (heure, point
 *   sur le rail de la couleur de la prestation, client, prix), avec le repère « maintenant ».
 *
 * Styles : préfixes `phr` et `phd` dans `styles/index.css`.
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useProBookingMutations } from '@salondz/api-client';
import { formatDA, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { Button, StatusBadge } from './ui';
import { ErrorMessage } from './ErrorMessage';
import type { RefusedRequest } from './RefuseRequestSheet';
import { t } from '@/i18n';

export function RequestCard({
  b,
  today,
  showStaff = true,
  onOpen,
  onRefuse,
}: {
  b: BookingWithStaff;
  today: string;
  showStaff?: boolean;
  onOpen: (id: string) => void;
  onRefuse: (r: RefusedRequest) => void;
}) {
  const navigate = useNavigate();
  const { setStatus } = useProBookingMutations();
  const day = toLocalDateKey(new Date(b.startsAt));
  const isToday = day === today;
  return (
    <div className="phr">
      <button type="button" className="flex items-center gap-3 text-start" onClick={() => onOpen(b.id)}>
        <span className={`phr-d ${isToday ? 'on' : ''}`}>
          <span className="mono" dir="ltr">
            {formatTimeDZ(b.startsAt)}
          </span>
          <span>{relativeDayLabelDZ(day, today)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.143rem] font-semibold">{b.clientName}</span>
          <span className="block truncate text-[1rem] text-muted">
            {b.serviceName}
            {showStaff && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
          </span>
        </span>
        <span className="flex-none text-[1rem] font-semibold">{formatDA(b.priceDa)}</span>
      </button>
      <div className="phr-a">
        <Button
          variant="ok"
          sm
          loading={setStatus.isPending}
          onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
        >
          {t('Confirmer')}
        </Button>
        <Button variant="g" sm onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
          {t('Reporter')}
        </Button>
        <Button variant="d" sm onClick={() => onRefuse({ id: b.id, clientName: b.clientName })}>
          {t('Refuser')}
        </Button>
      </div>
      <ErrorMessage error={setStatus.error} />
    </div>
  );
}

/** Le cadre de la frise : une carte, une liste ordonnée. */
export function TimelineList({ children }: { children: ReactNode }) {
  return <ol className="phd">{children}</ol>;
}

export type TimelineState = 'done' | 'live' | 'next';

/** Une ligne de la frise : heure, point sur le rail, client et prestation, prix. */
export function TimelineRow({
  b,
  state = 'next',
  tone,
  showStaff = true,
  onOpen,
}: {
  b: BookingWithStaff;
  state?: TimelineState;
  tone: string;
  showStaff?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`phd-r ${state}`}
        style={{ ['--tone' as string]: tone }}
        onClick={() => onOpen(b.id)}
      >
        <span className="phd-h mono" dir="ltr">
          {formatTimeDZ(b.startsAt)}
          <span>{formatTimeDZ(b.endsAt)}</span>
        </span>
        <span className="phd-p" aria-hidden />
        <span className="phd-c">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
            <span className="block truncate text-[0.857rem] text-muted">
              {b.serviceName}
              {showStaff && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
            </span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <span className="text-[1rem] font-semibold">{formatDA(b.priceDa)}</span>
            {(b.status !== 'confirmed' || state === 'done') && <StatusBadge status={b.status} />}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Le repère du moment, entre ce qui est fait et ce qui vient. */
export function TimelineNow({ time }: { time: string }) {
  return (
    <li className="phd-now" aria-label={t('Maintenant')}>
      <span className="mono" dir="ltr">
        {time}
      </span>
    </li>
  );
}

/** Couleur d'une catégorie de prestation pour un liseré ou un point (gris sans catégorie). */
export const toneVar = (tone: string | null | undefined) =>
  tone ? `var(--color-cat-${tone}-line)` : 'var(--color-disabled)';
