/**
 * Espace pro — Équipe : membres, activation, prestations affectées et horaires propres (feuille au design).
 * Prestations : « toutes » par défaut, ou une sélection — le membre n'est proposé que pour ce qu'il réalise (SQL).
 * Horaires : liste vide côté API = « suit le salon » ; sinon plages par jour avec pause facultative.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useProSalon, useProStaffMutations, useStaffHours } from '@salondz/api-client';
import { formatDA, rangesFromRows, rowError, rowsFromRanges, type DayHoursRow } from '@salondz/constants';
import type { OpeningHour, Service, Staff } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, Avatar, Button, Checkbox, H1, I, ListCard, ModalSheet, P, Row, Segmented, Skeleton, Toggle, Tx } from '@/ui';
import { WeekHoursEditor } from '@/ui/WeekHours';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

const salonRanges = (hours: OpeningHour[]) => hours.filter((h) => !h.isClosed).map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.opensAt, end: h.closesAt }));

export function ServicesPicker({ services, all, selected, onAll, onToggle }: { services: Service[]; all: boolean; selected: string[]; onAll: (v: boolean) => void; onToggle: (id: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Segmented
        label="Prestations"
        value={all ? 'all' : 'some'}
        onChange={(v) => onAll(v === 'all')}
        options={[
          { value: 'all', label: 'Toutes les prestations' },
          { value: 'some', label: 'Sélection' },
        ]}
      />
      {all ? (
        <P>Ce membre réalise toutes les prestations du catalogue, y compris celles ajoutées plus tard.</P>
      ) : services.length === 0 ? (
        <P>Aucune prestation au catalogue pour l'instant.</P>
      ) : (
        <ListCard>
          {services.map((sv) => (
            <Row key={sv.id} py={10} chevron={false} onPress={() => onToggle(sv.id)} accessibilityLabel={sv.name} right={<Checkbox on={selected.includes(sv.id)} label={sv.name} />}>
              <View>
                <Tx size={12} lh={16} color={sv.isActive ? C.text : C.subtle}>
                  {sv.name}
                </Tx>
                <Tx size={10.5} color={C.muted} lh={14}>
                  {sv.durationMinutes} min · {formatDA(sv.priceDa)}
                  {sv.groupName ? ` · ${sv.groupName}` : ''}
                </Tx>
              </View>
            </Row>
          ))}
        </ListCard>
      )}
      {!all && selected.length === 0 && services.length > 0 && <Alert>Choisissez au moins une prestation, sinon le membre ne sera jamais proposé.</Alert>}
    </View>
  );
}

function MemberSheet({ member, salon, onClose }: { member: Staff; salon: { ownerId: string; openingHours: OpeningHour[]; services: Service[] }; onClose: () => void }) {
  const hours = useStaffHours(member.id);
  const { update, remove, setHours } = useProStaffMutations();
  const [tab, setTab] = useState<'services' | 'hours'>('services');
  const [all, setAll] = useState(member.allServices);
  const [selected, setSelected] = useState<string[]>(member.serviceIds);
  const [custom, setCustom] = useState(false);
  const [rows, setRows] = useState<DayHoursRow[]>(() => rowsFromRanges([], salonRanges(salon.openingHours)).map((r) => ({ ...r, open: salon.openingHours.some((h) => h.dayOfWeek === r.dayOfWeek && !h.isClosed) })));
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isOwner = member.userId === salon.ownerId;
  const seeded = useRef(false);

  useEffect(() => {
    if (!hours.data || seeded.current) return;
    seeded.current = true;
    if (hours.data.length === 0) return setCustom(false);
    setCustom(true);
    setRows(rowsFromRanges(hours.data.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startsAt, end: h.endsAt })), salonRanges(salon.openingHours)));
  }, [hours.data, salon.openingHours]);

  const invalidHours = custom && rows.some((r) => rowError(r) !== null);
  const invalidServices = !all && selected.length === 0 && salon.services.length > 0;
  const busy = setHours.isPending || update.isPending;

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: member.id, allServices: all, serviceIds: all ? [] : selected });
      await setHours.mutateAsync({ id: member.id, hours: custom ? rangesFromRows(rows).map((r) => ({ dayOfWeek: r.dayOfWeek, startsAt: r.start, endsAt: r.end })) : [] });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <ModalSheet open onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar src={member.avatarUrl} name={member.displayName} size={45.5} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} numberOfLines={1}>
            {member.displayName}
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            {isOwner ? 'Propriétaire' : member.isActive ? 'Membre actif' : 'Inactif — masqué à la réservation'}
          </Tx>
        </View>
        {!isOwner && <Toggle on={member.isActive} onChange={(v) => update.mutate({ id: member.id, isActive: v }, { onError: (e) => setError(errorText(e)) })} label="Actif" />}
      </View>
      <Segmented
        label="Réglages du membre"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'services', label: `Prestations${all ? '' : ` (${selected.length})`}` },
          { value: 'hours', label: 'Horaires' },
        ]}
      />
      {tab === 'services' ? (
        <ServicesPicker services={salon.services} all={all} selected={selected} onAll={setAll} onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
      ) : (
        <>
          <Segmented
            label="Horaires"
            value={custom ? 'custom' : 'salon'}
            onChange={(v) => setCustom(v === 'custom')}
            options={[
              { value: 'salon', label: 'Horaires du salon' },
              { value: 'custom', label: 'Horaires personnalisés' },
            ]}
          />
          {hours.isPending ? <Skeleton h={98} /> : custom ? <WeekHoursEditor rows={rows} onChange={setRows} closedLabel="Repos" /> : <P>Ce membre est réservable sur tous les horaires d'ouverture du salon.</P>}
        </>
      )}
      {error && <Alert>{error}</Alert>}
      <Button onPress={() => void save()} disabled={busy || invalidHours || invalidServices || hours.isPending} loading={busy}>
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
          <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(true)} style={{ alignSelf: 'center', paddingVertical: 6 }}>
            <Tx size={10.5} color={C.danger} lh={14.5}>
              Retirer de l'équipe
            </Tx>
          </Pressable>
        ))}
    </ModalSheet>
  );
}

export default function Team() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const member = salon.staff.find((m) => m.id === open) ?? null;

  const summary = (m: Staff) => {
    const state = m.isActive ? 'Actif' : 'Inactif';
    if (m.allServices) return `${state} · toutes les prestations`;
    return `${state} · ${m.serviceIds.length} prestation${m.serviceIds.length > 1 ? 's' : ''}`;
  };

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <H1 size={23} lh={26} ls={-0.8}>
        Équipe
      </H1>
      <P>Chaque membre a son agenda, ses prestations et ses horaires. Les clients choisissent « n'importe qui » ou un membre précis.</P>
      <ListCard>
        {salon.staff.map((m) => (
          <Row key={m.id} py={13} onPress={() => setOpen(m.id)} accessibilityLabel={m.displayName} chevron={false} right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar src={m.avatarUrl} name={m.displayName} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={12} lh={16} numberOfLines={1}>
                  {m.displayName}
                  {m.userId === salon.ownerId ? (
                    <Tx size={12} lh={16} color={C.muted}>
                      {' '}
                      (vous)
                    </Tx>
                  ) : null}
                </Tx>
                <Tx size={12} color={C.muted} lh={16}>
                  {summary(m)}
                </Tx>
              </View>
            </View>
          </Row>
        ))}
      </ListCard>
      <Button onPress={() => router.push('/equipe-nouveau' as never)}>
        <I icon={Plus} size={14.5} color="#fff" />
        <Tx size={12} weight={600} color="#fff" lh={16}>
          Ajouter un membre
        </Tx>
      </Button>
      {error && <Alert>{error}</Alert>}
      {member && <MemberSheet member={member} salon={salon} onClose={() => setOpen(null)} />}
    </Screen>
  );
}
