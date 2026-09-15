/**
 * Mot de passe oublié (envoi du lien) et nouveau mot de passe (après le lien : Supabase ouvre
 * une session de récupération, on remplace le mot de passe puis on continue).
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { EMAIL_RE } from './Login';
import { PASSWORD_MIN } from './SignUp';
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
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/connexion" />
      <div>
        <h1 className="h1">{t("Mot de passe oublié")}</h1>
        <p className="p mt-2">{t("Indiquez votre adresse : vous recevrez un lien pour en choisir un nouveau.")}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={t("E-mail")} htmlFor="fp-email">
          <Input
            id="fp-email"
            lg
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </Field>
        {error && (
          <p className="flex items-center gap-2 text-[1rem] text-danger" role="alert">
            <I icon={AlertCircle} size={16} /> {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Envoi…' : 'Envoyer le lien'}
        </Button>
      </form>
    </Screen>
  );
}

export function NewPassword() {
  const navigate = useNavigate();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = readAuthFlow()?.next ?? '/';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.`);
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

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar noBack />
      <div>
        <h1 className="h1">{t("Nouveau mot de passe")}</h1>
        <p className="p mt-2">
          {session ? 'Choisissez un nouveau mot de passe pour votre compte.' : 'Le lien a expiré ou a déjà servi. Demandez-en un nouveau.'}
        </p>
      </div>
      {session ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t("Mot de passe")} htmlFor="np-password" hint={`${PASSWORD_MIN} caractères au minimum.`}>
            <div className="relative">
              <Input
                id="np-password"
                lg
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="!pr-12"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                onClick={() => setShow((v) => !v)}
              >
                <I icon={show ? EyeOff : Eye} size={20} />
              </button>
            </div>
          </Field>
          {error && (
            <p className="flex items-center gap-2 text-[1rem] text-danger" role="alert">
              <I icon={AlertCircle} size={16} /> {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      ) : (
        <Button onClick={() => navigate('/connexion/oubli')}>{t("Demander un nouveau lien")}</Button>
      )}
    </Screen>
  );
}
