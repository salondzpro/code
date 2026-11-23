/**
 * PORTAIL D'ADMINISTRATION (23 nov. 2026, demande du propriétaire : « salondz.com/admin doit afficher
 * le portail admin »). Avant, un visiteur non connecté arrivait sur la connexion CLIENT (Google,
 * « Créer mon compte »…) et un compte non administrateur était renvoyé à l'accueil sans un mot.
 *
 * Ici : e-mail + mot de passe, rien d'autre — ni création de compte, ni Google. Le garde reste
 * SERVEUR (`requireAdmin`) : cet écran ne fait qu'ouvrir une session puis demander `/admin/me`.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthScreen } from '@/components/AuthKit';
import { AuthError, PasswordField } from '@/components/AuthShell';
import { Field, I, Input } from '@/components/ui';
import { describeAuthError, useAuth } from '@/lib/auth';
import { aliasEmail } from '@/lib/alias';
import { api } from '@/lib/api';
import { t } from '@/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Destination sûre : toujours une page de l'administration. */
function cible(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('/admin/connexion') ? next : '/admin';
}

export function AdminLogin() {
  const { session, loading, signInWithPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = cible(params.get('next'));
  const refus = params.get('refus') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(refus ? t('Ce compte n’a pas accès à l’administration.') : null);
  const enCours = useRef(false);

  // Déjà connecté (et pas renvoyé ici pour refus) : le garde de l'administration tranche.
  if (!loading && session && !refus && !enCours.current) return <Navigate to={next} replace />;

  const estAdmin = async () => {
    try {
      await api.admin.me();
      return true;
    } catch {
      return false;
    }
  };

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    setError(null);
    if (!EMAIL_RE.test(mail)) return setError(t('Adresse e-mail invalide.'));
    if (!password) return setError(t('Saisissez votre mot de passe.'));
    setBusy(true);
    enCours.current = true;
    try {
      if (session) await signOut({ voile: false }).catch(() => undefined);
      // L'adresse elle-même, puis ses adresses internes (même adresse sur les deux portails).
      const essais = [mail, await aliasEmail(mail, 'pro'), await aliasEmail(mail, 'client')].filter((v, i, a) => a.indexOf(v) === i);
      let premiere: unknown = null;
      for (const adresse of essais) {
        try {
          await signInWithPassword(adresse, password, mail);
        } catch (err) {
          premiere ??= err;
          continue;
        }
        qc.removeQueries({ queryKey: ['admin'] });
        if (await estAdmin()) return navigate(next, { replace: true });
        await signOut({ voile: false }).catch(() => undefined);
        premiere = null;
        setError(t('Ce compte n’a pas accès à l’administration.'));
        return;
      }
      setError(premiere ? describeAuthError(premiere).text : t('E-mail ou mot de passe incorrect.'));
    } finally {
      enCours.current = false;
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      haut={
        <span className="ad-lock-i mb-3">
          <I icon={ShieldCheck} size={28} strokeWidth={1.6} />
        </span>
      }
      titre={t('Administration Salon DZ')}
    >
      <form onSubmit={connecter} noValidate className="pa-form pl-auth">
        <Field label={t('Email')} htmlFor="ad-email-i">
          <Input
            id="ad-email-i"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('Email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <PasswordField
          id="ad-mdp-i"
          label={t('Mot de passe')}
          placeholder={t('Mot de passe')}
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={!!error}
        />
        {error && <AuthError texte={error} />}
        <button type="submit" className="pl-btn pl-btn-ink" disabled={busy}>
          {busy ? t('Connexion…') : t('Se connecter')}
        </button>
      </form>
    </AuthScreen>
  );
}
