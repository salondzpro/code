/**
 * Connexion par e-mail et mot de passe (comme les outils du métier), avec un lien de
 * connexion par e-mail en secours et la réinitialisation du mot de passe.
 * Comptes de démonstration : taper le numéro de démonstration à la place de l'e-mail mène
 * à la saisie du code fixe.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { isTestPhone } from '@salondz/constants';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { session, signInWithPassword, sendMagicLink } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/');
  const [email, setEmail] = useState(() => readAuthFlow()?.identifier ?? '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'password' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  /** « 0603044618 », « 603044618 » ou « +213603044618 » → E.164 si c'est un compte de démonstration. */
  const demoPhone = (v: string) => {
    const digits = v.replace(/\D/g, '');
    const local = digits.startsWith('213') ? digits.slice(3) : digits.replace(/^0/, '');
    const e164 = `+213${local}`;
    return isTestPhone(e164) ? e164 : null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    // Compte de démonstration : numéro à la place de l'e-mail → code fixe.
    const demo = demoPhone(id);
    if (demo) {
      writeAuthFlow({ role, next, identifier: demo, channel: 'sms' });
      navigate('/connexion/code');
      return;
    }
    if (!EMAIL_RE.test(id)) return setError('Adresse e-mail invalide.');
    if (!password) return setError('Saisissez votre mot de passe.');
    setError(null);
    setBusy('password');
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email' });
      await signInWithPassword(id, password);
      navigate(`/connexion/retour?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  };

  const link = async () => {
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError('Indiquez votre adresse e-mail pour recevoir le lien.');
    setError(null);
    setBusy('link');
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email', sentAt: Date.now() });
      await sendMagicLink(id, next);
      navigate('/connexion/envoye?mode=link');
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/bienvenue" />
      <div>
        <h1 className="h1">Connexion</h1>
        <p className="p mt-2">
          Pas encore de compte ?{' '}
          <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="font-semibold text-text underline">
            Créer un compte
          </Link>
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail" htmlFor="login-email">
          <Input
            id="login-email"
            lg
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.dz"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </Field>
        <Field label="Mot de passe" htmlFor="login-password">
          <div className="relative">
            <Input
              id="login-password"
              lg
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="!pr-12"
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
        <Button type="submit" disabled={busy !== null}>
          {busy === 'password' ? 'Connexion…' : 'Se connecter'}
        </Button>
        <div className="flex items-center justify-between text-[1rem]">
          <Link to={`/connexion/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="text-muted underline">
            Mot de passe oublié ?
          </Link>
          <button type="button" className="text-muted underline" onClick={() => void link()} disabled={busy !== null}>
            {busy === 'link' ? 'Envoi…' : 'Recevoir un lien par e-mail'}
          </button>
        </div>
      </form>
    </Screen>
  );
}
