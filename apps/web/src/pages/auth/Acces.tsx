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
import { GoogleLogo } from '@/components/BrandIcons';
import { connexionGoogle, useGoogleDisponible } from '@/lib/googleAuth';
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { VisageFemme, VisageHomme } from '@/components/GenderFaces';
import { PhoneDZField, numeroDZ } from '@/components/PhoneDZField';
import { demoAccountFor, demoAccountForCredentials, isDemoEmail } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { api } from '@/lib/api';
import { Button, Field, I, Input, LinkButton } from '@/components/ui';
import { guestMarket, setGuestMarket } from '@/lib/useClientMarket';
import { estRefusCompte } from '@/components/CompteRefuse';
import { aliasEmail } from '@/lib/alias';

/** Les deux seules phrases d'un refus (16 nov. 2026) : rien sur l'autre type de compte. */
const texteRefus = (role: 'client' | 'pro') =>
  role === 'pro' ? t('Aucun compte professionnel associé à ces identifiants.') : t('Aucun compte client associé à ces identifiants.');
import { AuthError, PasswordField } from '@/components/AuthShell';
import { MailAppButton, AuthScreen } from '@/components/AuthKit';
import { isNative } from '@/lib/native';
import { EMAIL_RE } from './Login';
import { PASSWORD_MIN } from './SignUp';
import { t } from '@/i18n';
import { MARCHE } from '@/lib/flavor';

type Err = { kind: AuthErrorKind | 'form' | 'phone'; text: string } | null;

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
    ouverture: isNative() ? (pro ? '/pro/bienvenue' : '/intro') : pro ? '/professionnels' : '/',
    defaut: pro ? '/pro' : MARCHE,
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

/* -------------------------------------------------------------------- 1. Connexion (façon Planity) */

/**
 * CONNEXION FAÇON PLANITY (20 nov. 2026, demande du propriétaire, site ET applications, client ET pro) :
 * Email, Mot de passe, « Mot de passe oublié ? », « Se connecter », OU, « Créer mon compte ».
 * Chaque portail n'ouvre que SON compte : une même adresse peut avoir un compte pro et un compte perso
 * (le second sous son adresse interne, `lib/alias.ts`) ; on essaie la vraie adresse, puis l'interne.
 */
export function AccesEmail() {
  const { session, signInWithPassword, resendConfirmation, demoLogin, signOut } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q, role, base, ouverture } = useParcours();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(initial);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'resend' | null>(null);
  const [error, setError] = useState<Err>(() =>
    params.get('erreur') === 'compte'
      ? { kind: 'credentials', text: texteRefus(role) }
      : params.get('erreur')
        ? { kind: 'expired', text: t('Ce lien n’est plus valable. Connectez-vous, ou demandez un nouveau lien.') }
        : null,
  );
  const enCours = useRef(false);

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;

  const adresse = () => email.trim().toLowerCase();
  const destination = () => retour(next.startsWith('/pro') === (role === 'pro') ? next : role === 'pro' ? '/pro' : MARCHE);

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    const mail = adresse();
    setError(null);
    if (!EMAIL_RE.test(mail)) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    const demo = demoAccountForCredentials(mail, password);
    if (demo) {
      if (demo.role !== role) return setError({ kind: 'credentials', text: texteRefus(role) });
      setBusy('password');
      try {
        writeAuthFlow({ role: demo.role, next: demo.role === 'pro' ? '/pro' : '/', identifier: demo.email, channel: 'email' });
        await demoLogin(demo.email);
        navigate(retour(demo.role === 'pro' ? '/pro' : MARCHE), { replace: true });
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
      writeAuthFlow({ role, next, identifier: mail, channel: 'email' });
      /** Le compte ouvert est-il de CE côté ? Le serveur refuse aussi (`X-Salondz-App`, gardes de rôle). */
      const bonCote = async (): Promise<boolean> => {
        try {
          const { profile } = await api.me.get();
          return (profile.role === 'pro') === (role === 'pro');
        } catch (err) {
          return estRefusCompte(err) === null;
        }
      };
      let premiere: unknown = null;
      try {
        await signInWithPassword(mail, password);
        if (await bonCote()) return navigate(destination(), { replace: true });
        await signOut({ voile: false }).catch(() => undefined);
      } catch (err) {
        premiere = err;
      }
      // Second essai : le compte de CE portail sous l'adresse interne (même adresse, autre côté).
      try {
        await signInWithPassword(await aliasEmail(mail, role), password);
        if (await bonCote()) return navigate(destination(), { replace: true });
        await signOut({ voile: false }).catch(() => undefined);
      } catch {
        /* pas de compte interne : on garde la première réponse */
      }
      if (premiere) throw premiere;
      setError({ kind: 'credentials', text: texteRefus(role) });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      enCours.current = false;
      setBusy(null);
    }
  };

  const renvoyer = async () => {
    setBusy('resend');
    try {
      writeAuthFlow({ role, next, identifier: adresse(), channel: 'email', sentAt: Date.now() });
      await resendConfirmation(adresse(), next, role);
      navigate(`${base}/envoye?mode=confirm`);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthScreen back={ouverture} titre={role === 'pro' ? t('Connexion professionnelle') : t('Se connecter')}>
      <form onSubmit={connecter} noValidate className="pa-form pl-auth">
        <Field label={`${t('Email')} *`} htmlFor="pa-email-i">
          <Input
            id="pa-email-i"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('Email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={error?.kind === 'email'}
          />
        </Field>
        <PasswordField
          id="pa-mdp-i"
          label={`${t('Mot de passe')} *`}
          placeholder={t('Mot de passe')}
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'credentials'}
        />
        <Link to={`${base}/oubli${q({ email: adresse() })}`} className="pl-auth-oubli">
          {t('Mot de passe oublié ?')}
        </Link>
        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'unconfirmed' && (
              <Button icon={ICONE.renvoyer} sm variant="g" loading={busy === 'resend'} onClick={() => void renvoyer()} disabled={busy !== null}>
                {t('Renvoyer le lien de confirmation')}
              </Button>
            )}
          </AuthError>
        )}
        <button type="submit" className="pl-btn pl-btn-ink" disabled={busy !== null}>
          {busy === 'password' ? t('Connexion…') : t('Se connecter')}
        </button>
        <span className="pl-ou">{t('OU')}</span>
        <GoogleButton role={role} next={next} />
        <Link to={`${base}/creer${q(adresse() ? { email: adresse() } : {})}`} className="pl-btn pl-btn-out">
          {t('Créer mon compte')}
        </Link>
      </form>
    </AuthScreen>
  );
}

/* -------------------------------------------------------------------- 2a. Ancienne étape « mot de passe » */

/** Ancienne adresse (« Bon retour ») : la connexion est désormais sur un seul écran. */
export function AccesMotDePasse() {
  const { q, base, email } = useParcours();
  return <Navigate to={`${base}${q(email ? { email } : {})}`} replace />;
}

/* -------------------------------------------------------------------- 2b. Nouveau compte */

export function AccesCreer() {
  const { session, signUpWithPassword } = useAuth();
  const navigate = useNavigate();
  const { next, email: initial, q, role, base } = useParcours();
  const [email, setEmail] = useState(initial);
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [cgu, setCgu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);
  /**
   * INSCRIPTION FAÇON PLANITY (20 nov. 2026) : Téléphone portable, Email, Mot de passe, Confirmation,
   * CGU, « Créer mon compte », OU, « Se connecter ». CLIENTE : on enchaîne sur « Faisons connaissance »
   * (prénom et nom, femme / homme), qui crée le compte et fait entrer ; le mot de passe et le numéro
   * y voyagent dans l'état de navigation (mémoire), jamais dans l'adresse. PRO : lien de confirmation.
   */
  const client = role === 'client';

  if (session) return <Navigate to={retour(next)} replace />;

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    const phone = numeroDZ(digits);
    if (!phone) return setError({ kind: 'phone', text: t('Numéro algérien invalide : 9 chiffres après +213.') });
    if (!EMAIL_RE.test(mail)) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    if (password.length < PASSWORD_MIN) return setError({ kind: 'password', text: t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }) });
    if (password !== confirmation) return setError({ kind: 'password', text: t('Les deux mots de passe ne sont pas identiques.') });
    if (!cgu) return setError({ kind: 'form', text: t('Acceptez les CGU pour créer votre compte.') });
    setError(null);
    writeAuthFlow({ role, next, identifier: mail, channel: 'email', sentAt: Date.now() });
    if (client) return navigate(`${base}/vous${q({ email: mail })}`, { state: { password, phone } });
    setBusy(true);
    try {
      // Le numéro saisi ici est enregistré sur le compte pro (« Vos coordonnées » ne le redemande pas).
      const ouverte = await signUpWithPassword(mail, password, role, next, { phone });
      if (ouverte) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
      else navigate(`${base}/envoye?mode=confirm`, { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen back={`${base}${q()}`} titre={role === 'pro' ? t('Créer mon espace professionnel') : t('Créer mon compte')}>
      <form onSubmit={creer} noValidate className="pa-form pl-auth">
        <PhoneDZField
          id="pa-creer-tel"
          digits={digits}
          onDigits={(v) => {
            setDigits(v);
            setError(null);
          }}
          error={error?.kind === 'phone' ? error.text : null}
        />
        <Field label={`${t('Email')} *`} htmlFor="pa-creer-mail">
          <Input
            id="pa-creer-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('Email')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={error?.kind === 'email'}
          />
        </Field>
        <PasswordField
          id="pa-creer-i"
          label={`${t('Mot de passe')} *`}
          placeholder={t('Mot de passe')}
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'password'}
        />
        <PasswordField
          id="pa-creer-c"
          label={`${t('Confirmation du mot de passe')} *`}
          placeholder={t('Confirmation du mot de passe')}
          autoComplete="new-password"
          value={confirmation}
          onChange={(v) => {
            setConfirmation(v);
            setError(null);
          }}
          err={error?.kind === 'password'}
        />
        <label className="pl-auth-cgu">
          <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} />
          <span>
            {t('J’accepte les')} <Link to="/cgu">{t('CGU')}</Link> {t('de Salon DZ.')}
          </span>
        </label>
        {error && error.kind !== 'phone' && (
          <AuthError texte={error.text}>
            {error.kind === 'exists' && (
              <LinkButton to={`${base}${q({ email: email.trim().toLowerCase() })}`} sm icon={ICONE.seConnecter}>
                {t('Se connecter')}
              </LinkButton>
            )}
          </AuthError>
        )}
        <button type="submit" className="pl-btn pl-btn-ink" disabled={busy}>
          {busy ? t('Création…') : t('Créer mon compte')}
        </button>
        <span className="pl-ou">{t('OU')}</span>
        <GoogleButton role={role} next={next} />
        <Link to={`${base}${q(email.trim() ? { email: email.trim().toLowerCase() } : {})}`} className="pl-btn pl-btn-out">
          {t('Se connecter')}
        </Link>
      </form>
    </AuthScreen>
  );
}

/* -------------------------------------------------------------------- 2c. Faisons connaissance (cliente) */

/**
 * PRÉNOM, NOM ET « FEMME / HOMME », SUR UNE PAGE À PART (15 nov. 2026, demande du propriétaire).
 * Deux grandes tuiles à icône de couleur (rose pour femme, bleu pour homme). « Entrer » crée le
 * compte déjà confirmé, ouvre la session et la place de marché sur le côté choisi.
 */
export function AccesVous() {
  const { session, signUpWithPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { next, email, q, base } = useParcours();
  const etat = location.state as { password?: string; phone?: string } | null;
  const password = etat?.password ?? '';
  // Numéro déjà saisi à l'inscription (façon Planity) : on ne le redemande pas.
  const dejaTel = etat?.phone ?? null;
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | ''>(() => {
    const m = guestMarket();
    return m === 'women' ? 'female' : m === 'men' ? 'male' : '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);
  const enCours = useRef(false);

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;
  if (!email) return <Navigate to={`${base}${q()}`} replace />;
  // Page rechargée : le mot de passe (gardé en mémoire seulement) est perdu, on le redemande.
  if (!password) return <Navigate to={`${base}/creer${q({ email })}`} replace />;

  const entrer = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError({ kind: 'form', text: t('Indiquez votre prénom et votre nom.') });
    // Numéro OBLIGATOIRE (17 nov. 2026), avec ou sans le 0 du début ; vérifié aussi par le serveur.
    const phone = dejaTel ?? numeroDZ(digits);
    if (!phone) return setError({ kind: 'phone', text: t('Numéro algérien invalide : 9 chiffres après +213.') });
    if (!gender) return setError({ kind: 'form', text: t('Choisissez Femme ou Homme.') });
    setError(null);
    setBusy(true);
    enCours.current = true;
    try {
      writeAuthFlow({ role: 'client', next, identifier: email, channel: 'email', sentAt: Date.now() });
      const ouverte = await signUpWithPassword(email, password, 'client', next, { fullName: name.trim(), gender, phone });
      setGuestMarket(gender === 'female' ? 'women' : 'men');
      if (ouverte) navigate(next.startsWith('/pro') ? MARCHE : next, { replace: true });
      else navigate(`${base}/envoye?mode=confirm`, { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      enCours.current = false;
      setBusy(false);
    }
  };

  const tuiles = [
    { value: 'female' as const, label: t('Femme'), Visage: VisageFemme, cls: 'f' },
    { value: 'male' as const, label: t('Homme'), Visage: VisageHomme, cls: 'h' },
  ];

  return (
    <AuthScreen
      back={`${base}/creer${q({ email })}`}
      titre={t('Faisons connaissance')}
      sous={t('Votre nom pour le salon, et ce que vous recherchez.')}
      actions={
        <>
          <Button icon={ICONE.creerCompte} type="submit" form="pa-vous" loading={busy} disabled={busy}>
            {t('Créer mon compte')}
          </Button>
          <p className="pa-note">
            {t('En créant votre compte, vous acceptez les')} <Link to="/cgu">{t('conditions d’utilisation')}</Link>.
          </p>
        </>
      }
    >
      <form id="pa-vous" onSubmit={entrer} noValidate className="pa-form">
        <Field label={t('Prénom et nom')} htmlFor="pa-vous-nom">
          <Input
            id="pa-vous-nom"
            autoComplete="name"
            enterKeyHint="done"
            placeholder={t('Inès Rahmani')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </Field>
        {!dejaTel && (
          <PhoneDZField
            id="pa-vous-tel"
            digits={digits}
            onDigits={(v) => {
              setDigits(v);
              setError(null);
            }}
            error={error?.kind === 'phone' ? error.text : null}
          />
        )}
        <div>
          <span className="lbl">{t('Vous êtes')}</span>
          <div className="pa-genre" role="radiogroup" aria-label={t('Vous êtes')}>
            {tuiles.map((x) => (
              <button
                key={x.value}
                type="button"
                role="radio"
                aria-checked={gender === x.value}
                className={`pa-genre-t ${x.cls}${gender === x.value ? ' on' : ''}`}
                onClick={() => {
                  setGender(x.value);
                  setError(null);
                }}
              >
                <span className="pa-genre-i" aria-hidden>
                  <x.Visage />
                </span>
                {x.label}
              </button>
            ))}
          </div>
        </div>
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
  const { base, defaut, role } = usePortail();
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
      if (mode === 'confirm') await resendConfirmation(email, next, role);
      else if (mode === 'link') await sendMagicLink(email, next, role);
      else await sendPasswordReset(email, role);
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
      await sendPasswordReset(id, role);
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

/** « Continuer avec Google » — affiché seulement quand Google est activé sur Supabase. */
function GoogleButton({ role, next }: { role: 'client' | 'pro'; next: string }) {
  const dispo = useGoogleDisponible();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!dispo) return null;
  return (
    <>
      <button
        type="button"
        className="pl-btn pl-btn-out pl-google"
        disabled={busy}
        onClick={() => {
          setErr(null);
          setBusy(true);
          writeAuthFlow({ role, next, identifier: '', channel: 'email' });
          connexionGoogle(role, next)
            .catch(() => setErr(t('Connexion avec Google impossible pour le moment. Réessayez.')))
            .finally(() => setBusy(false));
        }}
      >
        <GoogleLogo size={20} />
        {t('Continuer avec Google')}
      </button>
      {err && <AuthError texte={err} />}
    </>
  );
}
