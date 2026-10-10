/**
 * Mot de passe oublié (envoi du lien) et nouveau mot de passe (après le lien : Supabase ouvre
 * une session de récupération, on remplace le mot de passe puis on continue).
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, Input } from '@/components/ui';
import { AuthError, AuthShell, MatchHint, PasswordField, matchState } from '@/components/AuthShell';
import { EMAIL_RE } from './Login';
import { PASSWORD_MIN } from './SignUp';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.get('email') ?? readAuthFlow()?.identifier ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError(t("Adresse e-mail invalide."));
    setBusy(true);
    setError(null);
    try {
      writeAuthFlow({ identifier: id, channel: 'email', sentAt: Date.now() });
      await sendPasswordReset(id);
      navigate('/connexion/envoye?mode=reset', { replace: true });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell back={readAuthFlow()?.role === 'pro' ? '/connexion?role=pro' : '/connexion'} titre="Mot de passe oublié" sous={t('Indiquez votre adresse : vous recevrez un lien pour en choisir un nouveau.')}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t('E-mail')} htmlFor="fp-email">
          <Input
            id="fp-email"
            lg
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('vous@exemple.dz')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={!!error}
            autoFocus
          />
        </Field>
        {error && <AuthError texte={error} />}
        <Button type="submit" loading={busy}>
          {t('Envoyer le lien')}
        </Button>
      </form>
    </AuthShell>
  );
}

export function NewPassword() {
  const navigate = useNavigate();
  const { session, updatePassword, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const accord = matchState(password, confirmation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = readAuthFlow()?.next ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.`);
    // Garde-fou : le bouton est désactivé, mais la touche Entrée ne passe pas par lui.
    if (password !== confirmation) return setError(t('Les deux mots de passe ne correspondent pas.'));
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      navigate(`/connexion/retour?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  // Arrivée par le lien : la session se lit encore. Sans cette attente, l'écran disait « lien expiré »
  // pendant une seconde avant de montrer le formulaire.
  if (loading) return <PageLoading />;

  return (
    <AuthShell
      titre="Nouveau mot de passe"
      sous={
        session
          ? t('Choisissez un nouveau mot de passe pour votre compte.')
          : t('Le lien a expiré ou a déjà servi. Demandez-en un nouveau.')
      }
    >
      {session ? (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <PasswordField
            id="np-password"
            label={t('Nouveau mot de passe')}
            autoComplete="new-password"
            hint={`${PASSWORD_MIN} caractères au minimum.`}
            value={password}
            onChange={(v) => {
              setPassword(v);
              // Le mot de passe change : la confirmation déjà saisie ne veut plus rien dire.
              setConfirmation('');
              setError(null);
            }}
            err={!!error}
            autoFocus
          />
          <PasswordField
            id="np-confirm"
            label={t('Confirmer le mot de passe')}
            autoComplete="new-password"
            value={confirmation}
            onChange={setConfirmation}
            err={accord === 'different'}
          />
          <MatchHint etat={accord} />
          {error && <AuthError texte={error} />}
          <Button type="submit" loading={busy} disabled={accord !== 'ok'}>
            {t('Enregistrer')}
          </Button>
        </form>
      ) : (
        <Button onClick={() => navigate('/connexion/oubli')}>{t('Demander un nouveau lien')}</Button>
      )}
    </AuthShell>
  );
}
