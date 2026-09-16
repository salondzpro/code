/**
 * « Vérifiez votre e-mail » : après l'inscription (lien de confirmation), une demande de lien
 * de connexion, ou une réinitialisation de mot de passe. Renvoi possible après un délai.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, I, InfoBox, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

const RESEND_SECONDS = 60;
type Mode = 'confirm' | 'link' | 'reset';

const TEXT: Record<Mode, { title: string; body: string; resend: string }> = {
  confirm: {
    title: t("Confirmez votre adresse"),
    body: 'Nous venons d’envoyer un lien de confirmation. Ouvrez-le depuis ce téléphone pour activer votre compte.',
    resend: 'Renvoyer le lien de confirmation',
  },
  link: {
    title: t("Lien de connexion envoyé"),
    body: 'Si un compte existe avec cette adresse, vous recevez un lien : il vous connecte directement, sans mot de passe.',
    resend: 'Renvoyer le lien de connexion',
  },
  reset: {
    title: t("E-mail envoyé"),
    body: 'Si un compte existe avec cette adresse, vous recevez un lien pour choisir un nouveau mot de passe.',
    resend: 'Renvoyer l’e-mail',
  },
};

export function EmailSent() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, resendConfirmation, sendMagicLink, sendPasswordReset } = useAuth();
  const flow = readAuthFlow();
  const mode = (params.get('mode') as Mode) || 'confirm';
  const email = flow?.identifier ?? '';
  const [resendIn, setResendIn] = useState(() =>
    Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - (flow?.sentAt ?? 0)) / 1000)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // Le lien a été ouvert dans cet onglet : la session existe, on continue.
  if (session && mode !== 'reset') return <Navigate to={`/connexion/retour?next=${encodeURIComponent(flow?.next ?? '/')}`} replace />;
  if (!email) return <Navigate to="/connexion" replace />;
  const txt = TEXT[mode];

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'confirm') await resendConfirmation(email, flow?.next ?? '/');
      else if (mode === 'link') await sendMagicLink(email, flow?.next ?? '/');
      else await sendPasswordReset(email);
      writeAuthFlow({ sentAt: Date.now() });
      setResendIn(RESEND_SECONDS);
      setSent(true);
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/connexion" />
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <I icon={MailCheck} size={34} />
        </span>
        <h1 className="h1">{txt.title}</h1>
        <p className="p">
          {txt.body}
          <br />
          <b className="text-text">{email}</b>
        </p>
      </div>
      <InfoBox>
        {t("Rien reçu ? Regardez dans les courriers indésirables. Le lien reste valable une heure.")}
      </InfoBox>
      {error && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button variant="g" onClick={() => void resend()} disabled={busy || resendIn > 0}>
        {busy ? 'Envoi…' : resendIn > 0 ? `${txt.resend} (${resendIn} s)` : sent ? 'Renvoyé' : txt.resend}
      </Button>
      <button type="button" className="text-center text-[1rem] text-muted underline" onClick={() => navigate('/connexion')}>
        {t("Changer d’adresse ou se connecter autrement")}
      </button>
    </Screen>
  );
}
