/**
 * Réservations : ce qui attend une réponse, puis tout ce qui arrive. « À valider » en tête (confirmer,
 * reporter, refuser avec motif), puis les rendez-vous à venir groupés par jour — la liste chronologique
 * que l'agenda ne donne qu'un jour à la fois.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { useProBookingMutations, useProBookings, useProPendingBookings } from '@salondz/api-client';
import {
  addDaysToKey,
  formatDA,
  formatDateShortDZ,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
} from '@salondz/constants';
import { formatDuration } from '@/lib/format';
import { ErrorMessage } from '@/components/ErrorMessage';
import { RefuseRequestSheet, type RefusedRequest } from '@/components/RefuseRequestSheet';
import {
  Avatar,
  Button,
  EmptyState,
  I,
  SectionLabel,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';

/** Fenêtre de la liste « à venir » : au-delà, l'agenda mois prend le relais. */
const HORIZON_DAYS = 30;
const localKey = (iso: string) => toLocalDateKey(new Date(iso));

export function Requests() {
  const navigate = useNavigate();
  const pending = useProPendingBookings();
  const today = toLocalDateKey();
  const next = useProBookings({ from: today, to: addDaysToKey(today, HORIZON_DAYS), limit: 100 });
  const { setStatus } = useProBookingMutations();
  const [refusing, setRefusing] = useState<RefusedRequest | null>(null);
  const items = pending.data?.items ?? [];

  // À venir = ce qui n'est pas terminé, hors annulés et hors demandes (déjà en tête).
  const now = Date.now();
  const upcoming = (next.data?.items ?? [])
    .filter(
      (b) =>
        (b.status === 'confirmed' || b.status === 'pending') &&
        new Date(b.endsAt).getTime() > now &&
        !items.some((p) => p.id === b.id),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days: [string, typeof upcoming][] = [];
  for (const b of upcoming) {
    const key = localKey(b.startsAt);
    const last = days[days.length - 1];
    if (last && last[0] === key) last[1].push(b);
    else days.push([key, [b]]);
  }

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <h1 className="h1">Réservations</h1>
      {pending.isError && <ErrorMessage error={pending.error} retry={() => pending.refetch()} />}

      {items.length > 0 && (
        <SectionLabel right={<span className="s">{items.length}</span>}>À valider</SectionLabel>
      )}
      {items.map((b) => (
        /* Même carte compacte que l'accueil : le pro doit pouvoir traiter quatre demandes
           d'affilée sans défiler entre chacune. */
        <div key={b.id} className="crd !gap-2.5">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
          >
            <Avatar name={b.clientName} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1rem] font-semibold">{b.clientName}</span>
              <span className="block truncate text-[0.857rem] text-muted">
                {b.serviceName} · {formatDA(b.priceDa)}
                {b.staff ? ` · ${b.staff.displayName}` : ''}
              </span>
            </span>
            <span className="flex-none text-right">
              <span className="block text-[1rem] font-semibold">{formatTimeDZ(b.startsAt)}</span>
              <span className="block text-[0.857rem] text-muted">
                {formatDateShortDZ(b.startsAt)}
              </span>
            </span>
          </button>
          <div className="g3">
            <Button
              variant="ok"
              sm
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
            >
              Confirmer
            </Button>
            <Button
              variant="g"
              sm
              onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}
            >
              Reporter
            </Button>
            <Button
              variant="d"
              sm
              onClick={() => setRefusing({ id: b.id, clientName: b.clientName })}
            >
              Refuser
            </Button>
          </div>
        </div>
      ))}
      <ErrorMessage error={setStatus.error} />

      {next.isPending && <Skeleton className="h-[10rem] w-full !rounded-[1.25rem]" />}
      {next.isError && <ErrorMessage error={next.error} retry={() => next.refetch()} />}
      {days.map(([key, list]) => (
        <div key={key} className="flex flex-col gap-3">
          <SectionLabel right={<span className="s">{list.length}</span>}>
            {relativeDayLabelDZ(key, today)}
          </SectionLabel>
          <div className="crd !gap-0 !py-1">
            {list.map((b) => (
              <button
                key={b.id}
                type="button"
                className="li w-full text-left"
                onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="mono w-[4.25rem] flex-none text-[1.429rem] font-bold tracking-[-0.5px]">
                    {formatTimeDZ(b.startsAt)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[1.143rem] font-bold tracking-[-0.3px]">
                      {b.clientName}
                    </span>
                    <span className="block text-[1rem] text-muted">
                      {b.serviceName} · {formatDuration(b.durationMinutes)}
                      {b.staff?.displayName ? ` · ${b.staff.displayName}` : ''}
                    </span>
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[1rem] font-bold">{formatDA(b.priceDa)}</span>
                  <StatusBadge status={b.status} />
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {next.data && !items.length && !days.length && (
        <EmptyState
          title="Aucun rendez-vous à venir"
          action={
            <Button onClick={() => navigate('/pro/rendez-vous/nouveau')}>
              <I icon={Plus} size={18} /> Nouveau rendez-vous
            </Button>
          }
        />
      )}

      {refusing && <RefuseRequestSheet request={refusing} onClose={() => setRefusing(null)} />}
    </Screen>
  );
}
