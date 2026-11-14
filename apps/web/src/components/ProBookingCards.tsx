/**
 * Cartes de rendez-vous de l'espace pro, PARTAGÉES par l'accueil et les réservations (28 oct. 2026).
 *
 * - `RequestCard` : une demande à valider, sur la ligne de Rappels (`rp-*`) : l'heure et le jour
 *   (on lit QUAND avant QUI), puis trois ronds — ✓ confirmer, ✕ refuser, « … » pour reporter ou
 *   ouvrir. Chaque carte a SA PROPRE mutation : confirmer une demande ne met en attente que son
 *   rond, les autres restent utilisables.
 * - `TimelineList` / `TimelineRow` / `TimelineNow` : une journée en frise verticale (heure, point
 *   sur le rail de la couleur de la prestation, client, prix), avec le repère « maintenant ».
 *
 * Styles : préfixes `phr` et `phd` dans `styles/index.css`.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CalendarClock, Check, Eye, MoreHorizontal, X } from 'lucide-react';
import { useProBookingMutations } from '@salondz/api-client';
import { formatDA, formatTimeDZ, relativeDayLabelDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff } from '@salondz/types';
import { BottomSheet, Button, Dim, I, StatusBadge } from './ui';
import { DepositChip } from './DepositReview';
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
  const [more, setMore] = useState(false);
  const day = toLocalDateKey(new Date(b.startsAt));
  return (
    <>
      {/* Même ligne que Rappels (11 nov. 2026) : QUAND, QUI, puis les deux gestes du quotidien en
          ronds — confirmer, refuser — et le reste derrière « … ». */}
      <article className="rp-r rq-r">
        <button type="button" className="rq-main" onClick={() => onOpen(b.id)}>
          <b className="rp-t" dir="ltr">
            {formatTimeDZ(b.startsAt)}
            <small>{relativeDayLabelDZ(day, today)}</small>
          </b>
          <span className="min-w-0 flex-1">
            <span className="rp-n">{b.clientName}</span>
            <span className="rp-s">
              {b.serviceName}
              {showStaff && b.staff?.displayName ? ` · ${b.staff.displayName}` : ''} ·{' '}
              <span dir="ltr">{formatDA(b.priceDa)}</span>
            </span>
            <DepositChip booking={b} />
          </span>
        </button>
        <span className="rp-a">
          <button
            type="button"
            className="rp-i yes"
            aria-label={t('Confirmer')}
            title={t('Confirmer')}
            disabled={setStatus.isPending}
            aria-busy={setStatus.isPending || undefined}
            onClick={() => (b.depositStatus ? onOpen(b.id) : setStatus.mutate({ id: b.id, status: 'confirmed' }))}
          >
            {setStatus.isPending ? <span className="btn-spin" aria-hidden /> : <I icon={Check} size={19} strokeWidth={2.4} />}
          </button>
          <button
            type="button"
            className="rp-i no"
            aria-label={t('Refuser')}
            title={t('Refuser')}
            onClick={() => onRefuse({ id: b.id, clientName: b.clientName })}
          >
            <I icon={X} size={19} strokeWidth={2.4} />
          </button>
          <button type="button" className="rp-i" aria-label={t('Autres actions')} title={t('Autres actions')} onClick={() => setMore(true)}>
            <I icon={MoreHorizontal} size={19} />
          </button>
        </span>
      </article>
      <ErrorMessage error={setStatus.error} />
      {more && (
        <>
          <Dim onClose={() => setMore(false)} />
          <BottomSheet modal>
            <div className="h2 !text-[1.286rem]">{b.clientName}</div>
            <Button
              variant="g"
              onClick={() => {
                setMore(false);
                navigate(`/pro/rendez-vous/${b.id}/reporter`);
              }}
            >
              <I icon={CalendarClock} size={18} /> {t('Reporter')}
            </Button>
            <Button
              variant="g"
              onClick={() => {
                setMore(false);
                onOpen(b.id);
              }}
            >
              <I icon={Eye} size={18} /> {t('Voir le rendez-vous')}
            </Button>
          </BottomSheet>
        </>
      )}
    </>
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
