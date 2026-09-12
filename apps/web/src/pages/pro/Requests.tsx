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
import {
  Avatar,
  BottomSheet,
  Button,
  EmptyState,
  I,
  Input,
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
  const { setStatus, cancel } = useProBookingMutations();
  const [refusing, setRefusing] = useState<{ id: string; clientName: string } | null>(null);
  const [reason, setReason] = useState('');
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
        <div key={b.id} className="crd !gap-4">
          <button
            type="button"
            className="flex items-center gap-3.5 text-left"
            onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
          >
            <Avatar name={b.clientName} size={68} />
            <span className="min-w-0">
              <span className="block truncate text-[1.25rem] font-bold tracking-[-0.4px]">
                {b.clientName}
              </span>
              <span className="block text-[0.8125rem] text-muted">
                {b.serviceName} · {formatDateShortDZ(b.startsAt)} {formatTimeDZ(b.startsAt)} ·{' '}
                {formatDA(b.priceDa)}
              </span>
              {b.staff && (
                <span className="block text-[0.9375rem] text-muted">
                  avec {b.staff.displayName}
                </span>
              )}
            </span>
          </button>
          <div className="g2">
            <Button
              sm
              className="!py-[1.125rem] !text-[0.875rem]"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
            >
              Confirmer
            </Button>
            <Button
              variant="g"
              sm
              className="!py-[1.125rem] !text-[0.875rem]"
              onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}
            >
              Reporter
            </Button>
          </div>
          <button
            type="button"
            className="text-[0.8125rem] text-danger"
            onClick={() => setRefusing({ id: b.id, clientName: b.clientName })}
          >
            Refuser la demande
          </button>
        </div>
      ))}
      <ErrorMessage error={setStatus.error ?? cancel.error} />

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
                className="li w-full !py-4 text-left"
                onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="mono w-[4.25rem] flex-none text-[1.25rem] font-bold tracking-[-0.5px]">
                    {formatTimeDZ(b.startsAt)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[1.125rem] font-bold tracking-[-0.3px]">
                      {b.clientName}
                    </span>
                    <span className="block text-[0.9375rem] text-muted">
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

      {refusing && (
        <>
          <div className="dim" onClick={() => setRefusing(null)} />
          <BottomSheet className="!z-50">
            <div className="text-center">
              <div className="text-[1.25rem] font-bold tracking-[-0.4px]">
                Refuser cette demande ?
              </div>
              <p className="p mt-2">
                {refusing.clientName} sera prévenu·e et le créneau sera libéré.
              </p>
            </div>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[0.9375rem]">Motif (optionnel)</span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Complet"
                className="!w-auto !bg-transparent !p-0 text-right"
                maxLength={200}
                aria-label="Motif"
              />
            </div>
            <Button
              className="!bg-danger !text-white"
              disabled={cancel.isPending}
              onClick={async () => {
                await cancel.mutateAsync({ id: refusing.id, reason: reason.trim() || undefined });
                setRefusing(null);
                setReason('');
              }}
            >
              Refuser la demande
            </Button>
            <Button variant="g" onClick={() => setRefusing(null)}>
              Garder
            </Button>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
