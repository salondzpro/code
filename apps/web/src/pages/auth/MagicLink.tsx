/**
 * Lien de connexion par e-mail : sa PAGE, avec son champ et son bouton.
 *
 * Auparavant, le bouton du portail se servait de l'adresse tapée dans le formulaire de connexion.
 * Quelqu'un qui venait justement parce qu'il ne veut pas de mot de passe trouvait donc un champ
 * vide et un refus (« Indiquez votre adresse e-mail »). Une porte doit ouvrir sur quelque chose,
 * pas renvoyer en arrière.
 *
 * L'adresse déjà saisie sur le portail est reprise en paramètre : on ne la fait pas retaper.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { MailOpen } from 'lucide-react';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, Field, I, Input } from '@/components/ui';
import { AuthError, AuthShell } from '@/components/AuthShell';
import { EMAIL_RE } from './Login';
import { t } from '@/i18n';

export function MagicLink() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { sendMagicLink } = useAuth();
  const next = params.get('next') ?? readAuthFlow()?.next ?? '/';
  const role = params.get('role') === 'pro' ? 'pro' : 'client';
  const [email, setEmail] = useState(params.get('email') ?? readAuthFlow()?.identifier ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError(t("Adresse e-mail invalide."));
    setBusy(true);
    setError(null);
    try {
      writeAuthFlow({ role, next, identifier: id, channel: 'email', sentAt: Date.now() });
      await sendMagicLink(id, next);
      navigate('/connexion/envoye?mode=link', { replace: true });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      role={role}
      back={`/connexion?role=${role}`}
      titre="Recevoir un lien de connexion"
      sous={t('Indiquez votre adresse : vous recevrez un lien qui vous connecte directement, sans mot de passe.')}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label={t('E-mail')} htmlFor="ml-email">
          <Input
            id="ml-email"
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
            err={!!error}
            autoFocus
          />
        </Field>
        {error && <AuthError texte={error} />}
        <Button type="submit" loading={busy}>
          <I icon={MailOpen} size={18} /> {t('Recevoir le lien')}
        </Button>
      </form>
    </AuthShell>
  );
}
