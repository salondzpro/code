/**
 * Refus d'une demande de rendez-vous par le salon, motif facultatif.
 *
 * Une seule feuille pour l'accueil et pour Réservations : le professionnel doit pouvoir
 * confirmer, reporter ou refuser partout où une demande lui est présentée, et la formulation
 * comme le comportement ne doivent exister qu'à un seul endroit.
 */
import { useState } from 'react';
import { useProBookingMutations } from '@salondz/api-client';
import { ErrorMessage } from './ErrorMessage';
import { BottomSheet, Button, Input } from './ui';

export interface RefusedRequest {
  id: string;
  clientName: string;
}

export function RefuseRequestSheet({
  request,
  onClose,
}: {
  request: RefusedRequest;
  onClose: () => void;
}) {
  const { cancel } = useProBookingMutations();
  const [reason, setReason] = useState('');
  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet className="!z-50">
        <div className="text-center">
          <div className="text-[1.25rem] font-bold tracking-[-0.4px]">Refuser cette demande ?</div>
          <p className="p mt-2">{request.clientName} sera prévenu·e et le créneau sera libéré.</p>
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
        <ErrorMessage error={cancel.error} />
        <Button
          className="!bg-danger !text-white"
          disabled={cancel.isPending}
          onClick={async () => {
            await cancel.mutateAsync({ id: request.id, reason: reason.trim() || undefined });
            onClose();
          }}
        >
          Refuser la demande
        </Button>
        <Button variant="g" onClick={onClose}>
          Garder
        </Button>
      </BottomSheet>
    </>
  );
}
