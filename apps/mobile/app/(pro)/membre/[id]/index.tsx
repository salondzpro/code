/** Espace pro — Fiche d'un membre : activation, accès aux pages Prestations et Horaires, retrait. */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronRight, Clock, Phone, Save, Scissors } from 'lucide-react-native';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_SHORT_FR, formatDZPhone, formatDayRanges } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { open } from '@/lib/salon';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  H1,
  I,
  Input,
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
  // Identité modifiable sur place : nom affiché et téléphone (facultatif).
  const [name, setName] = useState(member?.displayName ?? '');
  const [phone, setPhone] = useState(member?.phone ? formatDZPhone(member.phone) : '');
  const [identErr, setIdentErr] = useState<{ name?: string; phone?: string }>({});
  const [identSaved, setIdentSaved] = useState(false);
  useEffect(() => {
    setName(member?.displayName ?? '');
    setPhone(member?.phone ? formatDZPhone(member.phone) : '');
  }, [member?.displayName, member?.phone]);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen gap={13}>
        <TopBar backTo="/equipe" />
        <P>Membre introuvable.</P>
      </Screen>
    );
  const isOwner = member.userId === salon.ownerId;
  const identDirty =
    name.trim() !== member.displayName ||
    (phone.trim() ? phone.trim() : '') !== (member.phone ? formatDZPhone(member.phone) : '');
  const saveIdentity = async () => {
    const errs: typeof identErr = {};
    if (name.trim().length < 2) errs.name = 'Indiquez le nom du membre.';
    let e164: string | null = null;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) errs.phone = 'Numéro invalide (ex : 05 51 23 45 67).';
      else e164 = parsed.data;
    }
    setIdentErr(errs);
    if (errs.name || errs.phone) return;
    setError(null);
    try {
      await update.mutateAsync({ id: member.id, displayName: name.trim(), phone: e164 });
      setIdentSaved(true);
      setTimeout(() => setIdentSaved(false), 1500);
    } catch (err) {
      setError(errorText(err));
    }
  };
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
      <TopBar backTo="/equipe" right="Équipe" />
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
          {!!member.phone && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Appeler ${member.displayName}`}
              onPress={() => void open(`tel:${member.phone}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <I icon={Phone} size={12} color={C.muted} />
              <Tx size={12} color={C.muted} lh={16}>
                {formatDZPhone(member.phone)}
              </Tx>
            </Pressable>
          )}
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

      {/* Identité : nom affiché aux clients + coordonnées (privées), modifiables sur place. */}
      <Card gap={10}>
        <SectionLabel>Identité</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field label="Nom affiché *" error={identErr.name}>
              <Input
                value={name}
                err={!!identErr.name}
                maxLength={60}
                onChangeText={(v) => {
                  setName(v);
                  if (identErr.name) setIdentErr((f) => ({ ...f, name: undefined }));
                }}
                placeholder="Prénom"
                accessibilityLabel="Nom affiché"
              />
            </Field>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field label="Téléphone (facultatif)" error={identErr.phone}>
              <Input
                value={phone}
                err={!!identErr.phone}
                keyboardType="phone-pad"
                onChangeText={(v) => {
                  setPhone(v);
                  if (identErr.phone) setIdentErr((f) => ({ ...f, phone: undefined }));
                }}
                placeholder="05 51 23 45 67"
                accessibilityLabel="Téléphone du membre"
              />
            </Field>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Tx size={10.5} color={C.muted} lh={14} style={{ flex: 1 }}>
            {identSaved ? 'Enregistré' : 'Le téléphone reste privé (jamais montré aux clients).'}
          </Tx>
          <Button
            auto
            sm
            onPress={() => void saveIdentity()}
            disabled={update.isPending || !identDirty}
            loading={update.isPending}
          >
            <I icon={Save} size={14} color={C.onInk} />
            <Tx size={11.5} weight={600} color={C.onInk} lh={15}>
              Enregistrer
            </Tx>
          </Button>
        </View>
      </Card>

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
                router.replace('/equipe');
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
