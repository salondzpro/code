/**
 * ACCÈS PROFESSIONNEL EN UN SEUL CHEMIN (13 nov. 2026, maquette validée par le propriétaire :
 * canevas « Salon DZ Pro — ouverture et connexion »).
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
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Check, MailCheck } from 'lucide-react';
import { demoAccountFor, demoAccountForCredentials, isDemoEmail } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { api } from '@/lib/api';
import { Button, Field, I, Input, LinkButton } from '@/components/ui';
import { AuthError, PasswordField } from '@/components/AuthShell';
import { MailAppButton, ProAuthScreen } from '@/components/ProAuthKit';
import { EMAIL_RE } from '@/pages/auth/Login';
import { PASSWORD_MIN } from '@/pages/auth/SignUp';
import { t } from '@/i18n';

type Err = { kind: AuthErrorKind | 'form' | 'client' | 'pending'; text: string } | null;

/** Où aller une fois entré, et l'adresse en cours : lus dans l'adresse, puis dans le parcours. */
function useParcours() {
  const [params] = useSearchParams();
  const flow = readAuthFlow();
  const next = params.get('next') ?? (flow?.role === 'pro' ? flow.next : null) ?? '/pro';
  const email = (params.get('email') ?? (flow?.role === 'pro' ? flow.identifier : '') ?? '').trim().toLowerCase();
  const q = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ next, ...extra });
    return `?${p.toString()}`;
  };
  return { next, email, q };
}

const retour = (next: string) => `/connexion/retour?next=${encodeURIComponent(next)}`;

/* -------------------------------------------------------------------- 1. Adresse e-mail */

export function ProAccesEmail() {
  const { session, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q } = useParcours();
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);

  if (session) return <Navigate to={retour(next)} replace />;

  const id = () => email.trim().toLowerCase();

  const continuer = async (e: FormEvent) => {
    e.preventDefault();
    const adresse = id();
    if (!EMAIL_RE.test(adresse)) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    setError(null);
    writeAuthFlow({ role: 'pro', next, identifier: adresse, channel: 'email' });
    // Démonstration : elle s'ouvre par le mot de passe, sans interroger le serveur.
    if (isDemoEmail(adresse)) return navigate(`/pro/acces/mot-de-passe${q({ email: adresse })}`);
    setBusy(true);
    try {
      const { status } = await api.auth.emailCheck({ email: adresse, role: 'pro' });
      if (status === 'pro') navigate(`/pro/acces/mot-de-passe${q({ email: adresse })}`);
      else if (status === 'available') navigate(`/pro/acces/creer${q({ email: adresse })}`);
      else if (status === 'client')
        setError({ kind: 'client', text: t('Cette adresse sert déjà à un compte client. Pour votre salon, utilisez une autre adresse.') });
      else setError({ kind: 'pending', text: t('Une inscription est déjà en cours avec cette adresse : ouvrez le lien de confirmation reçu par e-mail.') });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const renvoyer = async () => {
    setBusy(true);
    try {
      writeAuthFlow({ role: 'pro', next, identifier: id(), channel: 'email', sentAt: Date.now() });
      await resendConfirmation(id(), next);
      navigate('/pro/acces/envoye?mode=confirm');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProAuthScreen
      back="/pro/bienvenue"
      titre={t('Quelle est votre adresse e-mail ?')}
      sous={t('Pour vous connecter, ou créer votre espace si c’est votre première fois.')}
      actions={
        <>
          <Button icon={ICONE.continuer} type="submit" form="pa-email" loading={busy} disabled={busy}>
            {t('Continuer')}
          </Button>
          <p className="pa-note">{t('Nous vérifions si un espace existe déjà pour cette adresse.')}</p>
        </>
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
        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'client' && (
              <Button variant="g" sm icon={ICONE.autreAdresse} onClick={() => (setEmail(''), setError(null))}>
                {t('Utiliser une autre adresse')}
              </Button>
            )}
            {error.kind === 'pending' && (
              <Button icon={ICONE.renvoyer} sm variant="g" loading={busy} onClick={() => void renvoyer()}>
                {t('Renvoyer le lien de confirmation')}
              </Button>
            )}
          </AuthError>
        )}
      </form>
    </ProAuthScreen>
  );
}

/* -------------------------------------------------------------------- 2a. Compte existant */

export function ProAccesMotDePasse() {
  const { session, signInWithPassword, sendMagicLink, resendConfirmation, demoLogin, signOut } = useAuth();
  const navigate = useNavigate();
  const { next, email, q } = useParcours();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | 'resend' | null>(null);
  const [error, setError] = useState<Err>(null);
  // Voir `Login.tsx` : une référence, pour que la redirection de session n'arrive pas avant le
  // contrôle du portail.
  const enCours = useRef(false);

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={`/pro/acces${q()}`} replace />;

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
      writeAuthFlow({ role: 'pro', next, identifier: email, channel: 'email' });
      await signInWithPassword(email, password);
      // Une adresse = un rôle : un compte client ne s'ouvre pas sur le portail pro.
      try {
        const { profile } = await api.me.get();
        if (profile.role !== 'pro') {
          await signOut({ voile: false });
          setError({ kind: 'wrong_portal', text: t('Ce compte n’est pas un compte professionnel. Créez un espace pro avec une autre adresse.') });
          return;
        }
      } catch {
        // Profil illisible (réseau) : on n'invente pas un refus, les gardes trancheront.
      }
      navigate(retour(next), { replace: true });
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
      writeAuthFlow({ role: 'pro', next, identifier: email, channel: 'email', sentAt: Date.now() });
      await sendMagicLink(email, next);
      navigate('/pro/acces/envoye?mode=link');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const renvoyer = async () => {
    setBusy('resend');
    try {
      writeAuthFlow({ role: 'pro', next, identifier: email, channel: 'email', sentAt: Date.now() });
      await resendConfirmation(email, next);
      navigate('/pro/acces/envoye?mode=confirm');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const demo = demoAccountFor(email);

  return (
    <ProAuthScreen
      back={`/pro/acces${q({ email })}`}
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
      <CompteCarte email={email} modifier={`/pro/acces${q({ email })}`} />
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
        <Link to={`/pro/acces/oubli${q({ email })}`} className="pa-lien">
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
              <LinkButton to={`/pro/acces/oubli${q({ email })}`} variant="g" sm icon={ICONE.motDePasse}>
                {t('Réinitialiser mon mot de passe')}
              </LinkButton>
            )}
          </AuthError>
        )}
      </form>
    </ProAuthScreen>
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

export function ProAccesCreer() {
  const { session, signUpWithPassword } = useAuth();
  const navigate = useNavigate();
  const { next, email, q } = useParcours();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);

  if (session) return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={`/pro/acces${q()}`} replace />;

  const assez = password.length >= PASSWORD_MIN;

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (!assez) return setError({ kind: 'password', text: t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }) });
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role: 'pro', next, identifier: email, channel: 'email', sentAt: Date.now() });
      const ouverte = await signUpWithPassword(email, password, 'pro', next);
      if (ouverte) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate('/pro/acces/envoye?mode=confirm', { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProAuthScreen
      back={`/pro/acces${q({ email })}`}
      titre={t('Créez votre mot de passe')}
      sous={t('C’est votre première fois. Choisissez un mot de passe, puis nous vous envoyons un lien de confirmation.')}
      actions={
        <>
          <Button icon={ICONE.creerEspace} type="submit" form="pa-creer" loading={busy} disabled={busy}>
            {t('Créer mon espace')}
          </Button>
          <p className="pa-note">
            {t('En créant votre espace, vous acceptez les')}{' '}
            <Link to="/cgu">{t('conditions d’utilisation')}</Link>.
          </p>
        </>
      }
    >
      <div className="pa-puce">
        <span dir="ltr">{email}</span>
        <Link to={`/pro/acces${q({ email })}`}>{t('Modifier')}</Link>
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
              <LinkButton to={`/pro/acces/mot-de-passe${q({ email })}`} sm icon={ICONE.seConnecter}>
                {t('Se connecter')}
              </LinkButton>
            )}
          </AuthError>
        )}
      </form>
    </ProAuthScreen>
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

export function ProAccesEnvoye() {
  const { session, resendConfirmation, sendMagicLink, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const flow = readAuthFlow();
  const mode = (['confirm', 'link', 'reset'].includes(params.get('mode') ?? '') ? params.get('mode') : 'confirm') as Mode;
  const email = flow?.identifier ?? '';
  const next = flow?.next ?? '/pro';
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
  if (!email) return <Navigate to="/pro/acces" replace />;

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
    <ProAuthScreen
      back="/pro/acces"
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
          <button type="button" className="pa-lien centre" onClick={() => navigate('/pro/acces')}>
            {t('Changer d’adresse')}
          </button>
        </>
      }
    >
      <p className="pa-note centre">{t('Rien reçu ? Regardez dans les courriers indésirables.')}</p>
      {error && <AuthError texte={error} />}
    </ProAuthScreen>
  );
}

/* -------------------------------------------------------------------- Mot de passe oublié */

export function ProAccesOubli() {
  const { sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q } = useParcours();
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
      writeAuthFlow({ role: 'pro', next, identifier: id, channel: 'email', sentAt: Date.now() });
      await sendPasswordReset(id);
      navigate('/pro/acces/envoye?mode=reset', { replace: true });
    } catch (err) {
      setError(describeAuthError(err).text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProAuthScreen
      back={initial ? `/pro/acces/mot-de-passe${q({ email: initial })}` : '/pro/acces'}
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
    </ProAuthScreen>
  );
}
