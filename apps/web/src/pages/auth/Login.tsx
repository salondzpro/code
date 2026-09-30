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
  // Le portail est TOUJOURS celui du client : jamais de rôle hérité d'une visite précédente
  // (l'état de authFlow ne survit pas au rechargement, mais autant ne dépendre de rien ici —
  // c'est la première porte). En revanche, une DESTINATION passée explicitement est respectée :
  // quelqu'un renvoyé ici depuis « Mes favoris » doit y retourner une fois connecté.
  const role = landing ? 'client' : params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = landing ? (params.get('next') ?? '/') : (params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/'));
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

  /**
   * UNE SEULE PORTE D'ENTRÉE. `/connexion` et `/intro` servaient le même écran sous deux allures,
   * et l'on pouvait donc atterrir tantôt sur l'un, tantôt sur l'autre selon d'où l'on venait.
   * `/connexion` renvoie désormais sur le portail, en gardant la destination visée. Seule
   * exception, la porte PROFESSIONNELLE (`?role=pro`), qui vient de `/pro/bienvenue` et garde son
   * retour vers cette page.
   */
  if (!landing && params.get('role') !== 'pro') {
    const q = params.toString();
    return <Navigate to={`/intro${q ? `?${q}` : ''}`} replace />;
  }

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
    <Screen className="h-app" gap={12}>
      {/**
       * BANDEAU DE MARQUE COMPACT. L'écran tenait sur une page et demie : entre la photo de
       * 11 rem, le logo sur sa propre rangée, un séparateur « ou » et deux intitulés de section,
       * il fallait défiler pour atteindre « Créer un compte ». Photo et logo sont désormais UN
       * seul bloc de 7 rem — la marque est toujours la première chose qu'on voit, elle ne coûte
       * plus un tiers de l'écran.
       */}
      {landing ? (
        <div className="relative -mx-4 -mt-3 h-[7rem] flex-none overflow-hidden">
          <img src={DESIGN_IMAGES.intro.src} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ink/55" />
          {/* Une vraie rangée d'en-tête : marque à gauche, langues à droite, sur la même ligne.
              Centrer la marque la faisait buter contre le sélecteur dès 360 px de large. */}
          <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
            <Wordmark size={1.571} light />
            <LangSwitch />
          </div>
          <span className="absolute bottom-2.5 start-4 text-[0.75rem] text-white/45">{DESIGN_IMAGES.intro.credit}</span>
        </div>
      ) : (
        <>
          <TopBar backTo={role === 'pro' ? '/pro/bienvenue' : undefined} noBack={role !== 'pro'} />
          {/* Hors portail (arrivée par un lien), la marque garde sa rangée : il n'y a pas de photo. */}
          <div className="flex justify-center">
            <Wordmark size={1.714} />
          </div>
        </>
      )}
      <div>
        <h1 className="h1">{role === 'pro' ? 'Espace professionnel' : 'Connexion'}</h1>
        <p className="p mt-1">
          {role === 'pro' ? 'Retrouvez votre agenda et vos réservations.' : 'Vos rendez-vous, en quelques secondes.'}
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
        <Field
          label={t("Mot de passe")}
          htmlFor="login-password"
          action={
            <Link
              to={`/connexion/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="text-[0.875rem] font-semibold underline"
            >
              {t("Mot de passe oublié ?")}
            </Link>
          }
        >
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
      </form>

      {/**
       * Les trois autres portes, groupées, sans intitulé ni séparateur : « ou », « Pas encore de
       * compte ? » et un trait de séparation coûtaient trois rangées pour ne rien dire que les
       * boutons ne disent déjà. Elles restent de VRAIS boutons — créer un compte et recevoir un
       * lien ne sont pas des détails qu'on cache dans un lien discret.
       *
       * Plus aucune mention de la démonstration : elle s'ouvre en se connectant normalement avec
       * une adresse de démonstration et le même mot de passe.
       */}
      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn g !border-ink">
          <I icon={UserPlus} size={18} /> {role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}
        </Link>
        <Button variant="g" onClick={() => void link()} disabled={busy !== null}>
          <I icon={MailOpen} size={18} /> {busy === 'link' ? 'Envoi…' : 'Recevoir un lien par e-mail'}
        </Button>
        {landing && (
          <Link to="/pro/bienvenue" className="flex items-center justify-center gap-2 pt-1 text-[1rem] font-semibold underline">
            <I icon={Store} size={18} /> {t("Portail des professionnels")}
          </Link>
        )}
      </div>
    </Screen>
  );
}
