import { useEffect, useState, type FormEvent } from 'react';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { formatDZPhone } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export function Account() {
  const { user, signOut } = useAuth();
  const me = useMe();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = me.data?.profile;
    if (!p) return;
    setFullName(p.fullName ?? '');
    setPhone(p.phone ? formatDZPhone(p.phone) : '');
    setGender(p.gender ?? '');
  }, [me.data]);

  if (me.isPending) return <Spinner />;
  if (me.isError) return <ErrorMessage error={me.error} retry={() => me.refetch()} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    let normalizedPhone: string | null = null;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setFormError('Numéro algérien invalide (ex : 05 51 23 45 67).');
      normalizedPhone = parsed.data;
    }
    await update.mutateAsync({ fullName: fullName.trim() || undefined, phone: normalizedPhone, gender: gender || null });
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">Mon compte</h1>
        <p className="text-sm text-muted">{user?.email}</p>
        <Field label="Nom complet">{(id) => <input id={id} className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />}</Field>
        <Field label="Téléphone" hint="Utilisé par le salon pour vous joindre.">
          {(id) => <input id={id} className="input" type="tel" inputMode="tel" placeholder="05 51 23 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="Genre (facultatif)">
          {(id) => (
            <select id={id} className="input" value={gender} onChange={(e) => setGender(e.target.value as '' | 'male' | 'female')}>
              <option value="">—</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
            </select>
          )}
        </Field>
        {formError && <p className="text-sm text-danger">{formError}</p>}
        <ErrorMessage error={update.error} />
        {saved && <p className="text-sm text-success">Profil enregistré.</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={update.isPending}>
            Enregistrer
          </button>
          <button type="button" className="btn-ghost" onClick={() => signOut()}>
            Se déconnecter
          </button>
        </div>
      </form>
    </div>
  );
}
