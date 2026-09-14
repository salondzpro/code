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
import { Badge, Button, Field, I, Input, Toggle, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function ProfileSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { session, user } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState<{ field: 'name' | 'phone' | 'form'; msg: string } | null>(null);

  useEffect(() => {
    if (me.data) {
      setName((v) => v || me.data!.profile.fullName || '');
      setDigits((v) => v || (me.data!.profile.phone ?? '').replace(/^\+213/, ''));
      setReminders(me.data.profile.whatsappReminders ?? true);
    }
  }, [me.data]);

  if (!session) return <Navigate to="/connexion" replace />;
  const email = user?.email;
  const isPro = me.data?.profile.role === 'pro';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError({ field: 'name', msg: 'Indiquez votre prénom et votre nom.' });
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError({ field: 'phone', msg: 'Numéro algérien invalide : 9 chiffres après +213.' });
    setError(null);
    try {
      await update.mutateAsync({ fullName: name.trim(), phone: parsed.data, whatsappReminders: reminders });
      if (isPro) navigate(next.startsWith('/pro') ? next : '/pro', { replace: true });
      else if (!me.data?.profile.market) navigate(`/marche?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(next, { replace: true });
    } catch (err) {
      setError({ field: 'form', msg: errorText(err) });
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar noBack right="Dernière étape" />
      <div>
        <h1 className="h1">Vos coordonnées</h1>
        <p className="p mt-3">
          {isPro
            ? 'Votre nom et le numéro où vos clients peuvent vous joindre.'
            : 'Le salon voit votre nom sur la réservation et vous appelle sur ce numéro si besoin.'}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Prénom et nom" htmlFor="full-name" error={error?.field === 'name' ? error.msg : null}>
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
            placeholder="Inès Rahmani"
            autoFocus
          />
        </Field>
        <div>
          <label className="lbl" htmlFor="profile-phone">
            Numéro de téléphone
          </label>
          <div className="flex gap-2.5">
            <div className="flex flex-none items-center gap-2 rounded-[var(--radius-input)] bg-fill px-4 text-[0.857rem] font-medium" aria-label="Indicatif +213">
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
        {email && (
          <div>
            <span className="lbl">Adresse vérifiée</span>
            <div className="flex items-center justify-between rounded-[var(--radius-input)] bg-fill px-4 py-[1.125rem] text-[0.857rem]">
              <span className="truncate">{email}</span>
              <Badge tone="ok" md>
                Vérifiée
              </Badge>
            </div>
          </div>
        )}
        {!isPro && (
          <div className="flex items-center justify-between">
            <span>
              <span className="block text-[1rem] font-semibold">Rappels de rendez-vous</span>
              <span className="p block">Notification avant chaque rendez-vous</span>
            </span>
            <Toggle on={reminders} onChange={setReminders} label="Rappels de rendez-vous" />
          </div>
        )}
        {error?.field === 'form' && (
          <p className="text-[1rem] text-danger" role="alert">
            {error.msg}
          </p>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Terminer'}
        </Button>
      </form>
    </Screen>
  );
}
