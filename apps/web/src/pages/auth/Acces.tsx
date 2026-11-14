/**
 * ACCÈS EN UN SEUL CHEMIN, PRO (13 nov. 2026, maquette validée) ET CLIENT (14 nov. 2026, même parcours) :
 * `/pro/acces/*` pour les professionnels, `/acces/*` pour les clientes. Canevas « Salon DZ Pro —
 * ouverture et connexion ».
 *
 *   /pro/acces               « Quelle est votre adresse e-mail ? » — l'adresse D'ABORD, comme les
 *                            grands services. `POST /auth/email-check` dit la suite :
 *                              compte pro      → /pro/acces/mot-de-passe
 *                              adresse libre   → /pro/acces/creer
 *                              compte client   → message sur place (une adresse = un rôle)
 *                              inscription en cours → message + renvoi du lien
 *   /pro/acces/mot-de-passe  « Bon retour » : mot de passe, ou lien de connexion par e-mail
 *   /pro/acces/creer         « Créez votre mot de passe » : UN champ avec l'œil pour l'afficher
 *                            (la confirmation tapée deux fois a sauté)
 *   /pro/acces/envoye        « Vérifiez votre boîte mail » : bouton au logo de SA messagerie
 *   /pro/acces/oubli         « Mot de passe oublié »
 *
 * Plus de choix « Se connecter / Créer un compte » à faire avant d'avoir commencé : c'est l'adresse
 * qui décide. Les anciennes portes pro (`/connexion?role=pro`, `/inscription?role=pro`) mènent ici.
 * Le serveur refait tous les contrôles : l'écran oriente, il ne protège pas.
 */
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Check, MailCheck } from 'lucide-react';
import { demoAccountFor, demoAccountForCredentials, isDemoEmail } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { api } from '@/lib/api';
import { Button, Field, I, Input, LinkButton } from '@/components/ui';
import { AuthError, PasswordField } from '@/components/AuthShell';
import { MailAppButton, AuthScreen } from '@/components/AuthKit';
import { isNative } from '@/lib/native';
import { EMAIL_RE } from './Login';
import { PASSWORD_MIN } from './SignUp';
import { t } from '@/i18n';

type Err = { kind: AuthErrorKind | 'form'; text: string } | null;

/**
 * LE MÊME PARCOURS POUR LES DEUX PORTAILS (14 nov. 2026) : l'espace pro (`/pro/acces/*`) et l'espace
 * client (`/acces/*`) partagent ces écrans ; seuls changent le rôle, la base des adresses, la porte
 * d'ouverture et quelques phrases. Le rôle se lit dans l'adresse de la page.
 */
function usePortail() {
  const pro = useLocation().pathname.startsWith('/pro/');
  return {
    role: (pro ? 'pro' : 'client') as 'pro' | 'client',
    base: pro ? '/pro/acces' : '/acces',
    ouverture: isNative() ? (pro ? '/pro/bienvenue' : '/intro') : pro ? '/professionnels' : '/home',
    defaut: pro ? '/pro' : '/',
  };
}

/** Où aller une fois entré, et l'adresse en cours : lus dans l'adresse, puis dans le parcours. */
function useParcours() {
  const [params] = useSearchParams();
  const { role, base, ouverture, defaut } = usePortail();
  const flow = readAuthFlow();
  const next = params.get('next') ?? (flow?.role === role ? flow.next : null) ?? defaut;
  const email = (params.get('email') ?? (flow?.role === role ? flow.identifier : '') ?? '').trim().toLowerCase();
  const q = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ next, ...extra });
    return `?${p.toString()}`;
  };
  return { next, email, q, role, base, ouverture };
}

const retour = (next: string) => `/connexion/retour?next=${encodeURIComponent(next)}`;

/* -------------------------------------------------------------------- 1. Adresse e-mail */

export function AccesEmail() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q, role, base, ouverture } = useParcours();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(() =>
    params.get('erreur') ? { kind: 'expired', text: t('Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.') } : null,
  );

  if (session) return <Navigate to={retour(next)} replace />;

  const id = () => email.trim().toLowerCase();

  const continuer = async (e: FormEvent) => {
    e.preventDefault();
    const adresse = id();
    if (!EMAIL_RE.test(adresse)) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    setError(null);
    writeAuthFlow({ role, next, identifier: adresse, channel: 'email' });
    // Démonstration : elle s'ouvre par le mot de passe, sans interroger le serveur.
    if (isDemoEmail(adresse)) return navigate(`${base}/mot-de-passe${q({ email: adresse })}`);
    setBusy(true);
    try {
      // ADRESSE CONNUE = MOT DE PASSE, quel que soit le portail (14 nov. 2026, demande du
      // propriétaire) : plus d'alerte « cette adresse sert déjà à un compte client / pro », qui
      // perdait les gens. Le compte s'ouvre ensuite dans SON espace. Adresse inconnue = inscription.
      // Inscription jamais confirmée : le mot de passe aussi — la connexion le dira et proposera
      // de renvoyer le lien.
      const { status } = await api.auth.emailCheck({ email: adresse, role });
      if (status === 'available') navigate(`${base}/creer${q({ email: adresse })}`);
      else navigate(`${base}/mot-de-passe${q({ email: adresse })}`);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      back={ouverture}
      titre={t('Quelle est votre adresse e-mail ?')}
      sous={role === 'pro' ? t('Pour vous connecter, ou créer votre espace si c’est votre première fois.') : t('Pour vous connecter, ou créer votre compte si c’est votre première fois.')}
      actions={
        <Button icon={ICONE.continuer} type="submit" form="pa-email" loading={busy} disabled={busy}>
          {t('Continuer')}
        </Button>
      }
    >
      <form id="pa-email" onSubmit={continuer} noValidate className="pa-form">
        <Field label={t('Adresse e-mail')} htmlFor="pa-email-i">
          <Input
            id="pa-email-i"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={t('nom@exemple.com')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={!!error}
          />
        </Field>
        {error && <AuthError texte={error.text} />}
      </form>
    </AuthScreen>
  );
}

/* -------------------------------------------------------------------- 2a. Compte existant */

export function AccesMotDePasse() {
  const { session, signInWithPassword, sendMagicLink, resendConfirmation, demoLogin } = useAuth();
  const navigate = useNavigate();
  const { next, email, q, role, base } = useParcours();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | 'resend' | null>(null);
  const [error, setError] = useState<Err>(null);
  // Voir `Login.tsx` : une référence, pour que la redirection de session n'arrive pas avant le
  // contrôle du portail.
  const enCours = useRef(false);

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={`${base}${q()}`} replace />;

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    const demo = demoAccountForCredentials(email, password);
    setError(null);
    if (demo) {
      setBusy('password');
      try {
        writeAuthFlow({ role: demo.role, next: demo.role === 'pro' ? '/pro' : '/', identifier: demo.email, channel: 'email' });
        await demoLogin(demo.email);
        navigate(retour(demo.role === 'pro' ? '/pro' : '/'), { replace: true });
      } catch (err) {
        setError(describeAuthError(err));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!password) return setError({ kind: 'form', text: t('Saisissez votre mot de passe.') });
    setBusy('password');
    enCours.current = true;
    try {
      writeAuthFlow({ role, next, identifier: email, channel: 'email' });
      await signInWithPassword(email, password);
      // Le compte s'ouvre dans SON espace, quel que soit le portail par lequel on est passé : un
      // professionnel entré par le portail client arrive sur son accueil pro, et l'inverse. Plus de
      // refus ni de déconnexion (14 nov. 2026).
      let dest = next;
      try {
        const { profile } = await api.me.get();
        if (profile.role === 'pro' && !next.startsWith('/pro')) dest = '/pro';
        else if (profile.role !== 'pro' && next.startsWith('/pro')) dest = '/';
        if (profile.role !== role) writeAuthFlow({ role: profile.role === 'pro' ? 'pro' : 'client', next: dest });
      } catch {
        // Profil illisible (réseau) : on entre, les gardes trancheront.
      }
      navigate(retour(dest), { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      enCours.current = false;
      setBusy(null);
    }
  };

  const lien = async () => {
    setBusy('link');
    setError(null);
    try {
      writeAuthFlow({ role, next, identifier: email, channel: 'email', sentAt: Date.now() });
      await sendMagicLink(email, next);
      navigate(`${base}/envoye?mode=link`);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const renvoyer = async () => {
    setBusy('resend');
    try {
      writeAuthFlow({ role, next, identifier: email, channel: 'email', sentAt: Date.now() });
      await resendConfirmation(email, next);
      navigate(`${base}/envoye?mode=confirm`);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const demo = demoAccountFor(email);

  return (
    <AuthScreen
      back={`${base}${q({ email })}`}
      titre={t('Bon retour')}
      sous={t('Entrez votre mot de passe pour ouvrir votre espace.')}
      actions={
        <>
          <Button icon={ICONE.seConnecter} type="submit" form="pa-mdp" loading={busy === 'password'} disabled={busy !== null}>
            {t('Se connecter')}
          </Button>
          {!demo && (
            <Button icon={ICONE.recevoirLien} variant="g" loading={busy === 'link'} disabled={busy !== null} onClick={() => void lien()}>
              {t('Recevoir un lien de connexion')}
            </Button>
          )}
        </>
      }
    >
      <CompteCarte email={email} modifier={`${base}${q({ email })}`} />
      <form id="pa-mdp" onSubmit={connecter} noValidate className="pa-form">
        <PasswordField
          id="pa-mdp-i"
          label={t('Mot de passe')}
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'credentials'}
        />
        <Link to={`${base}/oubli${q({ email })}`} className="pa-lien">
          {t('Mot de passe oublié ?')}
        </Link>
        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'unconfirmed' && (
              <Button icon={ICONE.renvoyer} sm variant="g" loading={busy === 'resend'} onClick={() => void renvoyer()} disabled={busy !== null}>
                {t('Renvoyer le lien de confirmation')}
              </Button>
            )}
            {error.kind === 'credentials' && (
              <LinkButton to={`${base}/oubli${q({ email })}`} variant="g" sm icon={ICONE.motDePasse}>
                {t('Réinitialiser mon mot de passe')}
              </LinkButton>
            )}
          </AuthError>
        )}
      </form>
    </AuthScreen>
  );
}

/** L'adresse en cours, avec « Modifier » : c'est la seule façon de voir qu'on l'a mal tapée. */
function CompteCarte({ email, modifier }: { email: string; modifier: string }) {
  return (
    <div className="pa-compte">
      <span className="pa-compte-av" aria-hidden>
        {email.charAt(0).toUpperCase()}
      </span>
      <span className="pa-compte-e" dir="ltr">
        {email}
      </span>
      <Link to={modifier} className="pa-compte-m">
        {t('Modifier')}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------- 2b. Nouveau compte */

export function AccesCreer() {
  const { session, signUpWithPassword } = useAuth();
  const navigate = useNavigate();
  const { next, email, q, role, base } = useParcours();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);

  if (session) return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={`${base}${q()}`} replace />;

  const assez = password.length >= PASSWORD_MIN;

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (!assez) return setError({ kind: 'password', text: t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }) });
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: email, channel: 'email', sentAt: Date.now() });
      const ouverte = await signUpWithPassword(email, password, role, next);
      if (ouverte) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(`${base}/envoye?mode=confirm`, { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      back={`${base}${q({ email })}`}
      titre={t('Créez votre mot de passe')}
      sous={t('C’est votre première fois. Choisissez un mot de passe, puis nous vous envoyons un lien de confirmation.')}
      actions={
        <>
          <Button icon={role === 'pro' ? ICONE.creerEspace : ICONE.creerCompte} type="submit" form="pa-creer" loading={busy} disabled={busy}>
            {role === 'pro' ? t('Créer mon espace') : t('Créer mon compte')}
          </Button>
          <p className="pa-note">
            {role === 'pro' ? t('En créant votre espace, vous acceptez les') : t('En créant votre compte, vous acceptez les')}{' '}
            <Link to="/cgu">{t('conditions d’utilisation')}</Link>.
          </p>
        </>
      }
    >
      <div className="pa-puce">
        <span dir="ltr">{email}</span>
        <Link to={`${base}${q({ email })}`}>{t('Modifier')}</Link>
      </div>
      <form id="pa-creer" onSubmit={creer} noValidate className="pa-form">
        <PasswordField
          id="pa-creer-i"
          label={t('Mot de passe')}
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'password'}
        />
        <p className={`pa-regle ${assez ? 'ok' : ''}`}>
          <span className="pa-regle-r" aria-hidden>
            {assez && <I icon={Check} size={11} strokeWidth={3} />}
          </span>
          {t('{n} caractères au minimum', { n: PASSWORD_MIN })}
        </p>
        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'exists' && (
              <LinkButton to={`${base}/mot-de-passe${q({ email })}`} sm icon={ICONE.seConnecter}>
                {t('Se connecter')}
              </LinkButton>
            )}
          </AuthError>
        )}
      </form>
    </AuthScreen>
  );
}

/* -------------------------------------------------------------------- 3. Vérifier l'e-mail */

const RENVOI_S = 60;
type Mode = 'confirm' | 'link' | 'reset';

const TEXTES: Record<Mode, { titre: string; sous: string }> = {
  confirm: { titre: 'Vérifiez votre boîte mail', sous: 'Touchez le lien reçu pour ouvrir votre espace.' },
  link: { titre: 'Lien de connexion envoyé', sous: 'Touchez le lien reçu pour vous connecter.' },
  reset: { titre: 'Vérifiez votre boîte mail', sous: 'Touchez le lien reçu pour choisir un nouveau mot de passe.' },
};

export function AccesEnvoye() {
  const { session, resendConfirmation, sendMagicLink, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const flow = readAuthFlow();
  const { base, defaut } = usePortail();
  const mode = (['confirm', 'link', 'reset'].includes(params.get('mode') ?? '') ? params.get('mode') : 'confirm') as Mode;
  const email = flow?.identifier ?? '';
  const next = flow?.next ?? defaut;
  const [dans, setDans] = useState(() => Math.max(0, RENVOI_S - Math.floor((Date.now() - (flow?.sentAt ?? 0)) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dans <= 0) return;
    const id = window.setInterval(() => setDans((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [dans]);

  // Le lien a été ouvert dans cet onglet : la session existe, on continue.
  if (session && mode !== 'reset') return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={base} replace />;

  const renvoyer = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'confirm') await resendConfirmation(email, next);
      else if (mode === 'link') await sendMagicLink(email, next);
      else await sendPasswordReset(email);
      writeAuthFlow({ sentAt: Date.now() });
      setDans(RENVOI_S);
    } catch (err) {
      setError(describeAuthError(err).text);
    } finally {
      setBusy(false);
    }
  };

  const minutes = `${Math.floor(dans / 60)}:${String(dans % 60).padStart(2, '0')}`;
  const txt = TEXTES[mode];

  return (
    <AuthScreen
      back={base}
      haut={
        <span className="pa-rond" aria-hidden>
          <I icon={MailCheck} size={34} strokeWidth={1.5} />
        </span>
      }
      titre={t(txt.titre)}
      sous={
        <>
          {t('Envoyé à')}{' '}
          <b dir="ltr">{email}</b>. {t(txt.sous)}
        </>
      }
      actions={
        <>
          <MailAppButton email={email} />
          <Button icon={ICONE.renvoyer} variant="g" loading={busy} disabled={busy || dans > 0} onClick={() => void renvoyer()}>
            {dans > 0 ? t('Renvoyer le lien dans {temps}', { temps: minutes }) : t('Renvoyer le lien')}
          </Button>
          <button type="button" className="pa-lien centre" onClick={() => navigate(base)}>
            {t('Changer d’adresse')}
          </button>
        </>
      }
    >
      <p className="pa-note centre">{t('Rien reçu ? Regardez dans les courriers indésirables.')}</p>
      {error && <AuthError texte={error} />}
    </AuthScreen>
  );
}

/* -------------------------------------------------------------------- Mot de passe oublié */

export function AccesOubli() {
  const { sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q, role, base } = useParcours();
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError(t('Adresse e-mail invalide.'));
    setBusy(true);
    setError(null);
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email', sentAt: Date.now() });
      await sendPasswordReset(id);
      navigate(`${base}/envoye?mode=reset`, { replace: true });
    } catch (err) {
      setError(describeAuthError(err).text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      back={initial ? `${base}/mot-de-passe${q({ email: initial })}` : base}
      titre={t('Mot de passe oublié')}
      sous={t('Nous vous envoyons un lien pour en choisir un nouveau.')}
      actions={
        <Button icon={ICONE.envoyer} type="submit" form="pa-oubli" loading={busy} disabled={busy}>
          {t('Envoyer le lien')}
        </Button>
      }
    >
      <form id="pa-oubli" onSubmit={envoyer} noValidate className="pa-form">
        <Field label={t('Adresse e-mail')} htmlFor="pa-oubli-i">
          <Input
            id="pa-oubli-i"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('nom@exemple.com')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={!!error}
          />
        </Field>
        {error && <AuthError texte={error} />}
      </form>
    </AuthScreen>
  );
}
