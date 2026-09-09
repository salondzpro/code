/** Espace pro — Nouveau membre (page dédiée) : prénom, prestations réalisées (toutes ou une sélection). */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProSalon, useProStaffMutations } from '@salondz/api-client';
import { errorText } from '@/components/ErrorMessage';
import { Button, Field, Input, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { BottomSheet } from '@/components/ui';
import { Splash } from '@/pages/auth/Splash';
import { ServicesPicker } from './Team';

export function TeamNew() {
  const navigate = useNavigate();
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
      navigate('/pro/equipe', { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <TopBar backTo="/pro/equipe" right="Équipe" />
      <h1 className="h1">Nouveau membre</h1>
      <p className="p">Le membre a son propre agenda. Il reçoit les rendez-vous des prestations qu'il réalise, sur les horaires du salon (modifiables ensuite dans sa fiche).</p>
      <Field label="Prénom" htmlFor="staff-name">
        <Input
          id="staff-name"
          lg
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
          placeholder="Prénom du membre"
          aria-label="Nouveau membre"
          maxLength={60}
          autoFocus
        />
      </Field>
      <ServicesPicker services={activeServices} all={all} selected={selected} onAll={setAll} onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))} />
      {error && (
        <p className="text-[0.875rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <BottomSheet grab={false}>
        <Button onClick={() => void add()} disabled={create.isPending || invalid}>
          {create.isPending ? 'Ajout…' : 'Ajouter le membre'}
        </Button>
      </BottomSheet>
    </Screen>
  );
}
