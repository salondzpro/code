/** PRO-F 08 — Étape 6 : prestation (nom, prix, durée libre en minutes, groupe du catalogue créé librement, catégorie, description) → photos. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { CATEGORY_BY_ID, categoriesForSalon, type CategoryId } from '@salondz/constants';
import { createServiceSchema } from '@salondz/validation';
import { errorText } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import { stepPath } from '@/lib/proDraft';
import { Alert, Field, Grid, H1, Input, Pill, Tx } from '@/ui';
import { PickerSheet } from '@/ui/Pickers';
import { PillRow } from '@/ui/Pills';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C, R } from '@/theme/design';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

export function Step6Service({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { create, update } = useProServiceMutations();
  const existing = serviceId ? salon?.services.find((s) => s.id === serviceId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? String(existing.priceDa) : '');
  const [duration, setDuration] = useState(existing?.durationMinutes ?? 45);
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId ?? '');
  const [group, setGroup] = useState(existing?.groupName ?? '');
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [catSheet, setCatSheet] = useState(false);

  if (!salon) return <Splash />;
  if (serviceId && !existing) return <Redirect href={stepPath(6) as never} />;
  // Catégories Salon DZ : d'abord celles choisies par ce salon à l'inscription, puis les autres de son marché (les deux pour un salon unisexe).
  const { suggested, others } = categoriesForSalon(salon.genderTarget, salon.categoryIds);
  const cats = [...suggested, ...others];
  const first = salon.services.length === 0;
  // Groupes déjà utilisés dans le catalogue : proposés en puces, un nouveau nom crée un nouveau groupe.
  const groups = [
    ...new Set(salon.services.map((s) => s.groupName?.trim()).filter((g): g is string => !!g)),
  ];
  const pick = creating ? '__new__' : group ? `g:${group}` : categoryId ? `c:${categoryId}` : '';
  const catLabel = creating
    ? 'Nouvelle catégorie'
    : group
      ? group
      : categoryId
        ? (cats.find((c) => c.id === categoryId)?.labelFr ??
          CATEGORY_BY_ID.get(categoryId)?.labelFr ??
          categoryId)
        : 'Sans catégorie';

  const submit = async () => {
    const parsed = createServiceSchema.safeParse({
      name,
      durationMinutes: duration,
      priceDa: Number(price.replace(/\D/g, '')),
      categoryId: (categoryId || null) as CategoryId | null,
      groupName: group.trim() || null,
      description: description.trim() || undefined,
      isActive: true,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Vérifiez les champs.');
    setError(null);
    try {
      const svc = existing
        ? await update.mutateAsync({ id: existing.id, ...parsed.data })
        : await create.mutateAsync(parsed.data);
      router.push(`${stepPath(7)}/${svc.id}` as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen
      gap={13}
      footer={
        <StepSheet
          label="Ajouter une photo"
          onPress={() => void submit()}
          busy={create.isPending || update.isPending}
          disabled={!name.trim() || !price || duration < 5}
        />
      }
    >
      <StepBar step={6} backTo={first ? stepPath(5) : '/prestations'} />
      <H1>
        {existing
          ? 'Modifier la prestation'
          : first
            ? 'Première prestation'
            : 'Nouvelle prestation'}
      </H1>
      <Field label="Nom">
        <Input
          lg
          f={!!name}
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder="Pose gel"
          autoFocus
          accessibilityLabel="Nom"
        />
      </Field>
      <Grid cols={2}>
        <Field label="Prix">
          <View>
            <Input
              lg
              keyboardType="number-pad"
              value={price}
              onChangeText={(v) => setPrice(v.replace(/\D/g, ''))}
              placeholder="2 500"
              accessibilityLabel="Prix"
              style={{ paddingRight: 39 }}
            />
            <Tx size={10.5} lh={14.5} style={{ position: 'absolute', right: 13, top: 15 }}>
              DA
            </Tx>
          </View>
        </Field>
        <Field label="Durée (minutes)" hint={formatDuration(duration)}>
          <View>
            <Input
              lg
              keyboardType="number-pad"
              value={duration ? String(duration) : ''}
              onChangeText={(v) => setDuration(Math.min(480, Number(v.replace(/\D/g, '')) || 0))}
              placeholder="45"
              accessibilityLabel="Durée"
              style={{ paddingRight: 44 }}
            />
            <Tx size={10.5} lh={14.5} style={{ position: 'absolute', right: 13, top: 15 }}>
              min
            </Tx>
          </View>
        </Field>
      </Grid>
      <PillRow>
        {DURATIONS.map((d) => (
          <Pill key={d} lg on={duration === d} onPress={() => setDuration(d)}>
            {formatDuration(d)}
          </Pill>
        ))}
      </PillRow>
      <Field
        label="Catégorie"
        hint="Choisissez une catégorie Salon DZ ou créez la vôtre : elle classe la prestation sur votre profil."
      >
        <Pressable_ label={catLabel} onPress={() => setCatSheet(true)} />
        {creating && (
          <Input
            lg
            value={group}
            onChangeText={setGroup}
            maxLength={40}
            placeholder="Nom de la nouvelle catégorie (ex. Soins de la barbe)"
            accessibilityLabel="Nouvelle catégorie"
            autoFocus
            style={{ marginTop: 8 }}
          />
        )}
      </Field>
      <Field label="Description">
        <Input
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          placeholder="Pose complète en gel, limage, cuticules et finition brillante. Tenue 3 à 4 semaines."
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <PickerSheet
        open={catSheet}
        onClose={() => setCatSheet(false)}
        title="Catégorie"
        options={[
          { value: '', label: 'Sans catégorie' },
          ...groups.map((g) => ({ value: `g:${g}`, label: g, group: 'Mes catégories' })),
          ...suggested.map((c) => ({
            value: `c:${c.id}`,
            label: c.labelFr,
            group: 'Suggérées pour votre salon',
          })),
          ...others.map((c) => ({
            value: `c:${c.id}`,
            label: c.labelFr,
            group: 'Autres catégories Salon DZ',
          })),
        ]}
        value={pick}
        onChange={(v) => {
          setCreating(false);
          if (v.startsWith('g:')) {
            setGroup(v.slice(2));
            setCategoryId('');
          } else if (v.startsWith('c:')) {
            setCategoryId(v.slice(2));
            setGroup('');
          } else {
            setGroup('');
            setCategoryId('');
          }
        }}
        action={{
          label: 'Créer une nouvelle catégorie',
          onPress: () => {
            setCreating(true);
            setGroup('');
            setCategoryId('');
          },
        }}
      />
    </Screen>
  );
}

import { Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { I } from '@/ui';
function Pressable_({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Catégorie"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.fill,
        borderRadius: R.input,
        paddingVertical: 15,
        paddingHorizontal: 13,
      }}
    >
      <Tx size={10.5} lh={14.5}>
        {label}
      </Tx>
      <I icon={ChevronDown} size={14.5} color={C.subtle} />
    </Pressable>
  );
}
