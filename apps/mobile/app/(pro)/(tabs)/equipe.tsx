/**
 * Espace pro — Équipe : liste des membres ; chaque ligne ouvre la fiche du membre (page dédiée), qui mène
 * aux pages Prestations et Horaires. « Ajouter un membre » ouvre la page de création.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useProSalon } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import type { Service, Staff } from '@salondz/types';
import { Alert, Avatar, Button, Checkbox, H1, I, ListCard, P, Row, Segmented, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD } from '@/theme/design';

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

export default function Team() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  if (!salon) return <Splash />;

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
          <Row key={m.id} py={13} onPress={() => router.push(`/membre/${m.id}` as never)} accessibilityLabel={m.displayName} chevron={false} right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}>
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
    </Screen>
  );
}
