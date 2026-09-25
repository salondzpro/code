/**
 * Connexion par e-mail et mot de passe (comme les outils du métier), avec un lien de
 * connexion par e-mail en secours et la réinitialisation du mot de passe. Les actions qui
 * comptent sont de VRAIS boutons, pas des liens discrets : créer un compte, recevoir un lien.
 * Chaque erreur est dite en français et propose la suite (créer un compte, renvoyer le lien).
 * Comptes de DÉMONSTRATION : plus rien ne les annonce à l'écran. Ils s'ouvrent en se connectant
 * normalement, avec l'adresse ET le même mot de passe qu'elle (`pro-homme@`, `pro-femme@`,
 * `client@salondz.com`), puis chacun atterrit dans l'espace qui lui convient. Un visiteur ne peut
 * donc pas tomber dessus, et une démonstration se montre en tapant une seule chose.
 *
 * `landing` : cette même page sert aussi de PAGE D'ACCUEIL (`/intro`, ex-« Intro » + « Bienvenue »
 * fusionnées en une seule — un visiteur non connecté ne peut rien faire d'autre que se connecter,
 * inutile de lui faire cliquer deux écrans avant d'arriver ici). Dans ce mode : bandeau de marque en
 * haut au lieu du bouton retour, rôle toujours client (jamais de reliquat d'un rôle précédent), et
 * « Portail des professionnels » tout en bas — la porte d'entrée pro reste `/pro/bienvenue`.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, Eye, EyeOff, MailOpen, Store, UserPlus } from 'lucide-react';
import { demoAccountFor, demoAccountForCredentials } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow, DESIGN_IMAGES } from '@/lib/authFlow';
import { Button, Field, I, Input, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { LangSwitch } from '@/components/LangSwitch';
import { Wordmark } from '@/components/Wordmark';
import { t } from '@/i18n';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erreur remontée par un lien e-mail (fragment traduit par « Bon retour »). */
const LINK_ERRORS: Record<string, string> = {
  otp_expired: 'Ce lien a expiré ou a déjà servi. Connectez-vous, ou demandez un nouveau lien.',
  access_denied: 'Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.',
  lien: 'Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.',
};

export function Login({ landing }: { landing?: boolean } = {}) {
  const { session, signInWithPassword, sendMagicLink, resendConfirmation, demoLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // La page d'accueil est TOUJOURS le portail client : jamais de rôle ou de destination hérités
  // d'une visite précédente (l'état de authFlow ne survit qu'à la navigation interne, pas au
  // rechargement, mais autant ne dépendre de rien ici — c'est la première porte).
  const role = landing ? 'client' : params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = landing ? '/' : (params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/'));
  const linkErr = params.get('erreur');
  const [email, setEmail] = useState(() => (landing ? '' : (readAuthFlow()?.identifier ?? '')));
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'password' | 'link' | 'resend' | 'demo' | null>(null);
  // Démonstration déjà jouée sur cet appareil : on propose de repartir d'un monde neuf.
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(
    linkErr ? { kind: 'expired', text: LINK_ERRORS[linkErr] ?? LINK_ERRORS.lien! } : null,
  );

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  const id = () => email.trim().toLowerCase();
  const fail = (err: unknown) => setError(describeAuthError(err));

  /** Compte de démonstration : session ouverte directement, sans mot de passe. */
  const demo = async (identifier: string) => {
    const acct = demoAccountFor(identifier);
    if (!acct) return;
    setError(null);
    setBusy('demo');
    try {
      const dest = acct.role === 'pro' ? '/pro' : '/';
      writeAuthFlow({ role: acct.role, next: dest, identifier: acct.email, channel: 'email' });
      await demoLogin(acct.email);
      navigate(`/connexion/retour?next=${encodeURIComponent(dest)}`, { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Démonstration : adresse ET mot de passe identiques (pro-homme@, pro-femme@, client@). Rien
    // ne l'annonce à l'écran — on se connecte normalement, et l'espace qui convient s'ouvre.
    if (demoAccountForCredentials(id(), password)) return demo(id());
    if (!EMAIL_RE.test(id())) return setError({ kind: 'form', text: t("Adresse e-mail invalide.") });
    if (!password) return setError({ kind: 'form', text: t("Saisissez votre mot de passe.") });
    setError(null);
    setBusy('password');
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email' });
      await signInWithPassword(id(), password);
      navigate(`/connexion/retour?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const link = async () => {
    if (!EMAIL_RE.test(id())) return setError({ kind: 'form', text: t("Indiquez votre adresse e-mail pour recevoir le lien.") });
    setError(null);
    setBusy('link');
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email', sentAt: Date.now() });
      await sendMagicLink(id(), next);
      navigate('/connexion/envoye?mode=link');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy('resend');
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email', sentAt: Date.now() });
      await resendConfirmation(id(), next);
      navigate('/connexion/envoye?mode=confirm');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      {landing ? (
        <div className="relative -mx-4 -mt-3 h-[11rem] flex-none overflow-hidden">
          <img src={DESIGN_IMAGES.intro.src} alt="" className="h-full w-full object-cover" />
          <div className="ovl" />
          <div className="ovl-t !pb-3">
            <div className="text-[1.429rem] font-bold leading-[1.1] tracking-[-0.6px]">{t("Réservez votre rendez-vous.")}</div>
          </div>
          <span className="absolute start-3 top-3 rounded-[var(--radius-card-sm)] bg-black/45 px-1.5 py-0.5 text-[0.857rem] text-white/80">{DESIGN_IMAGES.intro.credit}</span>
          <LangSwitch className="absolute end-3 top-3" />
        </div>
      ) : (
        <TopBar backTo={role === 'pro' ? '/pro/bienvenue' : undefined} noBack={role !== 'pro'} />
      )}
      {/* La marque ouvre toute page de connexion, côté client comme côté professionnel : c'est la
          première chose que voit quelqu'un qui installe l'application, elle doit dire chez qui il est. */}
      <div className="flex justify-center pt-1">
        <Wordmark size={1.714} />
      </div>
      <div>
        <h1 className="h1">{role === 'pro' ? 'Espace professionnel' : 'Connexion'}</h1>
        <p className="p mt-2">
          {role === 'pro' ? 'Retrouvez votre agenda et vos réservations.' : 'Retrouvez vos rendez-vous et réservez en quelques secondes.'}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label={t("E-mail")} htmlFor="login-email">
          <Input
            id="login-email"
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
            err={error?.kind === 'email' || error?.kind === 'no_account'}
            autoFocus
          />
        </Field>
        <Field label={t("Mot de passe")} htmlFor="login-password">
          <div className="relative">
            <Input
              id="login-password"
              lg
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t("Votre mot de passe")}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              err={error?.kind === 'credentials'}
              className="!pe-12"
            />
            <button
              type="button"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted"
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
            {/* La suite logique de l'erreur, à portée de pouce. */}
            {error.kind === 'no_account' && (
              <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                <I icon={UserPlus} size={16} /> {t("Créer un compte avec cette adresse")}
              </Link>
            )}
            {error.kind === 'unconfirmed' && (
              <Button sm variant="g" onClick={() => void resend()} disabled={busy !== null}>
                {busy === 'resend' ? 'Envoi…' : 'Renvoyer le lien de confirmation'}
              </Button>
            )}
            {error.kind === 'credentials' && (
              <Link to={`/connexion/oubli?email=${encodeURIComponent(email.trim())}`} className="btn g sm">
                {t("Réinitialiser mon mot de passe")}
              </Link>
            )}
          </div>
        )}
        <Button type="submit" disabled={busy !== null}>
          {busy === 'password' ? 'Connexion…' : 'Se connecter'}
        </Button>
        <Link
          to={`/connexion/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
          className="py-1 text-center text-[1rem] font-semibold underline"
        >
          {t("Mot de passe oublié ?")}
        </Link>
      </form>

      <div className="flex items-center gap-3 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
        <span className="h-px flex-1 bg-line" /> {t("ou")}{' '}<span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="g" onClick={() => void link()} disabled={busy !== null}>
        <I icon={MailOpen} size={18} /> {busy === 'link' ? 'Envoi…' : 'Recevoir un lien de connexion par e-mail'}
      </Button>

      {/* Plus aucune mention de la démonstration à l'écran : elle s'ouvre en se connectant
          normalement avec une adresse de démonstration et le même mot de passe. */}

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <p className="p text-center">{t("Pas encore de compte ?")}</p>
        <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn g !border-ink">
          <I icon={UserPlus} size={18} /> {role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}
        </Link>
        {landing && (
          <Link to="/pro/bienvenue" className="mt-2 flex items-center justify-center gap-2 border-t border-line pt-5 text-[1rem] font-semibold underline">
            <I icon={Store} size={18} /> {t("Portail des professionnels")}
          </Link>
        )}
      </div>
    </Screen>
  );
}
