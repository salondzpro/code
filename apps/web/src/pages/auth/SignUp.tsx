/**
 * Inscription par e-mail et mot de passe, SUR UN SEUL ÉCRAN (refonte du 24 oct. 2026). L'adresse
 * est vérifiée par le lien reçu (comme les outils du métier) ; le profil (nom, téléphone) se
 * complète après, une fois connecté.
 *
 * POURQUOI UN SEUL ÉCRAN : le parcours en trois temps (adresse, mot de passe, confirmation) faisait
 * trois écrans, trois titres et trois « Continuer » pour trois champs. Avec la coque compacte, les
 * trois tiennent ensemble au-dessus du clavier : on voit d'un coup tout ce qui est demandé.
 *
 * Ce que le découpage protégeait est gardé :
 *   - la CONFIRMATION du mot de passe reste exigée, et son verdict s'affiche pendant la frappe —
 *     quelqu'un qui se trompe en saisissant son mot de passe se retrouve avec un compte dont il
 *     ignore la clé ;
 *   - chaque champ est vérifié AVANT l'envoi, avec le message sous le champ concerné ;
 *   - une adresse déjà inscrite propose la connexion ou la réinitialisation.
 *
 * ADRESSE DÉJÀ PRISE, DÈS LA SAISIE (28 oct. 2026) : l'adresse est vérifiée pendant la frappe
 * (`POST /auth/email-check`), avant même le mot de passe. Déjà associée à un compte — professionnel
 * surtout —, le formulaire s'arrête là : message sous le champ, bouton de création désactivé, et la
 * suite proposée (se connecter, récupérer l'accès, renvoyer le lien). Le serveur refait le contrôle
 * à la création : l'écran informe, il ne protège pas.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { isDemoEmail } from '@salondz/constants';
import type { EmailCheckStatus } from '@salondz/validation';
import { PRO_EMAIL_EXISTS_TEXT, describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/useDebounced';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, Input } from '@/components/ui';
import { AuthError, AuthShell, MatchHint, PasswordField, matchState } from '@/components/AuthShell';
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
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(null);
  /** Résultat de la vérification de l'adresse saisie ; `checking` pendant l'appel. */
  const [check, setCheck] = useState<{ email: string; status: EmailCheckStatus } | null>(null);
  const [checking, setChecking] = useState(false);
  const typed = useDebounced(email.trim().toLowerCase(), 450);
  const seq = useRef(0);
  useEffect(() => {
    if (!EMAIL_RE.test(typed) || isDemoEmail(typed)) return;
    const n = ++seq.current;
    setChecking(true);
    api.auth
      .emailCheck({ email: typed, role })
      .then((r) => n === seq.current && setCheck({ email: typed, status: r.status }))
      // Vérification impossible (réseau, limite) : on n'invente rien, le serveur tranchera à la création.
      .catch(() => undefined)
      .finally(() => n === seq.current && setChecking(false));
  }, [typed, role]);

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  const id = () => email.trim().toLowerCase();
  const accord = matchState(password, confirmation);
  const connexion = role === 'pro' ? `/connexion?role=pro&next=${encodeURIComponent(next)}` : `/intro?next=${encodeURIComponent(next)}`;
  const inscription = `/inscription?role=${role}&next=${encodeURIComponent(next)}`;

  // L'adresse affichée est-elle déjà prise ? (Le résultat ne vaut que pour l'adresse vérifiée.)
  const taken = check && check.email === id() && check.status !== 'available' ? check.status : null;
  const takenText =
    taken === 'pro'
      ? t(PRO_EMAIL_EXISTS_TEXT)
      : taken === 'client'
        ? role === 'pro'
          ? t('Cette adresse est déjà utilisée par un compte client. Choisissez une autre adresse pour votre espace professionnel, ou connectez-vous.')
          : t('Un compte existe déjà avec cette adresse. Connectez-vous, ou réinitialisez votre mot de passe.')
        : taken === 'pending'
          ? t('Une inscription est déjà en cours avec cette adresse : ouvrez le lien de confirmation reçu par e-mail.')
          : null;

  const renvoyer = async () => {
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email', sentAt: Date.now() });
      await api.auth.resendConfirmation({ email: id(), next });
      navigate('/connexion/envoye?mode=confirm', { replace: true });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(id())) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
    if (taken) return;
    if (password.length < PASSWORD_MIN)
      return setError({ kind: 'password', text: t('Mot de passe trop court : {n} caractères au minimum.', { n: PASSWORD_MIN }) });
    // Garde-fou : le bouton est déjà désactivé, mais la touche Entrée ne passe pas par lui.
    if (accord !== 'ok') return setError({ kind: 'form', text: t('Les deux mots de passe ne correspondent pas.') });
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: id(), channel: 'email', sentAt: Date.now() });
      const open = await signUpWithPassword(id(), password, role, next);
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
      back={role === 'pro' ? '/pro/bienvenue' : undefined}
      onglets={{ actif: 'inscription', liens: { connexion, inscription } }}
      titre={role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}
      sous={
        role === 'pro'
          ? t('Votre agenda, vos réservations et votre page en ligne. Gratuit.')
          : t('Réservez dans les salons de votre choix, sans appeler.')
      }
    >
      <form onSubmit={creer} noValidate>
        <Field
          label={t('E-mail')}
          htmlFor="su-email"
          error={error?.kind === 'email' ? error.text : null}
          hint={checking && !taken ? t('Vérification de l’adresse…') : undefined}
        >
          <Input
            id="su-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder={t('vous@exemple.dz')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            err={error?.kind === 'email' || error?.kind === 'exists' || !!taken}
          />
        </Field>
        {/* Adresse déjà prise : on s'arrête ici, avec la suite à portée de pouce. */}
        {taken && takenText && (
          <AuthError texte={takenText}>
            {taken === 'pending' ? (
              <Button sm variant="g" loading={busy} onClick={() => void renvoyer()}>
                {t('Renvoyer le lien de confirmation')}
              </Button>
            ) : (
              <div className="g2">
                <Link to={`${connexion}&email=${encodeURIComponent(id())}`} className="btn sm">
                  {t('Se connecter')}
                </Link>
                <Link to={`/connexion/oubli?email=${encodeURIComponent(id())}`} className="btn g sm">
                  {t('Récupérer mon accès')}
                </Link>
              </div>
            )}
          </AuthError>
        )}

        <PasswordField
          id="su-password"
          label={t('Mot de passe')}
          autoComplete="new-password"
          placeholder={t('Choisissez un mot de passe')}
          hint={error?.kind === 'password' ? undefined : t('{n} caractères au minimum.', { n: PASSWORD_MIN })}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          err={error?.kind === 'password'}
        />
        {error?.kind === 'password' && (
          <p className="-mt-2 text-[0.857rem] text-danger" role="alert">
            {error.text}
          </p>
        )}

        <PasswordField
          id="su-confirm"
          label={t('Confirmer le mot de passe')}
          autoComplete="new-password"
          placeholder={t('Saisissez-le à nouveau')}
          value={confirmation}
          onChange={(v) => {
            setConfirmation(v);
            setError(null);
          }}
          err={accord === 'different'}
        />
        <MatchHint etat={accord} />

        {error && error.kind !== 'email' && error.kind !== 'password' && (
          <AuthError texte={error.text}>
            {error.kind === 'exists' && (
              <div className="g2">
                <Link to={connexion} className="btn sm">
                  {t('Se connecter')}
                </Link>
                <Link to={`/connexion/oubli?email=${encodeURIComponent(id())}`} className="btn g sm">
                  {t('Mot de passe oublié')}
                </Link>
              </div>
            )}
          </AuthError>
        )}

        <Button type="submit" loading={busy && !taken} disabled={busy || !!taken || (confirmation !== '' && accord !== 'ok')}>
          {role === 'pro' ? t('Créer mon espace pro') : t('Créer mon compte')}
        </Button>

        <p className="t3 text-center leading-[1.45]">
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
