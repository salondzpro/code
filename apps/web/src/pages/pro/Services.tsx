import { useState, type FormEvent } from 'react';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { CATEGORIES, formatDA, type CategoryId } from '@salondz/constants';
import { createServiceSchema } from '@salondz/validation';
import type { Service } from '@salondz/types';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { formatDuration } from '@/lib/format';

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

function ServiceForm({ initial, onSubmit, onCancel, busy, error }: { initial?: Service; onSubmit: (v: { name: string; durationMinutes: number; priceDa: number; categoryId: CategoryId | null; description?: string }) => void; onCancel?: () => void; busy: boolean; error: unknown }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30);
  const [price, setPrice] = useState(initial?.priceDa ?? 500);
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = createServiceSchema.safeParse({ name, durationMinutes: duration, priceDa: price, categoryId: categoryId || null, description: description || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0] ?? 'form')] = i.message;
      return setErrors(next);
    }
    setErrors({});
    onSubmit({ name: parsed.data.name, durationMinutes: parsed.data.durationMinutes, priceDa: parsed.data.priceDa, categoryId: parsed.data.categoryId ?? null, description: parsed.data.description });
  };

  return (
    <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Nom" required error={errors.name}>
        {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
      </Field>
      <Field label="Catégorie">
        {(id) => (
          <select id={id} className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labelFr}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Durée" required error={errors.durationMinutes}>
        {(id) => (
          <select id={id} className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Prix (DA)" required error={errors.priceDa}>
        {(id) => <input id={id} className="input" type="number" min={0} step={50} inputMode="numeric" value={price} onChange={(e) => setPrice(Number(e.target.value))} />}
      </Field>
      <Field label="Description">
        {(id) => <input id={id} className="input sm:col-span-2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />}
      </Field>
      <div className="flex items-end gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
      <ErrorMessage error={error} className="sm:col-span-2" />
    </form>
  );
}

export function Services() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const { create, update, remove } = useProServiceMutations();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!salon) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Services</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding((v) => !v)}>
          + Ajouter
        </button>
      </header>
      {adding && (
        <ServiceForm
          busy={create.isPending}
          error={create.error}
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            await create.mutateAsync({ ...v, isActive: true });
            setAdding(false);
          }}
        />
      )}
      <ErrorMessage error={remove.error ?? update.error} />
      <ul className="flex flex-col gap-2">
        {salon.services.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <ServiceForm
                initial={s}
                busy={update.isPending}
                error={update.error}
                onCancel={() => setEditing(null)}
                onSubmit={async (v) => {
                  await update.mutateAsync({ id: s.id, ...v });
                  setEditing(null);
                }}
              />
            </li>
          ) : (
            <li key={s.id} className={`card flex items-center justify-between gap-3 p-4 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {s.name} {!s.isActive && <span className="text-xs text-muted">(désactivé)</span>}
                </p>
                <p className="text-sm text-muted">
                  {formatDuration(s.durationMinutes)} · {formatDA(s.priceDa)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(s.id)}>
                  Modifier
                </button>
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => update.mutate({ id: s.id, isActive: !s.isActive })}>
                  {s.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  type="button"
                  className="btn-danger px-2 py-1 text-xs"
                  onClick={() => {
                    if (window.confirm(`Supprimer « ${s.name} » ?`)) remove.mutate(s.id);
                  }}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ),
        )}
        {salon.services.length === 0 && !adding && <li className="text-sm text-muted">Ajoutez votre premier service (ex : Coupe homme · 30 min · 500 DA).</li>}
      </ul>
    </div>
  );
}
