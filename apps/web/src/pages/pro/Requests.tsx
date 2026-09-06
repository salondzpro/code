/** Demandes en attente (validation manuelle) — cartes « À valider » du design PRO-F 22, avec refus motivé. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useProBookingMutations, useProPendingBookings } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Avatar, BottomSheet, Button, EmptyState, Input, Skeleton, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function Requests() {
  const navigate = useNavigate();
  const pending = useProPendingBookings();
  const { setStatus, cancel } = useProBookingMutations();
  const [refusing, setRefusing] = useState<{ id: string; clientName: string } | null>(null);
  const [reason, setReason] = useState('');
  const items = pending.data?.items ?? [];

  return (
    <Screen bottom={40} gap={16}>
      <TopBar backTo="/pro" right="À valider" />
      <h1 className="h1">Demandes</h1>
      {pending.isPending && <Skeleton className="h-[160px]" />}
      {pending.isError && <ErrorMessage error={pending.error} retry={() => pending.refetch()} />}
      {pending.data && items.length === 0 && <EmptyState title="Tout est à jour" description="Aucune demande à confirmer." />}
      {items.map((b) => (
        <div key={b.id} className="crd !gap-4">
          <button type="button" className="flex items-center gap-3.5 text-left" onClick={() => navigate(`/pro/rendez-vous/${b.id}`)}>
            <Avatar name={b.clientName} size={68} />
            <span className="min-w-0">
              <span className="block truncate text-[24px] font-bold tracking-[-0.4px]">{b.clientName}</span>
              <span className="block text-[17px] text-muted">
                {b.serviceName} · {formatDateShortDZ(b.startsAt)} {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
              </span>
              {b.staff && <span className="block text-[15px] text-muted">avec {b.staff.displayName}</span>}
            </span>
          </button>
          <div className="g2">
            <Button sm className="!py-[18px] !text-[18px]" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
              Confirmer
            </Button>
            <Button variant="g" sm className="!py-[18px] !text-[18px]" onClick={() => navigate(`/pro/rendez-vous/${b.id}/reporter`)}>
              Reporter
            </Button>
          </div>
          <button type="button" className="text-[17px] text-danger" onClick={() => setRefusing({ id: b.id, clientName: b.clientName })}>
            Refuser la demande
          </button>
        </div>
      ))}
      <ErrorMessage error={setStatus.error ?? cancel.error} />

      {refusing && (
        <>
          <div className="dim" onClick={() => setRefusing(null)} />
          <BottomSheet className="!z-50">
            <div className="text-center">
              <div className="text-[24px] font-bold tracking-[-0.4px]">Refuser cette demande ?</div>
              <p className="p mt-2">{refusing.clientName} sera prévenu·e et le créneau sera libéré.</p>
            </div>
            <div className="crd !flex-row items-center justify-between !py-3">
              <span className="text-[19px]">Motif (optionnel)</span>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Complet" className="!w-auto !bg-transparent !p-0 text-right" maxLength={200} aria-label="Motif" />
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
