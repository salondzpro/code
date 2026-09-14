/**
 * Inscription par e-mail et mot de passe. L'adresse est vérifiée par le lien reçu (comme
 * les outils du métier) ; le profil (nom, téléphone) se complète après, une fois connecté.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { EMAIL_RE } from './Login';

export const PASSWORD_MIN = 8;

export function SignUp() {
  const { session, signUpWithPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError('Adresse e-mail invalide.');
    if (password.length < PASSWORD_MIN) return setError(`Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.`);
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email', sentAt: Date.now() });
      const open = await signUpWithPassword(id, password, role, next);
      // Session ouverte tout de suite (confirmation désactivée) : on complète le profil.
      if (open) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate('/connexion/envoye?mode=confirm', { replace: true });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={`/connexion?role=${role}`} />
      <div>
        <h1 className="h1">{role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}</h1>
        <p className="p mt-2">
          Déjà inscrit ?{' '}
          <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="font-semibold text-text underline">
            Se connecter
          </Link>
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail" htmlFor="su-email" hint="Un lien de confirmation vous sera envoyé.">
          <Input
            id="su-email"
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
        <Field label="Mot de passe" htmlFor="su-password" hint={`${PASSWORD_MIN} caractères au minimum.`}>
          <div className="relative">
            <Input
              id="su-password"
              lg
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Choisissez un mot de passe"
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
        <Button type="submit" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </Button>
        <p className="t3 text-center">
          En créant un compte vous acceptez que Salon DZ vous envoie les confirmations et rappels de vos rendez-vous.
        </p>
      </form>
    </Screen>
  );
}
