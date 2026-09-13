/**
 * Refus d'une demande de rendez-vous par le salon, motif facultatif.
 *
 * Une seule feuille pour l'accueil et pour Réservations : le professionnel doit pouvoir
 * confirmer, reporter ou refuser partout où une demande lui est présentée, et la formulation
 * comme le comportement ne doivent exister qu'à un seul endroit.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useProBookingMutations } from '@salondz/api-client';
import { REFUSAL_REASONS_FR } from '@salondz/constants';
import { C } from '@/theme/design';
import { Button, ErrorText, ModalSheet, P, Tx } from './index';
import { ReasonField } from './ReasonField';

export interface RefusedRequest {
  id: string;
  clientName: string;
}

export function RefuseRequestSheet({
  request,
  onClose,
}: {
  request: RefusedRequest | null;
  onClose: () => void;
}) {
  const { cancel } = useProBookingMutations();
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <ModalSheet open={!!request} onClose={close}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Tx size={16} weight={700} ls={-0.4} lh={20.5} center>
          Refuser cette demande ?
        </Tx>
        <P center>{request?.clientName} sera prévenu·e et le créneau sera libéré.</P>
      </View>
      <ReasonField
        reasons={REFUSAL_REASONS_FR}
        value={reason}
        onChange={setReason}
        title="Pourquoi refuser ?"
      />
      <ErrorText error={cancel.error} />
      <Button
        bg={C.danger}
        textColor="#fff"
        disabled={cancel.isPending}
        loading={cancel.isPending}
        onPress={async () => {
          if (!request) return;
          await cancel.mutateAsync({ id: request.id, reason: reason || undefined });
          close();
        }}
      >
        Refuser la demande
      </Button>
      <Button variant="g" onPress={close}>
        Garder
      </Button>
    </ModalSheet>
  );
}
