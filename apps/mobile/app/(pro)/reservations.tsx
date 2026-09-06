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
    <Screen gap={16} bottom={40}>
      <TopBar backTo="/(pro)/(tabs)" right="À valider" />
      <H1>Demandes</H1>
      {pending.isPending && <Skeleton h={160} radius={20} />}
      {pending.isError && <ErrorText error={pending.error} retry={() => void pending.refetch()} />}
      {pending.data && items.length === 0 && <EmptyState title="Tout est à jour" description="Aucune demande à confirmer." />}
      {items.map((b) => (
        <Card key={b.id} gap={16}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/pro-rdv/${b.id}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={b.clientName} size={68} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={24} weight={700} ls={-0.4} lh={29} numberOfLines={1}>
                {b.clientName}
              </Tx>
              <Tx size={17} color={C.muted} lh={23}>
                {b.serviceName} · {formatDateShortDZ(b.startsAt)} {formatTimeDZ(b.startsAt)} · {formatDA(b.priceDa)}
              </Tx>
              {b.staff && (
                <Tx size={15} color={C.muted} lh={20}>
                  avec {b.staff.displayName}
                </Tx>
              )}
            </View>
          </Pressable>
          <Grid cols={2}>
            <Button sm style={{ paddingVertical: 18 }} disabled={setStatus.isPending} onPress={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}>
              <Tx size={18} weight={600} color="#fff" ls={-0.2}>
                Confirmer
              </Tx>
            </Button>
            <Button variant="g" sm style={{ paddingVertical: 18 }} onPress={() => router.push(`/pro-rdv/${b.id}/reporter` as never)}>
              <Tx size={18} weight={600} ls={-0.2}>
                Reporter
              </Tx>
            </Button>
          </Grid>
          <Pressable accessibilityRole="button" onPress={() => setRefusing({ id: b.id, clientName: b.clientName })} style={{ alignSelf: 'center' }}>
            <Tx size={17} color={C.danger} lh={22}>
              Refuser la demande
            </Tx>
          </Pressable>
        </Card>
      ))}
      <ErrorText error={setStatus.error ?? cancel.error} />

      <ModalSheet open={!!refusing} onClose={() => setRefusing(null)}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Tx size={24} weight={700} ls={-0.4} lh={29} center>
            Refuser cette demande ?
          </Tx>
          <P center>{refusing?.clientName} sera prévenu·e et le créneau sera libéré.</P>
        </View>
        <Card row style={{ paddingVertical: 12, justifyContent: 'space-between' }}>
          <Tx size={19} lh={24}>
            Motif (optionnel)
          </Tx>
          <Input value={reason} onChangeText={setReason} placeholder="Complet" maxLength={200} accessibilityLabel="Motif" style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right', fontSize: 17 }} />
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
