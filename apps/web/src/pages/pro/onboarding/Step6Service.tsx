/** PRO-F 08 — Étape 6 : prestation (nom, prix, durée libre en minutes, groupe du catalogue créé librement, catégorie, description) → photos. */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { CATEGORY_BY_ID, categoriesForSalon, type CategoryId } from '@salondz/constants';
import { createServiceSchema } from '@salondz/validation';
import { formatDuration } from '@/lib/format';
import { errorText } from '@/components/ErrorMessage';
import { Field, Input, Pill, Textarea } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, stepPath } from './Shared';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

export function Step6Service() {
  const navigate = useNavigate();
  const { serviceId } = useParams();
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

  if (!salon) return <Splash />;
  if (serviceId && !existing) return <Navigate to={stepPath(6)} replace />;
  // Catégories Salon DZ : d'abord celles choisies par ce salon à l'inscription, puis les autres de son marché (les deux pour un salon unisexe).
  const { suggested, others } = categoriesForSalon(salon.genderTarget, salon.categoryIds);
  const cats = [...suggested, ...others];
  const first = salon.services.length === 0;
  // Groupes déjà utilisés dans le catalogue : proposés en saisie, un nouveau nom crée un nouveau groupe.
  const groups = [...new Set(salon.services.map((s) => s.groupName?.trim()).filter((g): g is string => !!g))];
  const pick = creating ? '__new__' : group ? `g:${group}` : categoryId ? `c:${categoryId}` : '';

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const parsed = createServiceSchema.safeParse({ name, durationMinutes: duration, priceDa: Number(price.replace(/\D/g, '')), categoryId: (categoryId || null) as CategoryId | null, groupName: group.trim() || null, description: description.trim() || undefined, isActive: true });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Vérifiez les champs.');
    setError(null);
    try {
      const svc = existing ? await update.mutateAsync({ id: existing.id, ...parsed.data }) : await create.mutateAsync(parsed.data);
      navigate(`${stepPath(7)}/${svc.id}`);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={6} backTo={first ? stepPath(4) : '/pro/catalogue'} />
      <h1 className="h1">{existing ? 'Modifier la prestation' : first ? 'Première prestation' : 'Nouvelle prestation'}</h1>
      <form id="service" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nom" htmlFor="svc-name">
          <Input id="svc-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Pose gel" autoFocus />
        </Field>
        <div className="g2">
          <Field label="Prix" htmlFor="svc-price">
            <div className="relative">
              <Input id="svc-price" lg inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="2 500" className="!pr-12" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.8125rem]">DA</span>
            </div>
          </Field>
          <Field label="Durée (minutes)" htmlFor="svc-duration" hint={formatDuration(duration)}>
            <div className="relative">
              <Input id="svc-duration" lg inputMode="numeric" value={String(duration || '')} onChange={(e) => setDuration(Math.min(480, Number(e.target.value.replace(/\D/g, '')) || 0))} placeholder="45" className="!pr-14" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.8125rem]">min</span>
            </div>
          </Field>
        </div>
        <div className="pills -mx-5 px-5" aria-label="Durées courantes">
          {DURATIONS.map((d) => (
            <Pill key={d} lg on={duration === d} onClick={() => setDuration(d)}>
              {formatDuration(d)}
            </Pill>
          ))}
        </div>
        <Field label="Catégorie" htmlFor="svc-cat" hint="Choisissez une catégorie Salon DZ ou créez la vôtre : elle classe la prestation sur votre profil.">
          <PickerField
            label="Catégorie"
            value={pick}
            placeholder="Sans catégorie"
            display={creating ? 'Nouvelle catégorie' : undefined}
            options={[
              { value: '', label: 'Sans catégorie' },
              ...groups.map((g) => ({ value: `g:${g}`, label: g, group: 'Mes catégories' })),
              ...suggested.map((c) => ({ value: `c:${c.id}`, label: c.labelFr, group: 'Suggérées pour votre salon' })),
              ...others.map((c) => ({ value: `c:${c.id}`, label: c.labelFr, group: 'Autres catégories Salon DZ' })),
              ...(categoryId && !cats.some((c) => c.id === categoryId) ? [{ value: `c:${categoryId}`, label: CATEGORY_BY_ID.get(categoryId)?.labelFr ?? categoryId, group: 'Autres catégories Salon DZ' }] : []),
            ]}
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
              onClick: () => {
                setCreating(true);
                setGroup('');
                setCategoryId('');
              },
            }}
          />
          {creating && <Input id="svc-group" lg className="mt-2" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={40} placeholder="Nom de la nouvelle catégorie (ex. Soins de la barbe)" aria-label="Nouvelle catégorie" autoFocus />}
        </Field>
        <Field label="Description" htmlFor="svc-desc">
          <Textarea id="svc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Pose complète en gel, limage, cuticules et finition brillante. Tenue 3 à 4 semaines." />
        </Field>
        {error && (
          <p className="text-[0.875rem] text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
      <StepSheet label="Ajouter une photo" onClick={() => void submit()} busy={create.isPending || update.isPending} disabled={!name.trim() || !price || duration < 5} />
    </Screen>
  );
}
