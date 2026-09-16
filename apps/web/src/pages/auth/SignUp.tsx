/**
 * Inscription par e-mail et mot de passe. L'adresse est vérifiée par le lien reçu (comme
 * les outils du métier) ; le profil (nom, téléphone) se complète après, une fois connecté.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { EMAIL_RE } from './Login';
import { t } from '@/i18n';

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
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(null);

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError({ kind: 'email', text: t("Adresse e-mail invalide.") });
    if (password.length < PASSWORD_MIN) return setError({ kind: 'password', text: `Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.` });
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email', sentAt: Date.now() });
      const open = await signUpWithPassword(id, password, role, next);
      // Session ouverte tout de suite (confirmation désactivée) : on complète le profil.
      if (open) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate('/connexion/envoye?mode=confirm', { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo={role === 'pro' ? '/pro/bienvenue' : `/connexion?role=${role}`} />
      <div>
        <h1 className="h1">{role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}</h1>
        <p className="p mt-2">
          {role === 'pro'
            ? 'Votre agenda, vos réservations et votre page en ligne, en quelques minutes.'
            : 'Réservez en ligne dans les salons de votre choix, sans appel.'}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={t("E-mail")} htmlFor="su-email" hint={t("Un lien de confirmation vous sera envoyé.")}>
          <Input
            id="su-email"
            lg
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("vous@exemple.dz")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={error?.kind === 'email' || error?.kind === 'exists'}
            autoFocus
          />
        </Field>
        <Field label={t("Mot de passe")} htmlFor="su-password" hint={`${PASSWORD_MIN} caractères au minimum.`}>
          <div className="relative">
            <Input
              id="su-password"
              lg
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t("Choisissez un mot de passe")}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              err={error?.kind === 'password'}
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
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-danger-line bg-cancel-bg p-3" role="alert">
            <p className="flex items-start gap-2 text-[1rem] text-cancel-fg">
              <I icon={AlertCircle} size={18} className="mt-0.5 flex-none" /> {error.text}
            </p>
            {error.kind === 'exists' && (
              <div className="g2">
                <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                  {t("Se connecter")}
                </Link>
                <Link to={`/connexion/oubli?email=${encodeURIComponent(email.trim())}`} className="btn g sm">
                  {t("Mot de passe oublié")}
                </Link>
              </div>
            )}
          </div>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Création…' : 'Créer mon compte'}
        </Button>
        <p className="t3 text-center">
          {t("En créant un compte vous acceptez que Salon DZ vous envoie les confirmations et rappels de vos rendez-vous.")}
        </p>
      </form>
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <p className="p text-center">{t("Déjà inscrit ?")}</p>
        <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn g">
          {t("Se connecter")}
        </Link>
      </div>
    </Screen>
  );
}
