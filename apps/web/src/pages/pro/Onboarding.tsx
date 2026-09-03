import { useState, type FormEvent } from 'react';
import { useProSalonMutations } from '@salondz/api-client';
import { CATEGORIES, GENDER_TARGETS, GENDER_TARGET_LABELS_FR, WILAYAS, type CategoryId, type GenderTarget } from '@salondz/constants';
import { createSalonSchema } from '@salondz/validation';
import { Field } from '@/components/Field';
import { ErrorMessage } from '@/components/ErrorMessage';

export function Onboarding() {
  const { createSalon } = useProSalonMutations();
  const [name, setName] = useState('');
  const [wilayaCode, setWilayaCode] = useState(16);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [genderTarget, setGenderTarget] = useState<GenderTarget>('unisex');
  const [categoryIds, setCategoryIds] = useState<CategoryId[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleCategory = (id: CategoryId) => setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 4 ? [...prev, id] : prev));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = createSalonSchema.safeParse({
      name,
      wilayaCode,
      city,
      address: address || undefined,
      phone: phone || undefined,
      genderTarget,
      categoryIds,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0] ?? 'form')] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    // Après succès, RequirePro redirige (services d'abord, puisque le salon n'en a pas).
    await createSalon.mutateAsync(parsed.data);
  };

  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">Créer mon salon</h1>
        <p className="text-sm text-muted">Deux minutes suffisent. Vous pourrez tout modifier ensuite.</p>
        <Field label="Nom du salon" required error={errors.name}>
          {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Wilaya" required error={errors.wilayaCode}>
            {(id) => (
              <select id={id} className="input" value={wilayaCode} onChange={(e) => setWilayaCode(Number(e.target.value))}>
                {WILAYAS.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} – {w.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Commune / quartier" required error={errors.city}>
            {(id) => <input id={id} className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex : Hydra" />}
          </Field>
        </div>
        <Field label="Adresse" error={errors.address}>
          {(id) => <input id={id} className="input" value={address} onChange={(e) => setAddress(e.target.value)} />}
        </Field>
        <Field label="Téléphone du salon" error={errors.phone}>
          {(id) => <input id={id} className="input" type="tel" inputMode="tel" placeholder="05 51 23 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Clientèle" required>
          {(id) => (
            <div id={id} className="flex gap-2">
              {GENDER_TARGETS.map((g) => (
                <button key={g} type="button" className={genderTarget === g ? 'chip-active' : 'chip'} onClick={() => setGenderTarget(g)}>
                  {GENDER_TARGET_LABELS_FR[g]}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Catégories (1 à 4)" required error={errors.categoryIds}>
          {(id) => (
            <div id={id} className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" aria-pressed={categoryIds.includes(c.id)} className={categoryIds.includes(c.id) ? 'chip-active' : 'chip'} onClick={() => toggleCategory(c.id)}>
                  {c.labelFr}
                </button>
              ))}
            </div>
          )}
        </Field>
        <ErrorMessage error={createSalon.error} />
        <button type="submit" className="btn-primary" disabled={createSalon.isPending}>
          {createSalon.isPending ? 'Création…' : 'Créer mon salon'}
        </button>
      </form>
    </div>
  );
}
