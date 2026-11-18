/**
 * AUTH 13 — Profil : nom et NUMÉRO DE TÉLÉPHONE, tous deux obligatoires. Le numéro est
 * contrôlé dans sa forme (algérien, 9 chiffres après +213) et rien de plus : aucun SMS. C'est
 * le numéro que le salon appelle en cas de retard ou de question, et celui qui rattache les
 * rendez-vous pris par quelqu'un d'autre à ce compte.
 */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useState, type FormEvent } from 'react';
import { guestMarket } from '@/lib/useClientMarket';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { Button, Field, Input } from '@/components/ui';
import { AuthScreen } from '@/components/AuthKit';
import { PhoneDZField } from '@/components/PhoneDZField';
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
    // Numéro OBLIGATOIRE pour tous (17 nov. 2026, demande du propriétaire), avec ou sans le 0 du début.
    const brut = digits.replace(/\D/g, '');
    const parsed = phoneDZ.safeParse(`0${brut}`);
    if (!parsed.success) return setError({ field: 'phone', msg: t("Numéro algérien invalide : 9 chiffres après +213.") });
    setError(null);
    try {
      // Les rappels sont ACQUIS, pas proposés : un interrupteur sur l'écran d'inscription demandait un
      // arbitrage avant même d'avoir pris un rendez-vous. Il reste dans Réglages, pour qui veut les
      // couper après coup — et c'est pourquoi on ne les force PAS ici : la colonne vaut `true` par
      // défaut en base, donc l'écrire ne servirait qu'à rallumer, en silence, ce que quelqu'un
      // aurait éteint.
      const market = !isPro && !me.data?.profile.market ? guestMarket() : null;
      await update.mutateAsync({ fullName: name.trim(), phone: parsed.data, ...(market ? { market } : {}) });
      if (isPro) navigate(next.startsWith('/pro') ? next : '/pro', { replace: true });
      else if (!me.data?.profile.market && !market) navigate(`/marche?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(next, { replace: true });
    } catch (err) {
      setError({ field: 'form', msg: errorText(err) });
    }
  };

  // Seulement ce qui MANQUE au compte (18 nov. 2026) : un compte qui a déjà son nom ne le retape pas.
  const avaitNom = !!me.data?.profile.fullName;
  const avaitTel = !!me.data?.profile.phone;
  const titre = avaitNom && !avaitTel ? t('Votre numéro') : !avaitNom && avaitTel ? t('Votre nom') : t('Vos coordonnées');
  return (
    <AuthScreen
      titre={titre}
      actions={
        <Button icon={ICONE.valider} type="submit" form="pa-profil" loading={update.isPending} disabled={me.isPending}>
          {t('Terminer')}
        </Button>
      }
    >
      <form id="pa-profil" onSubmit={submit} noValidate className="pa-form">
        {!avaitNom && (
        <Field label={t("Prénom et nom")} htmlFor="full-name" error={error?.field === 'name' ? error.msg : null}>
          <Input
            id="full-name"
            className={name ? 'f' : ''}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoComplete="name"
            placeholder={t("Inès Rahmani")}
          />
        </Field>
        )}
        {!avaitTel && (
        <PhoneDZField
          id="profile-phone"
          digits={digits}
          onDigits={(v) => {
            setDigits(v);
            setError(null);
          }}
          error={error?.field === 'phone' ? error.msg : null}
        />
        )}
        {error?.field === 'form' && (
          <p className="text-[1rem] text-danger" role="alert">
            {error.msg}
          </p>
        )}
      </form>
    </AuthScreen>
  );
}
