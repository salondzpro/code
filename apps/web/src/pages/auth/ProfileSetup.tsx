/**
 * AUTH 13 — Profil : nom et NUMÉRO DE TÉLÉPHONE, tous deux obligatoires. Le numéro est
 * contrôlé dans sa forme (algérien, 9 chiffres après +213) et rien de plus : aucun SMS. C'est
 * le numéro que le salon appelle en cas de retard ou de question, et celui qui rattache les
 * rendez-vous pris par quelqu'un d'autre à ce compte.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { groupLocalDigits } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Button, Field, I, Input } from '@/components/ui';
import { AuthShell } from '@/components/AuthShell';
import { t } from '@/i18n';

export function ProfileSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { session } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<{ field: 'name' | 'phone' | 'form'; msg: string } | null>(null);

  useEffect(() => {
    if (me.data) {
      setName((v) => v || me.data!.profile.fullName || '');
      setDigits((v) => v || (me.data!.profile.phone ?? '').replace(/^\+213/, ''));
    }
  }, [me.data]);

  if (!session) return <Navigate to="/connexion" replace />;
  const isPro = me.data?.profile.role === 'pro';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError({ field: 'name', msg: t("Indiquez votre prénom et votre nom.") });
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError({ field: 'phone', msg: t("Numéro algérien invalide : 9 chiffres après +213.") });
    setError(null);
    try {
      // Les rappels sont ACQUIS, pas proposés : un interrupteur sur l'écran d'inscription demandait
      // un arbitrage avant même d'avoir pris un rendez-vous. Il reste dans Réglages, pour qui veut
      // les couper après coup.
      await update.mutateAsync({ fullName: name.trim(), phone: parsed.data, remindersEnabled: true });
      if (isPro) navigate(next.startsWith('/pro') ? next : '/pro', { replace: true });
      else if (!me.data?.profile.market) navigate(`/marche?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(next, { replace: true });
    } catch (err) {
      setError({ field: 'form', msg: errorText(err) });
    }
  };

  return (
    <AuthShell
      role={isPro ? 'pro' : 'client'}
      marque={false}
      titre="Vos coordonnées"
    >
      <p className="-mt-2 text-[0.875rem] font-semibold uppercase tracking-[0.08em] text-muted">{t('Dernière étape')}</p>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t("Prénom et nom")} htmlFor="full-name" error={error?.field === 'name' ? error.msg : null}>
          <Input
            id="full-name"
            lg
            className={name ? 'f' : ''}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="name"
            placeholder={t("Inès Rahmani")}
            autoFocus
          />
        </Field>
        <div>
          <label className="lbl" htmlFor="profile-phone">
            {t("Numéro de téléphone")}
          </label>
          <div className="flex gap-2.5">
            <div className="flex flex-none items-center gap-2 rounded-[var(--radius-input)] bg-fill px-4 text-[0.857rem] font-medium" aria-label={t("Indicatif +213")}>
              +213 <I icon={ChevronDown} size={16} className="text-subtle" />
            </div>
            <Input
              id="profile-phone"
              lg
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="6 61 24 87 90"
              value={groupLocalDigits(digits)}
              onChange={(e) => {
                setDigits(e.target.value.replace(/\D/g, '').slice(0, 9));
                setError(null);
              }}
              err={error?.field === 'phone'}
              aria-required
            />
          </div>
          <p className={`mt-1.5 text-[0.857rem] ${error?.field === 'phone' ? 'text-danger' : 'text-subtle'}`}>
            {error?.field === 'phone' ? error.msg : 'Format algérien · aucun SMS envoyé.'}
          </p>
        </div>
        {error?.field === 'form' && (
          <p className="text-[1rem] text-danger" role="alert">
            {error.msg}
          </p>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Terminer'}
        </Button>
      </form>
    </AuthShell>
  );
}
