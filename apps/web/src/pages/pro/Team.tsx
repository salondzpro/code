import { useState, type FormEvent } from 'react';
import { useProSalon, useProStaffMutations } from '@salondz/api-client';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export function Team() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const { create, update, remove } = useProStaffMutations();
  const [name, setName] = useState('');

  if (!salon) return <Spinner />;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 1) return;
    await create.mutateAsync({ displayName: name.trim() });
    setName('');
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Équipe</h1>
      <p className="text-sm text-muted">Chaque membre a son propre agenda. Les clients peuvent choisir « n'importe qui » ou un membre précis.</p>
      <form onSubmit={add} className="card flex items-end gap-2 p-4">
        <Field label="Nouveau membre" required>
          {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Prénom" />}
        </Field>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Ajouter
        </button>
      </form>
      <ErrorMessage error={create.error ?? update.error ?? remove.error} />
      <ul className="flex flex-col gap-2">
        {salon.staff.map((m) => (
          <li key={m.id} className={`card flex items-center justify-between gap-3 p-4 ${m.isActive ? '' : 'opacity-60'}`}>
            <div>
              <p className="font-medium">
                {m.displayName} {m.userId === salon.ownerId && <span className="text-xs text-muted">(vous)</span>}
              </p>
              {!m.isActive && <p className="text-xs text-muted">Inactif</p>}
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}>
                {m.isActive ? 'Désactiver' : 'Activer'}
              </button>
              <button
                type="button"
                className="btn-danger px-2 py-1 text-xs"
                onClick={() => {
                  if (window.confirm(`Retirer ${m.displayName} de l'équipe ?`)) remove.mutate(m.id);
                }}
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
