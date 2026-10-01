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
 * UNE SEULE PORTE D'ENTRÉE : `/intro`. `/connexion` y renvoie en gardant la destination visée, et
 * toute déconnexion y ramène. Seule exception, la porte PROFESSIONNELLE (`?role=pro`), qui vient de
 * `/pro/bienvenue` et garde son bouton retour vers cette page.
 *
 * L'écran tient SANS DÉFILEMENT, y compris sur un petit téléphone (360×740) : c'est une contrainte,
 * pas un constat. Toute addition ici doit être mesurée — le portail est la première chose que voit
 * quelqu'un qui installe l'application, et il ne doit rien cacher sous la ligne de flottaison.
 * Le lien de connexion par e-mail a SA page (`/connexion/lien`) : il a besoin de son propre champ.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { MailOpen, Store, UserPlus } from 'lucide-react';
import { demoAccountFor, demoAccountForCredentials } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input } from '@/components/ui';
import { AuthError, AuthShell, PasswordField } from '@/components/AuthShell';
import { HOME, PRO_ONLY } from '@/lib/flavor';
import { api } from '@/lib/api';
import { t } from '@/i18n';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erreur remontée par un lien e-mail (fragment traduit par « Bon retour »). */
const LINK_ERRORS: Record<string, string> = {
  otp_expired: 'Ce lien a expiré ou a déjà servi. Connectez-vous, ou demandez un nouveau lien.',
  access_denied: 'Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.',
  lien: 'Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.',
};

export function Login({ landing }: { landing?: boolean } = {}) {
  const { session, signInWithPassword, resendConfirmation, demoLogin, signOut } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Le portail est TOUJOURS celui du client : jamais de rôle hérité d'une visite précédente
  // (l'état de authFlow ne survit pas au rechargement, mais autant ne dépendre de rien ici —
  // c'est la première porte). En revanche, une DESTINATION passée explicitement est respectée :
  // quelqu'un renvoyé ici depuis « Mes favoris » doit y retourner une fois connecté.
  const role = PRO_ONLY ? 'pro' : landing ? 'client' : params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = landing ? (params.get('next') ?? HOME) : (params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/'));
  const linkErr = params.get('erreur');
  const [email, setEmail] = useState(() => (landing ? '' : (readAuthFlow()?.identifier ?? '')));
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'password' | 'resend' | 'demo' | null>(null);
  /**
   * Connexion en cours. UNE RÉFÉRENCE, pas un état : React regroupe les mises à jour, et l'état
   * de session changeait parfois AVANT que `busy` ne soit commité — la redirection partait alors
   * en pleine vérification, et le compte du mauvais portail entrait quand même, une fois sur deux.
   * Une référence s'écrit tout de suite.
   */
  const connexionEnCours = useRef(false);
  // Démonstration déjà jouée sur cet appareil : on propose de repartir d'un monde neuf.
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(
    linkErr ? { kind: 'expired', text: LINK_ERRORS[linkErr] ?? LINK_ERRORS.lien! } : null,
  );

  /**
   * Session déjà ouverte : on entre. MAIS pas pendant qu'une connexion est en cours — le contrôle
   * du portail a besoin de la session pour lire le rôle, et cette redirection, pilotée par l'état
   * de session, se déclenchait AVANT lui. Le compte du mauvais portail entrait quand même.
   */
  if (session && !connexionEnCours.current) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

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

  /**
   * UN COMPTE APPARTIENT À UN PORTAIL. Le mot de passe peut être juste et l'accès refusé : un
   * compte professionnel ne s'ouvre pas sur le portail client, et réciproquement. Sans ce
   * contrôle, se connecter au mauvais endroit « marchait », puis le garde renvoyait aussitôt vers
   * l'autre espace — on croyait à un bug plutôt qu'à une règle.
   *
   * Le contrôle se fait APRÈS la connexion : c'est la seule façon de connaître le rôle. On referme
   * donc la session ouverte à tort, pour ne laisser personne à moitié connecté.
   */
  const portailCorrect = async (): Promise<boolean> => {
    try {
      const { profile } = await api.me.get();
      if (profile.role === role) return true;
      await signOut();
      setError({
        kind: 'wrong_portal',
        text:
          role === 'pro'
            ? t('Ce compte n’est pas un compte professionnel. Créez un espace pro avec une autre adresse.')
            : t('Ce compte est un compte professionnel. Créez un compte client avec une autre adresse.'),
      });
      return false;
    } catch {
      // Profil illisible (réseau) : on n'invente pas un refus. Les gardes trancheront à l'entrée.
      return true;
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
    connexionEnCours.current = true;
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email' });
      await signInWithPassword(id(), password);
      if (!(await portailCorrect())) return;
      navigate(`/connexion/retour?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      connexionEnCours.current = false;
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
    <AuthShell
      role={role}
      back={landing ? undefined : role === 'pro' ? '/pro/bienvenue' : '/home'}
      titre={role === 'pro' ? 'Espace professionnel' : 'Connexion'}
      sous={
        role === 'pro'
          ? t('Retrouvez votre agenda, vos réservations et votre page.')
          : t('Vos rendez-vous et vos salons favoris, en quelques secondes.')
      }
      pied={
        <>
          <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn g !border-ink">
            <I icon={UserPlus} size={18} /> {role === 'pro' ? t('Créer mon espace pro') : t('Créer un compte')}
          </Link>
          {/* Vers sa PAGE, avec son champ : quelqu'un qui vient ici pour éviter le mot de passe
              n'a pas forcément rempli le formulaire au-dessus. L'adresse déjà tapée est emportée. */}
          <Link
            to={`/connexion/lien?role=${role}&next=${encodeURIComponent(next)}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ''}`}
            className="btn g"
          >
            <I icon={MailOpen} size={18} /> {t('Recevoir un lien par e-mail')}
          </Link>
          {landing && !PRO_ONLY && (
            <Link
              to="/pro/bienvenue"
              className="flex items-center justify-center gap-2 pt-2 text-[1rem] font-semibold underline underline-offset-2"
            >
              <I icon={Store} size={18} /> {t('Portail des professionnels')}
            </Link>
          )}
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t('E-mail')} htmlFor="login-email">
          <Input
            id="login-email"
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
            err={error?.kind === 'email' || error?.kind === 'no_account'}
            autoFocus
          />
        </Field>
        <PasswordField
          id="login-password"
          label={t('Mot de passe')}
          autoComplete="current-password"
          placeholder={t('Votre mot de passe')}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'credentials'}
          action={
            <Link
              to={`/connexion/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="text-[0.875rem] font-semibold underline underline-offset-2"
            >
              {t('Mot de passe oublié ?')}
            </Link>
          }
        />
        {error && (
          <AuthError texte={error.text}>
            {/* La suite logique de l'erreur, à portée de pouce. */}
            {error.kind === 'no_account' && (
              <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                <I icon={UserPlus} size={16} /> {t('Créer un compte avec cette adresse')}
              </Link>
            )}
            {error.kind === 'unconfirmed' && (
              <Button sm variant="g" loading={busy === 'resend'} onClick={() => void resend()} disabled={busy !== null}>
                {t('Renvoyer le lien de confirmation')}
              </Button>
            )}
            {error.kind === 'wrong_portal' && (
              <Link to={`/inscription?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                <I icon={UserPlus} size={16} /> {role === 'pro' ? t('Créer un espace professionnel') : t('Créer un compte client')}
              </Link>
            )}
            {error.kind === 'credentials' && (
              <Link to={`/connexion/oubli?email=${encodeURIComponent(email.trim())}`} className="btn g sm">
                {t('Réinitialiser mon mot de passe')}
              </Link>
            )}
          </AuthError>
        )}
        <Button type="submit" loading={busy === 'password' || busy === 'demo'} disabled={busy !== null}>
          {t('Se connecter')}
        </Button>
      </form>
    </AuthShell>
  );
}
