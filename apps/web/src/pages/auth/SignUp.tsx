/**
 * Inscription par e-mail et mot de passe. L'adresse est vérifiée par le lien reçu (comme
 * les outils du métier) ; le profil (nom, téléphone) se complète après, une fois connecté.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, Input } from '@/components/ui';
import { AuthError, AuthShell, PasswordField } from '@/components/AuthShell';
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
    <AuthShell
      role={role}
      back={role === 'pro' ? '/pro/bienvenue' : `/connexion?role=${role}`}
      titre={role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}
      sous={
        role === 'pro'
          ? t('Votre agenda, vos réservations et votre page en ligne, en quelques minutes. Gratuit.')
          : t('Réservez dans les salons de votre choix, sans appeler.')
      }
      pied={
        <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn g">
          {t('J’ai déjà un compte')}
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t('E-mail')} htmlFor="su-email" hint={t('Un lien de confirmation vous sera envoyé.')}>
          <Input
            id="su-email"
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
            err={error?.kind === 'email' || error?.kind === 'exists'}
            autoFocus
          />
        </Field>
        <PasswordField
          id="su-password"
          label={t('Mot de passe')}
          autoComplete="new-password"
          placeholder={t('Choisissez un mot de passe')}
          hint={`${PASSWORD_MIN} caractères au minimum.`}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'password'}
        />
        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'exists' && (
              <div className="g2">
                <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                  {t('Se connecter')}
                </Link>
                <Link to={`/connexion/oubli?email=${encodeURIComponent(email.trim())}`} className="btn g sm">
                  {t('Mot de passe oublié')}
                </Link>
              </div>
            )}
          </AuthError>
        )}
        <Button type="submit" loading={busy}>
          {t('Créer mon compte')}
        </Button>
        <p className="t3 text-center leading-[1.5]">
          {t('En créant un compte, vous acceptez les')}{' '}
          <Link to="/cgu" className="underline underline-offset-2">
            {t('conditions d’utilisation')}
          </Link>{' '}
          {t('et la')}{' '}
          <Link to="/confidentialite" className="underline underline-offset-2">
            {t('politique de confidentialité')}
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
