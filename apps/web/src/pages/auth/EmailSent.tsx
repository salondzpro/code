/**
 * « Vérifiez votre e-mail » : après l'inscription (lien de confirmation), une demande de lien
 * de connexion, ou une réinitialisation de mot de passe. Renvoi possible après un délai.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { authErrorText, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button } from '@/components/ui';
import { AuthError, AuthShell } from '@/components/AuthShell';
import { t } from '@/i18n';

const RESEND_SECONDS = 60;
type Mode = 'confirm' | 'link' | 'reset';

/**
 * UNE LIGNE SOUS LE TITRE, ET RIEN D'AUTRE. L'écran portait le titre, un paragraphe, l'adresse en
 * encadré, un encadré « rien reçu ? », le bouton et un lien : six blocs pour une seule chose à
 * faire. Tout ce qui se répète a sauté — l'adresse figure déjà dans le courrier qu'on vient de
 * recevoir, et l'on ne lit pas un avertissement sur les courriers indésirables avant d'avoir
 * constaté qu'il manque quelque chose.
 */
const TEXT: Record<Mode, { title: string; body: string; resend: string }> = {
  confirm: {
    title: t("Confirmez votre adresse mail"),
    body: 'Cliquez sur le lien reçu dans votre boîte mail.',
    resend: 'Renvoyer le lien',
  },
  link: {
    title: t("Lien de connexion envoyé"),
    body: 'Cliquez sur le lien reçu dans votre boîte mail.',
    resend: 'Renvoyer le lien',
  },
  reset: {
    title: t("E-mail envoyé"),
    body: 'Cliquez sur le lien reçu pour choisir un mot de passe.',
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
    <AuthShell back="/connexion" titre={txt.title} sous={<>{txt.body}</>}>
      {error && <AuthError texte={error} />}

      <div className="flex flex-col gap-2.5">
        <Button variant="g" loading={busy} onClick={() => void resend()} disabled={busy || resendIn > 0}>
          {resendIn > 0 ? `${txt.resend} (${resendIn} s)` : sent ? t('Renvoyé') : txt.resend}
        </Button>
        {/* La seule porte de sortie quand l'adresse a été mal tapée : deux mots, mais indispensables. */}
        <button
          type="button"
          className="py-1 text-center text-[1rem] text-muted underline underline-offset-2 transition-colors hover:text-ink"
          onClick={() => navigate('/connexion')}
        >
          {t('Changer d’adresse')}
        </button>
      </div>
    </AuthShell>
  );
}
