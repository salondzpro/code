/** AUTH 13 — Profil client de base : prénom et nom, numéro vérifié, rappels WhatsApp. */
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Badge, Button, Field, Input, Toggle, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function ProfileSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { session, user } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setName((v) => v || me.data!.profile.fullName || '');
      setReminders(me.data.profile.whatsappReminders ?? true);
    }
  }, [me.data]);

  if (!session) return <Navigate to="/connexion" replace />;

  const phone = user?.phone ? `+${user.phone.replace(/^\+/, '')}` : me.data?.profile.phone;
  const email = user?.email;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Indiquez votre prénom.');
    setError(null);
    try {
      await update.mutateAsync({ fullName: name.trim(), whatsappReminders: reminders, ...(phone && !me.data?.profile.phone ? { phone } : {}) });
      const isPro = me.data?.profile.role === 'pro';
      if (isPro) navigate(next.startsWith('/pro') ? next : '/pro', { replace: true });
      else if (!me.data?.profile.market) navigate(`/marche?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(next, { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar right="Dernière étape" />
      <div>
        <h1 className="h1">Votre prénom</h1>
        <p className="p mt-3">Le professionnel le voit sur la réservation. Rien d'autre n'est obligatoire.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Prénom et nom" htmlFor="full-name" error={error}>
          <Input id="full-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Inès Rahmani" autoFocus />
        </Field>
        <div>
          <span className="lbl">{phone ? 'Numéro vérifié' : 'Adresse vérifiée'}</span>
          <div className="flex items-center justify-between rounded-[14px] bg-fill px-4 py-[18px] text-[17px]">
            <span>{phone ? formatIntlDZ(phone) : email}</span>
            <Badge tone="ok" md>
              Vérifié
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>
            <span className="block text-[20px] font-semibold">Rappels WhatsApp</span>
            <span className="p block">2 h avant chaque rendez-vous</span>
          </span>
          <Toggle on={reminders} onChange={setReminders} label="Rappels WhatsApp" />
        </div>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Enregistrement…' : 'Terminer'}
        </Button>
      </form>
    </Screen>
  );
}
