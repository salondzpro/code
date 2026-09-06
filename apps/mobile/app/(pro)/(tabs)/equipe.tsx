/**
 * Espace pro — Équipe : membres, activation et horaires propres (feuille au design).
 * Liste vide côté API = « suit les horaires du salon » ; créneaux = salon ∩ membre (calcul SQL).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { DAY_LABELS_FR, WEEK_DAYS, type DayOfWeek } from '@salondz/constants';
import type { OpeningHour, Staff } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, Avatar, Button, Card, H1, I, Input, ListCard, ModalSheet, P, Row, Segmented, Skeleton, Toggle, Tx } from '@/ui';
import { TimeField } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

interface RowT {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
}

function rowsFromSalon(salonHours: OpeningHour[]): RowT[] {
  return WEEK_DAYS.map((d) => {
    const h = salonHours.find((x) => x.dayOfWeek === d && !x.isClosed);
    return { dayOfWeek: d, enabled: !!h, startsAt: h?.opensAt ?? '09:00', endsAt: h?.closesAt ?? '19:00' };
  });
}

function MemberSheet({ member, salon, onClose }: { member: Staff; salon: { ownerId: string; openingHours: OpeningHour[] }; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { update, remove, setHours } = useProStaffMutations();
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<RowT[]>(() => rowsFromSalon(salon.openingHours));
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.userId === salon.ownerId;
  const seeded = useRef(false);

  useEffect(() => {
    if (!hours.data || seeded.current) return;
    seeded.current = true;
    if (hours.data.length === 0) {
      setCustom(false);
      setRows(rowsFromSalon(salon.openingHours));
      return;
    }
    setCustom(true);
    const base = rowsFromSalon(salon.openingHours);
    setRows(
      WEEK_DAYS.map((d) => {
        const h = hours.data.find((x) => x.dayOfWeek === d);
        const def = base.find((r) => r.dayOfWeek === d)!;
        return h ? { dayOfWeek: d, enabled: true, startsAt: h.startsAt, endsAt: h.endsAt } : { ...def, enabled: false };
      }),
    );
  }, [hours.data, salon.openingHours]);

  const patch = (d: DayOfWeek, p: Partial<RowT>) => setRows((prev) => prev.map((r) => (r.dayOfWeek === d ? { ...r, ...p } : r)));
  const invalid = custom && rows.some((r) => r.enabled && r.startsAt >= r.endsAt);

  const save = async () => {
    setError(null);
    try {
      await setHours.mutateAsync({ id: member.id, hours: custom ? rows.filter((r) => r.enabled).map(({ dayOfWeek, startsAt, endsAt }) => ({ dayOfWeek, startsAt, endsAt })) : [] });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ModalSheet open onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar src={member.avatarUrl} name={member.displayName} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={22} weight={700} ls={-0.4} lh={27} numberOfLines={1}>
            {member.displayName}
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            {isOwner ? 'Propriétaire' : member.isActive ? 'Membre actif' : 'Inactif — masqué à la réservation'}
          </Tx>
        </View>
        {!isOwner && <Toggle on={member.isActive} onChange={(v) => update.mutate({ id: member.id, isActive: v }, { onError: (e) => setError(errorText(e)) })} label="Actif" />}
      </View>
      <Segmented
        label="Horaires"
        value={custom ? 'custom' : 'salon'}
        onChange={(v) => setCustom(v === 'custom')}
        options={[
          { value: 'salon', label: 'Horaires du salon' },
          { value: 'custom', label: 'Horaires personnalisés' },
        ]}
      />
      {hours.isPending ? (
        <Skeleton h={120} />
      ) : custom ? (
        <ListCard>
          {rows.map((r) => (
            <Row key={r.dayOfWeek} py={12} chevron={false} right={<Toggle on={r.enabled} onChange={(v) => patch(r.dayOfWeek, { enabled: v })} label={DAY_LABELS_FR[r.dayOfWeek]} />}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Tx size={17} lh={22} color={r.enabled ? C.text : C.subtle} style={{ width: 96 }}>
                  {DAY_LABELS_FR[r.dayOfWeek]}
                </Tx>
                {r.enabled ? (
                  <>
                    <TimeField size={17} value={r.startsAt} onChange={(v) => patch(r.dayOfWeek, { startsAt: v })} label={`Début ${DAY_LABELS_FR[r.dayOfWeek]}`} step={30} />
                    <Tx size={17} color={C.muted} lh={22}>
                      {' '}
                      –{' '}
                    </Tx>
                    <TimeField size={17} value={r.endsAt} onChange={(v) => patch(r.dayOfWeek, { endsAt: v })} label={`Fin ${DAY_LABELS_FR[r.dayOfWeek]}`} step={30} />
                  </>
                ) : (
                  <Tx size={17} color={C.disabled} lh={22}>
                    Repos
                  </Tx>
                )}
              </View>
            </Row>
          ))}
        </ListCard>
      ) : (
        <P>Ce membre est réservable sur tous les horaires d'ouverture du salon.</P>
      )}
      {invalid && <Alert>L'heure de début doit précéder la fin.</Alert>}
      {error && <Alert>{error}</Alert>}
      <Button onPress={() => void save()} disabled={setHours.isPending || invalid || hours.isPending} loading={setHours.isPending}>
        Enregistrer
      </Button>
      {!isOwner &&
        (confirmRemove ? (
          <Button
            bg={C.danger}
            textColor="#fff"
            disabled={remove.isPending}
            onPress={async () => {
              try {
                await remove.mutateAsync(member.id);
                onClose();
              } catch (err) {
                setError(errorText(err));
              }
            }}
          >
            Confirmer le retrait
          </Button>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(true)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Tx size={17} color={C.danger} lh={22}>
              Retirer de l'équipe
            </Tx>
          </Pressable>
        ))}
    </ModalSheet>
  );
}

export default function Team() {
  const salon = useProSalon().data?.salon ?? null;
  const { create } = useProStaffMutations();
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const member = salon.staff.find((m) => m.id === open) ?? null;

  const add = async () => {
    if (name.trim().length < 1) return;
    setError(null);
    try {
      await create.mutateAsync({ displayName: name.trim() });
      setName('');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <H1 size={34} lh={38} ls={-0.8}>
        Équipe
      </H1>
      <P>Chaque membre a son propre agenda. Les clients choisissent « n'importe qui » ou un membre précis.</P>
      <ListCard>
        {salon.staff.map((m) => (
          <Row key={m.id} py={16} onPress={() => setOpen(m.id)} accessibilityLabel={m.displayName} chevron={false} right={<I icon={ChevronRight} size={18} color={C.disabled} />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar src={m.avatarUrl} name={m.displayName} size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={19} lh={24} numberOfLines={1}>
                  {m.displayName}
                  {m.userId === salon.ownerId ? (
                    <Tx size={19} lh={24} color={C.muted}>
                      {' '}
                      (vous)
                    </Tx>
                  ) : null}
                </Tx>
                <Tx size={15} color={C.muted} lh={20}>
                  {m.isActive ? 'Actif' : 'Inactif'}
                </Tx>
              </View>
            </View>
          </Row>
        ))}
      </ListCard>
      <Card gap={12}>
        <Input lg value={name} onChangeText={setName} onSubmitEditing={() => void add()} placeholder="Prénom du membre" accessibilityLabel="Nouveau membre" maxLength={60} returnKeyType="done" />
        <Button onPress={() => void add()} disabled={create.isPending || !name.trim()} loading={create.isPending}>
          Ajouter
        </Button>
      </Card>
      {error && <Alert>{error}</Alert>}
      {member && <MemberSheet member={member} salon={salon} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
