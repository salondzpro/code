/**
 * Mot de passe oublié (envoi du lien) et nouveau mot de passe (après le lien : Supabase ouvre
 * une session de récupération, on remplace le mot de passe puis on continue).
 *
 * L'envoi du lien vit dans `pages/auth/Acces.tsx` (`/acces/oubli`, `/pro/acces/oubli`) ; l'ancienne
 * adresse `/connexion/oubli` reste branchée et y renvoie. Le NOUVEAU mot de passe prend le cadre
 * commun des écrans d'accès (14 nov. 2026) : un seul champ, l'œil pour le voir, le bouton en bas.
 */
import { ICONE } from '@/lib/actionIcons';
import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow } from '@/lib/authFlow';
import { Button, I } from '@/components/ui';
import { AuthError, PasswordField } from '@/components/AuthShell';
import { AuthScreen } from '@/components/AuthKit';
import { PASSWORD_MIN } from './SignUp';
import { PageLoading } from '@/components/PageLoading';
import { t } from '@/i18n';
import { MARCHE } from '@/lib/flavor';

export function ForgotPassword() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? readAuthFlow()?.identifier ?? '';
  const q = new URLSearchParams(email ? { email } : {});
  const base = readAuthFlow()?.role === 'pro' ? '/pro/acces' : '/acces';
  return <Navigate to={`${base}/oubli${q.size ? `?${q.toString()}` : ''}`} replace />;
}

export function NewPassword() {
  const navigate = useNavigate();
  const { session, updatePassword, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flow = readAuthFlow();
  const next = flow?.next ?? MARCHE;
  const base = flow?.role === 'pro' ? '/pro/acces' : '/acces';
  const assez = password.length >= PASSWORD_MIN;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assez) return setError(t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }));
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

  if (!session)
    return (
      <AuthScreen
        titre={t('Nouveau mot de passe')}
        sous={t('Le lien a expiré ou a déjà servi. Demandez-en un nouveau.')}
        actions={
          <Button icon={ICONE.recevoirLien} onClick={() => navigate(`${base}/oubli`)}>
            {t('Demander un nouveau lien')}
          </Button>
        }
      />
    );

  return (
    <AuthScreen
      titre={t('Nouveau mot de passe')}
      sous={t('Choisissez un nouveau mot de passe pour votre compte.')}
      actions={
        <Button icon={ICONE.enregistrer} type="submit" form="pa-nouveau" loading={busy} disabled={busy}>
          {t('Enregistrer')}
        </Button>
      }
    >
      <form id="pa-nouveau" onSubmit={submit} noValidate className="pa-form">
        <PasswordField
          id="pa-nouveau-i"
          label={t('Nouveau mot de passe')}
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={!!error}
        />
        <p className={`pa-regle ${assez ? 'ok' : ''}`}>
          <span className="pa-regle-r" aria-hidden>
            {assez && <I icon={Check} size={11} strokeWidth={3} />}
          </span>
          {t('{n} caractères au minimum', { n: PASSWORD_MIN })}
        </p>
        {error && <AuthError texte={error} />}
      </form>
    </AuthScreen>
  );
}
