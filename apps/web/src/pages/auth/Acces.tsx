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
import { estCheminPro } from '@/lib/portail';
import { OAuthButtons } from '@/components/GoogleButton';
import { ICONE } from '@/lib/actionIcons';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { VisageFemme, VisageHomme } from '@/components/GenderFaces';
import { PhoneDZField, afficherNumero, numeroConnexion, numeroDZ, type PaysTel } from '@/components/PhoneDZField';
import { demoAccountFor, demoAccountForCredentials, isDemoEmail } from '@salondz/constants';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { trace } from '@/lib/traceConnexion';
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
import { getLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { solveProof } from '@/lib/proofOfWork';
import { sortEnvoi, useWhatsAppDispo } from '@/lib/whatsappDispo';
import { ApiError } from '@salondz/api-client';
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
  trace('portail', { session: !!session, erreur: new URLSearchParams(location.search).get('erreur') });
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
  const destination = () => retour(estCheminPro(next) === (role === 'pro') ? next : role === 'pro' ? '/pro' : MARCHE);

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
        await signInWithPassword(await aliasEmail(mail, role), password, mail);
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
        <OAuthButtons role={role} next={next} />
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initial);
  const [digits, setDigits] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | ''>(() => {
    const m = guestMarket();
    return m === 'women' ? 'female' : m === 'men' ? 'male' : '';
  });
  const [cgu, setCgu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);
  const enCours = useRef(false);
  /**
   * INSCRIPTION EN UNE SEULE PAGE (22 nov. 2026, audit du parcours) : Prénom et nom, Téléphone,
   * Email, Mot de passe (l'œil remplace la confirmation tapée deux fois), et pour une cliente
   * « Vous êtes » Femme / Homme — puis « Créer mon compte ». CLIENTE : compte ouvert tout de suite,
   * retour à la page visée (réservation en cours comprise). PRO : nom et numéro posés sur le compte,
   * lien de confirmation par e-mail. Avant : deux pages (« Faisons connaissance ») et deux mots de passe.
   */
  const client = role === 'client';
  /**
   * PRO EN DEUX ÉCRANS (26 nov. 2026, demande du propriétaire) : d'abord le NUMÉRO, seul ; puis le
   * reste (prénom et nom, e-mail, mot de passe, CGU). L'étape vit dans l'adresse (`?etape=2`) : le
   * retour ramène au numéro, saisi gardé. La cliente garde sa page unique.
   */
  const [params, setParams] = useSearchParams();
  const etape2 = !client && params.get('etape') === '2';
  const versEtape = (deux: boolean) => {
    const n = new URLSearchParams(params);
    if (deux) n.set('etape', '2');
    else n.delete('etape');
    setParams(n, { replace: !deux });
  };

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;

  const continuer = (e: FormEvent) => {
    e.preventDefault();
    if (!numeroDZ(digits)) return setError({ kind: 'phone', text: t('Numéro algérien invalide : 9 chiffres après +213.') });
    setError(null);
    versEtape(true);
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    const phone = numeroDZ(digits);
    // Numéro perdu (page rechargée à l'étape 2) : on revient le demander.
    if (!client && !phone) {
      setError({ kind: 'phone', text: t('Numéro algérien invalide : 9 chiffres après +213.') });
      return versEtape(false);
    }
    if (name.trim().length < 2) return setError({ kind: 'form', text: t('Indiquez votre prénom et votre nom.') });
    if (!phone) return setError({ kind: 'phone', text: t('Numéro algérien invalide : 9 chiffres après +213.') });
    if (!EMAIL_RE.test(mail)) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    if (password.length < PASSWORD_MIN) return setError({ kind: 'password', text: t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }) });
    if (client && !gender) return setError({ kind: 'form', text: t('Choisissez Femme ou Homme.') });
    if (!cgu) return setError({ kind: 'form', text: t('Acceptez les CGU pour créer votre compte.') });
    setError(null);
    setBusy(true);
    enCours.current = true;
    writeAuthFlow({ role, next, identifier: mail, channel: 'email', sentAt: Date.now() });
    try {
      if (client) {
        const ouverte = await signUpWithPassword(mail, password, 'client', next, { fullName: name.trim(), gender: gender || undefined, phone });
        if (gender) setGuestMarket(gender === 'female' ? 'women' : 'men');
        if (ouverte) navigate(estCheminPro(next) ? MARCHE : next, { replace: true });
        else navigate(`${base}/envoye?mode=confirm`, { replace: true });
        return;
      }
      // Pro : le nom et le numéro saisis ici sont posés sur le compte (« Vos coordonnées » ne les redemande pas).
      const ouverte = await signUpWithPassword(mail, password, role, next, { phone, fullName: name.trim() });
      if (ouverte) navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
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

  if (!client && !etape2)
    return (
      <AuthScreen back={`${base}${q()}`} titre={t('Créer mon espace professionnel')}>
        <form onSubmit={continuer} noValidate className="pa-form pl-auth">
          <PhoneDZField
            id="pa-creer-tel"
            digits={digits}
            onDigits={(v) => {
              setDigits(v);
              setError(null);
            }}
            error={error?.kind === 'phone' ? error.text : null}
          />
          <button type="submit" className="pl-btn pl-btn-ink">
            {t('Continuer')}
          </button>
          <span className="pl-ou">{t('OU')}</span>
          <OAuthButtons role={role} next={next} />
          <Link to={`${base}${q()}`} className="pl-btn pl-btn-out">
            {t('Se connecter')}
          </Link>
        </form>
      </AuthScreen>
    );

  return (
    <AuthScreen back={etape2 ? `${base}/creer${q()}` : `${base}${q()}`} titre={role === 'pro' ? t('Créer mon espace professionnel') : t('Créer mon compte')}>
      <form onSubmit={creer} noValidate className="pa-form pl-auth">
        <Field label={`${t('Prénom et nom')} *`} htmlFor="pa-creer-nom">
          <Input
            id="pa-creer-nom"
            autoComplete="name"
            placeholder={t('Inès Rahmani')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </Field>
        {client && (
          <PhoneDZField
            id="pa-creer-tel"
            digits={digits}
            onDigits={(v) => {
              setDigits(v);
              setError(null);
            }}
            error={error?.kind === 'phone' ? error.text : null}
          />
        )}
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
        {client && (
          <div>
            <span className="lbl">{t('Vous êtes')}</span>
            <div className="pa-genre petit" role="radiogroup" aria-label={t('Vous êtes')}>
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
        )}
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
        {client && (
          <>
            <span className="pl-ou">{t('OU')}</span>
            <OAuthButtons role={role} next={next} />
            <Link to={`${base}${q(email.trim() ? { email: email.trim().toLowerCase() } : {})}`} className="pl-btn pl-btn-out">
              {t('Se connecter')}
            </Link>
          </>
        )}
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
  // Fondu dans « Créer mon compte » (22 nov. 2026) : une adresse ancienne ou rechargée y revient.
  const { q, base, email } = useParcours();
  return <Navigate to={`${base}/creer${q(email ? { email } : {})}`} replace />;
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

/* -------------------------------------------------------------------- Connexion par WhatsApp */

/**
 * CONNEXION PAR NUMÉRO, CODE REÇU SUR WHATSAPP (23 nov. 2026, demande du propriétaire). Un écran,
 * deux temps : le numéro, puis le code à 6 chiffres (vérifié dès le sixième chiffre, sans bouton à
 * toucher). Première connexion : le compte est créé par le serveur, puis `/profil/creer` demande le
 * nom (le numéro y est déjà). Le serveur décide du portail : un numéro n'ouvre que le compte de CE
 * côté (règle n° 4).
 */
export function AccesWhatsApp() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { next, q, role, base } = useParcours();
  const [digits, setDigits] = useState('');
  const [pays, setPays] = useState<PaysTel>('dz');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);
  const [error, setError] = useState<Err>(null);
  /** Secondes avant de pouvoir redemander (délai croissant DONNÉ PAR LE SERVEUR). */
  const [dans, setDans] = useState(0);
  /** Plus aucun renvoi possible pour l'heure : le bouton disparaît. */
  const [epuise, setEpuise] = useState(false);
  const enCours = useRef(false);
  const dispo = useWhatsAppDispo();

  useEffect(() => {
    if (dans <= 0) return;
    const id = window.setInterval(() => setDans((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [dans]);

  if (session && !enCours.current) return <Navigate to={retour(next)} replace />;
  // Canal pas prêt (modèle Meta non approuvé) : cet écran n'existe pas, retour à la connexion.
  if (dispo.data?.available === false) return <Navigate to={`${base}${q()}`} replace />;

  const envoyer = async (numero: string) => {
    setBusy('send');
    setError(null);
    try {
      // Preuve de travail anti-robots, liée au numéro : invisible, quelques dixièmes de seconde.
      const { challenge, bits } = await api.auth.phoneChallenge();
      const nonce = await solveProof(challenge, numero, bits);
      const res = await api.auth.phoneCode({ phone: numero, role, lang: getLocale(), challenge, nonce });
      // ON N'AFFICHE « Entrez le code » QUE SI WHATSAPP L'A PRIS EN CHARGE (24 nov. 2026) : Meta peut
      // accepter un envoi puis ne pas le livrer. Son verdict arrive par webhook ; on l'attend 10 s au plus.
      if (res.ref && (await sortEnvoi(res.ref)) === 'failed') {
        setError({ kind: phone ? 'form' : 'phone', text: t('WhatsApp n’a pas pu remettre le code à ce numéro. Vérifiez qu’il utilise WhatsApp, ou connectez-vous par e-mail.') });
        return;
      }
      setPhone(numero);
      setCode('');
      setDans(res.resendIn ?? 0);
      setEpuise(res.resendIn === null);
    } catch (err) {
      const kind = phone ? 'form' : 'phone';
      if (err instanceof ApiError && err.code === 'OTP_WAIT') {
        setDans(Number((err.details as { retryIn?: number } | undefined)?.retryIn) || 60);
        setError({ kind, text: t(err.message) });
      } else if (err instanceof ApiError && err.code === 'OTP_LIMIT') {
        setEpuise(true);
        setError({ kind, text: t(err.message) });
      } else {
        setError({ kind, text: describeAuthError(err).text });
      }
    } finally {
      setBusy(null);
    }
  };

  const demander = (e: FormEvent) => {
    e.preventDefault();
    const numero = numeroConnexion(pays, digits);
    if (!numero)
      return setError({
        kind: 'phone',
        text: pays === 'fr' ? t('Numéro de mobile français invalide : 06 ou 07, puis 8 chiffres.') : t('Numéro de mobile algérien invalide : 05, 06 ou 07, puis 8 chiffres.'),
      });
    void envoyer(numero);
  };

  const verifier = async (valeur: string) => {
    if (!phone || valeur.length !== 6) return;
    setBusy('check');
    setError(null);
    enCours.current = true;
    try {
      const res = await api.auth.phoneVerify({ phone, role, code: valeur });
      const { error: e } = await supabase.auth.setSession({ access_token: res.accessToken, refresh_token: res.refreshToken });
      if (e) throw e;
      writeAuthFlow({ role, next, identifier: phone, channel: 'whatsapp' });
      navigate(res.isNew ? `/profil/creer?next=${encodeURIComponent(next)}` : retour(next), { replace: true });
    } catch (err) {
      setError({ kind: 'form', text: describeAuthError(err).text });
      setCode('');
    } finally {
      enCours.current = false;
      setBusy(null);
    }
  };

  const minutes = `${Math.floor(dans / 60)}:${String(dans % 60).padStart(2, '0')}`;

  if (!phone) {
    return (
      <AuthScreen
        back={`${base}${q()}`}
        titre={t('Votre numéro de téléphone')}
        actions={
          <Button icon={ICONE.codeWhatsApp} type="submit" form="pa-wa" loading={busy === 'send'} disabled={busy !== null}>
            {t('Recevoir le code sur WhatsApp')}
          </Button>
        }
      >
        <form id="pa-wa" onSubmit={demander} noValidate className="pa-form">
          <PhoneDZField
            id="pa-wa-tel"
            pays={pays}
            onPays={(p) => {
              setPays(p);
              setError(null);
            }}
            digits={digits}
            onDigits={(v) => {
              setDigits(v);
              setError(null);
            }}
            error={error?.kind === 'phone' ? error.text : null}
            aide={null}
          />
        </form>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      back={`${base}${q()}`}
      titre={t('Entrez le code reçu')}
      sous={
        <>
          {t('Envoyé sur WhatsApp au')} <b dir="ltr">{afficherNumero(phone)}</b>
        </>
      }
      actions={
        <>
          <Button icon={ICONE.seConnecter} type="submit" form="pa-wa-code" loading={busy === 'check'} disabled={busy !== null || code.length !== 6}>
            {t('Se connecter')}
          </Button>
          {!epuise && (
            <Button icon={ICONE.renvoyer} variant="g" loading={busy === 'send'} disabled={busy !== null || dans > 0} onClick={() => void envoyer(phone)}>
              {dans > 0 ? t('Renvoyer le code dans {temps}', { temps: minutes }) : t('Renvoyer le code')}
            </Button>
          )}
          <button
            type="button"
            className="pa-lien centre"
            onClick={() => {
              setPhone(null);
              setError(null);
              setDans(0);
              setEpuise(false);
            }}
          >
            {t('Changer de numéro')}
          </button>
        </>
      }
    >
      <form
        id="pa-wa-code"
        onSubmit={(e) => {
          e.preventDefault();
          void verifier(code);
        }}
        noValidate
        className="pa-form"
      >
        <Field label={t('Code à 6 chiffres')} htmlFor="pa-wa-code-i">
          <Input
            id="pa-wa-code-i"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="go"
            maxLength={6}
            dir="ltr"
            className="pa-code"
            placeholder="••••••"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(v);
              setError(null);
              if (v.length === 6) void verifier(v);
            }}
            err={!!error}
          />
        </Field>
        {error && <AuthError texte={error.text} />}
      </form>
    </AuthScreen>
  );
}
