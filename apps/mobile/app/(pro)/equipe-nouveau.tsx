/** Espace pro — Nouveau membre (page dédiée) : prénom, prestations réalisées (toutes ou une sélection). */
import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProSalon, useProStaffMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { Alert, BottomSheet, Button, Field, H1, Input, P, TopBar } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { ServicesPicker } from './equipe';

export default function TeamNew() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { create } = useProStaffMutations();
  const [name, setName] = useState('');
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const activeServices = useMemo(() => (salon?.services ?? []).filter((s) => s.isActive), [salon?.services]);
  if (!salon) return <Splash />;
  const invalid = !name.trim() || (!all && selected.length === 0 && activeServices.length > 0);

  const add = async () => {
    if (invalid) return;
    setError(null);
    try {
      await create.mutateAsync({ displayName: name.trim(), allServices: all, serviceIds: all ? [] : selected });
      if (router.canGoBack()) router.back();
      else router.replace('/equipe');
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={13}
      footer={
        <BottomSheet grab={false}>
          <Button onPress={() => void add()} disabled={create.isPending || invalid} loading={create.isPending}>
            Ajouter le membre
          </Button>
        </BottomSheet>
      }
    >
      <TopBar backTo="/equipe" right="Équipe" />
      <H1>Nouveau membre</H1>
      <P>Agenda propre, horaires du salon — modifiables ensuite dans sa fiche.</P>
      <Field label="Prénom">
        <Input lg value={name} onChangeText={setName} onSubmitEditing={() => void add()} placeholder="Prénom du membre" accessibilityLabel="Nouveau membre" maxLength={60} returnKeyType="done" autoFocus />
      </Field>
      <ServicesPicker services={activeServices} all={all} selected={selected} onAll={setAll} onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
