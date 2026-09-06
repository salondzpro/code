/** PRO-F 08 — Étape 6 : première prestation (nom, prix, durée, catégorie, description) → photos. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { CATEGORY_BY_ID, categoriesForMarket, type CategoryId } from '@salondz/constants';
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

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

export function Step6Service({ serviceId }: { serviceId?: string }) {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { create, update } = useProServiceMutations();
  const existing = serviceId ? salon?.services.find((s) => s.id === serviceId) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? String(existing.priceDa) : '');
  const [duration, setDuration] = useState(existing?.durationMinutes ?? 45);
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [catSheet, setCatSheet] = useState(false);

  if (!salon) return <Splash />;
  if (serviceId && !existing) return <Redirect href={stepPath(6) as never} />;
  const market = salon.genderTarget === 'men' ? 'men' : 'women';
  const cats = categoriesForMarket(market).filter((c) => salon.categoryIds.includes(c.id));
  const first = salon.services.length === 0;
  const catLabel = categoryId ? (cats.find((c) => c.id === categoryId)?.labelFr ?? CATEGORY_BY_ID.get(categoryId)?.labelFr ?? categoryId) : 'Sans catégorie';

  const submit = async () => {
    const parsed = createServiceSchema.safeParse({ name, durationMinutes: duration, priceDa: Number(price.replace(/\D/g, '')), categoryId: (categoryId || null) as CategoryId | null, description: description.trim() || undefined, isActive: true });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Vérifiez les champs.');
    setError(null);
    try {
      const svc = existing ? await update.mutateAsync({ id: existing.id, ...parsed.data }) : await create.mutateAsync(parsed.data);
      router.push(`${stepPath(7)}/${svc.id}` as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16} footer={<StepSheet label="Ajouter des photos" onPress={() => void submit()} busy={create.isPending || update.isPending} disabled={!name.trim() || !price} />}>
      <StepBar step={6} backTo={first ? stepPath(5) : '/(pro)/(tabs)/prestations'} />
      <H1>{existing ? 'Modifier la prestation' : first ? 'Première prestation' : 'Nouvelle prestation'}</H1>
      <Field label="Nom">
        <Input lg f={!!name} value={name} onChangeText={setName} maxLength={80} placeholder="Pose gel" autoFocus accessibilityLabel="Nom" />
      </Field>
      <Grid cols={2}>
        <Field label="Prix">
          <View>
            <Input lg keyboardType="number-pad" value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ''))} placeholder="2 500" accessibilityLabel="Prix" style={{ paddingRight: 48 }} />
            <Tx size={17} lh={22} style={{ position: 'absolute', right: 16, top: 18 }}>
              DA
            </Tx>
          </View>
        </Field>
        <Field label="Durée">
          <View style={{ backgroundColor: C.fill, borderRadius: R.input, paddingVertical: 18, paddingHorizontal: 16 }} accessibilityLabel="Durée">
            <Tx size={17} lh={22}>
              {formatDuration(duration)}
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
      <Field label="Catégorie">
        <Pressable_ label={catLabel} onPress={() => setCatSheet(true)} />
      </Field>
      <Field label="Description">
        <Input multiline value={description} onChangeText={setDescription} maxLength={500} placeholder="Pose complète en gel, limage, cuticules et finition brillante. Tenue 3 à 4 semaines." />
      </Field>
      {error && <Alert>{error}</Alert>}
      <PickerSheet open={catSheet} onClose={() => setCatSheet(false)} title="Catégorie" options={[{ value: '', label: 'Sans catégorie' }, ...cats.map((c) => ({ value: c.id as string, label: c.labelFr }))]} value={categoryId} onChange={setCategoryId} />
    </Screen>
  );
}

import { Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { I } from '@/ui';
function Pressable_({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Catégorie" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.fill, borderRadius: R.input, paddingVertical: 18, paddingHorizontal: 16 }}>
      <Tx size={17} lh={22}>
        {label}
      </Tx>
      <I icon={ChevronDown} size={18} color={C.subtle} />
    </Pressable>
  );
}
