/** Demandes en attente (validation manuelle) — cartes « À valider » du design PRO-F 22, avec refus motivé. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useProBookingMutations, useProPendingBookings } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { Avatar, Button, Card, EmptyState, ErrorText, Grid, H1, Input, ModalSheet, P, Skeleton, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

export default function Requests() {
  const router = useRouter();
  const pending = useProPendingBookings();
  const { setStatus, cancel } = useProBookingMutations();
  const [refusing, setRefusing] = useState<{ id: string; clientName: string } | null>(null);
  const [reason, setReason] = useState('');
  const items = pending.data?.items ?? [];

  return (
    <Screen gap={13} bottom={32}>
      <TopBar backTo="/(pro)/(tabs)" right="À valider" />
      <H1>Demandes</H1>
      {pending.isPending && <Skeleton h={130} radius={16} />}
      {pending.isError && <ErrorText error={pending.error} retry={() => void pending.refetch()} />}
      {pending.data && items.length === 0 && <EmptyState title="Tout est à jour" description="Aucune demande à confirmer." />}
      {items.map((b) => (
        <Card key={b.id} gap={13}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/pro-rdv/${b.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <Avatar name={b.clientName} size={55} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={16} weight={700} ls={-0.4} lh={20.5} numberOfLines={1}>
                {b.clientName}
              </Tx>
              <Tx size={10.5} color={C.muted} lh={15.5}>
                {b.serviceName} · {formatDateShortDZ(b.startsAt)} {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
              </Tx>
              {b.staff && (
                <Tx size={12} color={C.muted} lh={16}>
                  avec {b.staff.displayName}
                </Tx>
              )}
            </View>
          </Pressable>
          <Grid cols={2}>
            <Button sm style={{ paddingVertical: 15 }} disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
              <Tx size={11.5} weight={600} color="#fff" ls={-0.2}>
                Confirmer
              </Tx>
            </Button>
            <Button variant="g" sm style={{ paddingVertical: 15 }} onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}>
              <Tx size={11.5} weight={600} ls={-0.2}>
                Reporter
              </Tx>
            </Button>
          </Grid>
          <Pressable accessibilityRole="button" onPress={() => setRefusing({ id: b.id, clientName: b.clientName })} style={{ alignSelf: 'center' }}>
            <Tx size={10.5} color={C.danger} lh={14.5}>
              Refuser la demande
            </Tx>
          </Pressable>
        </Card>
      ))}
      <ErrorText error={setStatus.error ?? cancel.error} />

      <ModalSheet open={!!refusing} onClose={() => setRefusing(null)}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Tx size={16} weight={700} ls={-0.4} lh={20.5} center>
            Refuser cette demande ?
          </Tx>
          <P center>{refusing?.clientName} sera prévenu·e et le créneau sera libéré.</P>
        </View>
        <Card row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
          <Tx size={12} lh={16}>
            Motif (optionnel)
          </Tx>
          <Input value={reason} onChangeText={setReason} placeholder="Complet" maxLength={200} accessibilityLabel="Motif" style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 12 }} />
        </Card>
        <Button
          bg={C.danger}
          textColor="#fff"
          disabled={cancel.isPending}
          loading={cancel.isPending}
          onPress={async () => {
            if (!refusing) return;
            await cancel.mutateAsync({ id: refusing.id, reason: reason.trim() || undefined });
            setRefusing(null);
            setReason('');
          }}
        >
          Refuser la demande
        </Button>
        <Button variant="g" onPress={() => setRefusing(null)}>
          Garder
        </Button>
      </ModalSheet>
    </Screen>
  );
}
