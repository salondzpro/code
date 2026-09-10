/** Espace pro — Prestations d'un membre (page dédiée) : toutes ou une sélection. */
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProSalon, useProStaffMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { Alert, BottomSheet, Button, H1, P, TopBar } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ServicesPicker } from '../../equipe';

export default function TeamMemberServices() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const member = salon?.staff.find((m) => m.id === id) ?? null;
  const { update } = useProStaffMutations();
  const [all, setAll] = useState(member?.allServices ?? true);
  const [selected, setSelected] = useState<string[]>(member?.serviceIds ?? []);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  if (!member)
    return (
      <Screen gap={13}>
        <TopBar backTo="/equipe" />
        <P>Membre introuvable.</P>
      </Screen>
    );
  const invalid = !all && selected.length === 0 && salon.services.length > 0;
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/membre/${member.id}` as never));
  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id: member.id, allServices: all, serviceIds: all ? [] : selected });
      back();
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet grab={false}>
          <Button onPress={() => void save()} disabled={update.isPending || invalid} loading={update.isPending}>
            Enregistrer
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/membre/${member.id}`} right={member.displayName} />
      <H1>Prestations</H1>
      <P>Le membre n'est proposé aux clients que pour les prestations qu'il réalise.</P>
      <ServicesPicker services={salon.services} all={all} selected={selected} onAll={setAll} onToggle={(sid) => setSelected((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]))} />
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
