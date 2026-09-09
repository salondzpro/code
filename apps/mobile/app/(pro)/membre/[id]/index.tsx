/** Espace pro — Fiche d'un membre : activation, accès aux pages Prestations et Horaires, retrait. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronRight, Clock, Scissors } from 'lucide-react-native';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, formatDayRanges } from '@salondz/constants';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Avatar,
  Button,
  Card,
  H1,
  I,
  ListCard,
  P,
  Row,
  SectionLabel,
  Toggle,
  TopBar,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';
import { pickImages, uploadSalonImage } from '@/lib/images';

export default function TeamMember() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const member = salon?.staff.find((m) => m.id === id) ?? null;
  const hours = useStaffHours(id, !!member);
  const { update, remove } = useProStaffMutations();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const changeAvatar = async () => {
    if (!salon || !member) return;
    setError(null);
    try {
      const [img] = await pickImages({ square: true });
      if (!img) return;
      setAvatarBusy(true);
      const url = await uploadSalonImage(salon.id, img);
      await update.mutateAsync({ id: member.id, avatarUrl: url });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAvatarBusy(false);
    }
  };
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen gap={13}>
        <TopBar backTo="/(pro)/(tabs)/equipe" />
        <P>Membre introuvable.</P>
      </Screen>
    );
  const isOwner = member.userId === salon.ownerId;
  const servicesSummary = member.allServices
    ? 'Toutes les prestations'
    : `${member.serviceIds.length} prestation${member.serviceIds.length > 1 ? 's' : ''} sur ${salon.services.length}`;
  const days = new Set((hours.data ?? []).map((h) => h.dayOfWeek)).size;
  const hoursSummary = hours.isPending
    ? '…'
    : hours.data && hours.data.length > 0
      ? `Personnalisés · ${days} jour${days > 1 ? 's' : ''}`
      : 'Horaires du salon';

  return (
    <Screen gap={13}>
      <TopBar backTo="/(pro)/(tabs)/equipe" right="Équipe" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer la photo du membre"
          disabled={avatarBusy}
          onPress={() => void changeAvatar()}
        >
          <Avatar src={member.avatarUrl} name={member.displayName} size={52} />
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: C.ink,
              borderWidth: 2,
              borderColor: C.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <I icon={Camera} size={10} color={C.onInk} />
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <H1 size={18} lh={22} ls={-0.5} numberOfLines={1}>
            {member.displayName}
          </H1>
          <P>
            {avatarBusy
              ? 'Envoi de la photo…'
              : isOwner
                ? 'Propriétaire'
                : member.isActive
                  ? 'Membre actif'
                  : 'Inactif — masqué à la réservation'}
          </P>
          {!!member.avatarUrl && !avatarBusy && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                update.mutate(
                  { id: member.id, avatarUrl: null },
                  { onError: (e) => setError(errorText(e)) },
                )
              }
            >
              <Tx size={10} weight={600} color={C.danger} lh={13}>
                Retirer la photo
              </Tx>
            </Pressable>
          )}
        </View>
        {!isOwner && (
          <Toggle
            on={member.isActive}
            onChange={(v) =>
              update.mutate(
                { id: member.id, isActive: v },
                { onError: (e) => setError(errorText(e)) },
              )
            }
            label="Actif"
          />
        )}
      </View>

      <ListCard>
        <Row
          py={13}
          chevron={false}
          onPress={() => router.push(`/membre/${member.id}/prestations` as never)}
          accessibilityLabel="Prestations"
          right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: C.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <I icon={Scissors} size={14.5} />
            </View>
            <View>
              <Tx size={13} weight={600} lh={17}>
                Prestations
              </Tx>
              <P>{servicesSummary}</P>
            </View>
          </View>
        </Row>
        <Row
          py={13}
          chevron={false}
          onPress={() => router.push(`/membre/${member.id}/horaires` as never)}
          accessibilityLabel="Horaires"
          right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: C.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <I icon={Clock} size={14.5} />
            </View>
            <View>
              <Tx size={13} weight={600} lh={17}>
                Horaires
              </Tx>
              <P>{hoursSummary}</P>
            </View>
          </View>
        </Row>
      </ListCard>

      {hours.data && hours.data.length > 0 && (
        <Card gap={4}>
          <SectionLabel>Semaine du membre</SectionLabel>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const ranges = hours.data
              .filter((h) => h.dayOfWeek === d)
              .map((h) => ({ start: h.startsAt, end: h.endsAt }));
            return (
              <View key={d} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Tx size={11.5} lh={15} color={ranges.length ? C.text : C.subtle}>
                  {DAY_LABELS_SHORT_FR[d as 0]}
                </Tx>
                <Tx size={11.5} lh={15} color={C.muted}>
                  {formatDayRanges(ranges, 'Repos')}
                </Tx>
              </View>
            );
          })}
        </Card>
      )}

      {error && <Alert>{error}</Alert>}
      {!isOwner &&
        (confirmRemove ? (
          <Button
            bg={C.danger}
            textColor="#fff"
            disabled={remove.isPending}
            onPress={async () => {
              try {
                await remove.mutateAsync(member.id);
                router.replace('/(pro)/(tabs)/equipe');
              } catch (err) {
                setError(errorText(err));
              }
            }}
          >
            Confirmer le retrait
          </Button>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmRemove(true)}
            style={{ alignSelf: 'center', paddingVertical: 6 }}
          >
            <Tx size={11.5} color={C.danger} lh={15}>
              Retirer de l'équipe
            </Tx>
          </Pressable>
        ))}
    </Screen>
  );
}
