/**
 * Mes informations : nom et numéro de téléphone modifiables (numéro contrôlé en format,
 * comme à l'inscription), adresse e-mail en lecture seule (c'est l'identifiant du compte).
 * Sert au client comme au professionnel.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown } from 'lucide-react';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { groupLocalDigits } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Badge, Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

export function AccountInfo({ backTo = '/profil' }: { backTo?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = useMe();
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<{ field: 'name' | 'phone' | 'form'; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const p = me.data?.profile;

  useEffect(() => {
    if (p) {
      setName(p.fullName ?? '');
      setDigits((p.phone ?? '').replace(/^\+213/, ''));
    }
  }, [p]);

  if (me.isPending || !p) return <Splash />;
  const dirty = name.trim() !== (p.fullName ?? '') || `+213${digits}` !== (p.phone ?? '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError({ field: 'name', msg: t('Indiquez votre prénom et votre nom.') });
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError({ field: 'phone', msg: t('Numéro algérien invalide : 9 chiffres après +213.') });
    setError(null);
    try {
      await update.mutateAsync({ fullName: name.trim(), phone: parsed.data });
      setSaved(true);
      window.setTimeout(() => navigate(backTo), 600);
    } catch (err) {
      setError({ field: 'form', msg: errorText(err) });
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo={backTo} right={t('Mon compte')} />
      <div>
        <h1 className="h1">{t('Mes informations')}</h1>
        <p className="p mt-2">{t('Le nom que voient les salons et le numéro où ils peuvent vous joindre.')}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t('Prénom et nom')} htmlFor="ai-name" error={error?.field === 'name' ? error.msg : null}>
          <Input
            id="ai-name"
            lg
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="name"
          />
        </Field>
        <div>
          <label className="lbl" htmlFor="ai-phone">
            {t('Numéro de téléphone')}
          </label>
          <div className="flex gap-2.5">
            <div className="flex flex-none items-center gap-2 rounded-[var(--radius-input)] bg-fill px-4 text-[0.857rem] font-medium" aria-label={t('Indicatif +213')}>
              +213 <I icon={ChevronDown} size={16} className="text-subtle" />
            </div>
            <Input
              id="ai-phone"
              lg
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={groupLocalDigits(digits)}
              onChange={(e) => {
                setDigits(e.target.value.replace(/\D/g, '').slice(0, 9));
                setError(null);
              }}
              err={error?.field === 'phone'}
            />
          </div>
          <p className={`mt-1.5 text-[0.857rem] ${error?.field === 'phone' ? 'text-danger' : 'text-subtle'}`}>
            {error?.field === 'phone' ? error.msg : t('Format algérien · aucun SMS envoyé.')}
          </p>
        </div>
        {user?.email && (
          <div>
            <span className="lbl">{t('E-mail')}</span>
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-input)] bg-fill px-4 py-[1.125rem] text-[0.857rem]">
              <span className="truncate">{user.email}</span>
              <Badge tone="ok" md>
                {t('Vérifié')}
              </Badge>
            </div>
            <p className="t3 mt-1.5">{t("L'adresse e-mail est l'identifiant du compte : elle ne se modifie pas ici.")}</p>
          </div>
        )}
        {error?.field === 'form' && (
          <p className="text-[1rem] text-danger" role="alert">
            {error.msg}
          </p>
        )}
        <Button type="submit" disabled={update.isPending || (!dirty && !saved)}>
          {saved ? t('Enregistré') : update.isPending ? t('Enregistrement…') : t('Enregistrer')}
        </Button>
      </form>
    </Screen>
  );
}
