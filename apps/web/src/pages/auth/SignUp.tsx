/**
 * Inscription par e-mail et mot de passe, EN TROIS TEMPS. L'adresse est vérifiée par le lien reçu
 * (comme les outils du métier) ; le profil (nom, téléphone) se complète après, une fois connecté.
 *
 * POURQUOI DÉCOUPER : trois champs d'un coup sur un écran de téléphone, clavier ouvert, c'est un
 * formulaire qu'on abandonne. Une question à la fois, une progression visible, et l'on sait
 * toujours combien il reste. Chaque étape valide AVANT de laisser passer : on ne découvre pas à
 * la fin que l'adresse était mal écrite.
 *
 * La CONFIRMATION du mot de passe a son étape à elle, et son verdict s'affiche pendant la frappe.
 * C'est toute la raison d'être de ce découpage : quelqu'un qui se trompe en saisissant son mot de
 * passe se retrouve avec un compte dont il ignore la clé, et il n'y a aucun moyen de le deviner.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { describeAuthError, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input } from '@/components/ui';
import { AuthError, AuthShell, MatchHint, PasswordField, matchState } from '@/components/AuthShell';
import { EMAIL_RE } from './Login';
import { t } from '@/i18n';

export const PASSWORD_MIN = 8;

/** Trois temps ici, puis la validation du compte par e-mail : quatre au total pour la personne. */
const ETAPES = 4;

export function SignUp() {
  const { session, signUpWithPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/');

  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(null);

  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;

  const id = () => email.trim().toLowerCase();
  const accord = matchState(password, confirmation);

  /** Retour : l'étape précédente, ou l'écran précédent quand on est à la première. */
  const retour = etape === 1 ? (role === 'pro' ? '/pro/bienvenue' : `/connexion?role=${role}`) : undefined;

  const suivant = (e: FormEvent) => {
    e.preventDefault();
    if (etape === 1) {
      if (!EMAIL_RE.test(id())) return setError({ kind: 'email', text: t('Adresse e-mail invalide.') });
      setError(null);
      return setEtape(2);
    }
    if (etape === 2) {
      if (password.length < PASSWORD_MIN)
        return setError({ kind: 'password', text: `Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.` });
      setError(null);
      return setEtape(3);
    }
    return creer();
  };

  const creer = async () => {
    // Garde-fou : le bouton est déjà désactivé, mais la touche Entrée ne passe pas par lui.
    if (accord !== 'ok') return;
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
      // Une adresse déjà prise se corrige à l'étape 1 : on y ramène plutôt que de bloquer ici.
      if (describeAuthError(err).kind === 'exists') setEtape(1);
    } finally {
      setBusy(false);
    }
  };

  const TITRES = {
    1: role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte',
    2: 'Choisissez un mot de passe',
    3: 'Confirmez votre mot de passe',
  } as const;

  const SOUS = {
    1:
      role === 'pro'
        ? t('Votre agenda, vos réservations et votre page en ligne. Gratuit.')
        : t('Réservez dans les salons de votre choix, sans appeler.'),
    2: t('{n} caractères au minimum. Vous pourrez le changer plus tard.', { n: PASSWORD_MIN }),
    3: t('Saisissez-le une seconde fois : c’est le seul moyen d’être sûr de ne pas s’être trompé.'),
  } as const;

  return (
    <AuthShell
      role={role}
      back={retour}
      etape={etape}
      etapes={ETAPES}
      titre={TITRES[etape]}
      sous={SOUS[etape]}
      pied={
        etape === 1 ? (
          <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn g">
            {t('J’ai déjà un compte')}
          </Link>
        ) : (
          <button
            type="button"
            className="py-1 text-center text-[1rem] text-muted underline underline-offset-2 transition-colors hover:text-ink"
            onClick={() => {
              setError(null);
              setEtape((v) => (v === 3 ? 2 : 1));
            }}
          >
            {t('Revenir à l’étape précédente')}
          </button>
        )
      }
    >
      <form onSubmit={suivant} className="flex flex-col gap-5" noValidate>
        {etape === 1 && (
          <Field label={t('E-mail')} htmlFor="su-email" hint={t('Un lien de confirmation vous sera envoyé.')}>
            <Input
              id="su-email"
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
              err={error?.kind === 'email' || error?.kind === 'exists'}
              autoFocus
            />
          </Field>
        )}

        {etape === 2 && (
          <PasswordField
            id="su-password"
            label={t('Mot de passe')}
            autoComplete="new-password"
            placeholder={t('Choisissez un mot de passe')}
            value={password}
            onChange={(v) => {
              setPassword(v);
              // Le mot de passe change : la confirmation déjà saisie ne veut plus rien dire.
              setConfirmation('');
              setError(null);
            }}
            err={error?.kind === 'password'}
            autoFocus
          />
        )}

        {etape === 3 && (
          <>
            <PasswordField
              id="su-confirm"
              label={t('Confirmer le mot de passe')}
              autoComplete="new-password"
              placeholder={t('Saisissez-le à nouveau')}
              value={confirmation}
              onChange={setConfirmation}
              err={accord === 'different'}
              autoFocus
            />
            <MatchHint etat={accord} />
          </>
        )}

        {error && (
          <AuthError texte={error.text}>
            {error.kind === 'exists' && (
              <div className="g2">
                <Link to={`/connexion?role=${role}&next=${encodeURIComponent(next)}`} className="btn sm">
                  {t('Se connecter')}
                </Link>
                <Link to={`/connexion/oubli?email=${encodeURIComponent(id())}`} className="btn g sm">
                  {t('Mot de passe oublié')}
                </Link>
              </div>
            )}
          </AuthError>
        )}

        <Button type="submit" loading={busy} disabled={etape === 3 && accord !== 'ok'}>
          {etape === 3 ? t('Créer mon compte') : t('Continuer')}
          {etape !== 3 && <I icon={ArrowRight} size={18} />}
        </Button>

        {etape === 1 && (
          <p className="t3 text-center leading-[1.5]">
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
        )}
      </form>
    </AuthShell>
  );
}
