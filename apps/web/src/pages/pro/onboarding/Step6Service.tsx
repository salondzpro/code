/** PRO-F 08 — Étape 6 : prestation (nom, prix, durée libre en minutes, groupe du catalogue créé librement, catégorie, description) → photos. */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { CATEGORY_BY_ID, categoriesForSalon, serviceTemplatesFor, type CategoryId } from '@salondz/constants';
import { createServiceSchema } from '@salondz/validation';
import { formatDuration } from '@/lib/format';
import { errorText } from '@/components/ErrorMessage';
import { Field, Input, Pill, Textarea } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

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
  // Suggestions issues des spécialités choisies à l'inscription : un nom, une durée et un prix courants, à ajuster.
  const templates = existing ? [] : serviceTemplatesFor(salon.categoryIds.length ? salon.categoryIds : cats.map((c) => c.id)).filter((tpl) => !salon.services.some((s) => s.name.toLowerCase() === tpl.name.toLowerCase()));
  const applyTemplate = (tpl: (typeof templates)[number]) => {
    setName(tpl.name);
    setDuration(tpl.minutes);
    setPrice(String(tpl.priceDa));
    setCategoryId(tpl.categoryId);
    setGroup('');
    setCreating(false);
  };

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
      <StepTitle sub={existing ? undefined : t("Nom, prix, durée. Vous pourrez en ajouter d'autres ensuite depuis le catalogue.")}>
        {existing ? t('Modifier la prestation') : first ? t('Votre première prestation') : t('Nouvelle prestation')}
      </StepTitle>
      {templates.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="h3">{t("Suggestions pour votre salon")}</span>
          <div className="pills -mx-5 px-5" aria-label={t("Prestations courantes")}>
            {templates.slice(0, 12).map((tpl) => (
              <Pill key={tpl.name} lg on={name === tpl.name} onClick={() => applyTemplate(tpl)}>
                {tpl.name} · {formatDuration(tpl.minutes)}
              </Pill>
            ))}
          </div>
        </div>
      )}
      <form id="service" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("Nom")} htmlFor="svc-name">
          <Input id="svc-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={salon.genderTarget === 'men' ? t("Coupe + barbe") : t("Pose gel")} autoFocus={templates.length === 0} />
        </Field>
        <div className="g2">
          <Field label={t("Prix")} htmlFor="svc-price">
            <div className="relative">
              <Input id="svc-price" lg inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="2 500" className="!pr-12" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.857rem]">DA</span>
            </div>
          </Field>
          <Field label={t("Durée (minutes)")} htmlFor="svc-duration" hint={formatDuration(duration)}>
            <div className="relative">
              <Input id="svc-duration" lg inputMode="numeric" value={String(duration || '')} onChange={(e) => setDuration(Math.min(480, Number(e.target.value.replace(/\D/g, '')) || 0))} placeholder="45" className="!pr-14" />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[0.857rem]">{t("min")}</span>
            </div>
          </Field>
        </div>
        <div className="pills -mx-5 px-5" aria-label={t("Durées courantes")}>
          {DURATIONS.map((d) => (
            <Pill key={d} lg on={duration === d} onClick={() => setDuration(d)}>
              {formatDuration(d)}
            </Pill>
          ))}
        </div>
        <Field label={t("Catégorie")} htmlFor="svc-cat" hint={t("Choisissez une catégorie Salon DZ ou créez la vôtre : elle classe la prestation sur votre profil.")}>
          <PickerField
            label={t("Catégorie")}
            value={pick}
            placeholder={t("Sans catégorie")}
            display={creating ? 'Nouvelle catégorie' : undefined}
            options={[
              { value: '', label: t("Sans catégorie") },
              ...groups.map((g) => ({ value: `g:${g}`, label: g, group: 'Mes catégories' })),
              ...suggested.map((c) => ({ value: `c:${c.id}`, label: t(c.labelFr), group: 'Suggérées pour votre salon' })),
              ...others.map((c) => ({ value: `c:${c.id}`, label: t(c.labelFr), group: 'Autres catégories Salon DZ' })),
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
              label: t("Créer une nouvelle catégorie"),
              onClick: () => {
                setCreating(true);
                setGroup('');
                setCategoryId('');
              },
            }}
          />
          {creating && <Input id="svc-group" lg className="mt-2" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={40} placeholder={t("Nom de la nouvelle catégorie (ex. Soins de la barbe)")} aria-label={t("Nouvelle catégorie")} autoFocus />}
        </Field>
        <Field label={t("Description")} htmlFor="svc-desc">
          <Textarea id="svc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder={t("Pose complète en gel, limage, cuticules et finition brillante. Tenue 3 à 4 semaines.")} />
        </Field>
        {error && (
          <p className="text-[1rem] text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
      <StepSheet label={t("Ajouter une photo")} onClick={() => void submit()} busy={create.isPending || update.isPending} disabled={!name.trim() || !price || duration < 5} />
    </Screen>
  );
}
