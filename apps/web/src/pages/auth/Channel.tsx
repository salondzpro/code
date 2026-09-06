/** AUTH 06 / 07 — Canal de vérification (WhatsApp par défaut, SMS) puis envoi du code. */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Mail, MessageCircle } from 'lucide-react';
import { useAuth, type OtpChannel } from '@/lib/auth';
import { EMAIL_FALLBACK, formatIntlDZ, readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Badge, Button, Card, I, InfoBox, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

const LABEL: Record<OtpChannel, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'e-mail' };

export function Channel() {
  const navigate = useNavigate();
  const { sendPhoneOtp, sendEmailOtp } = useAuth();
  const flow = readAuthFlow();
  const isEmail = flow?.channel === 'email';
  const [channel, setChannel] = useState<OtpChannel>(flow?.channel ?? 'whatsapp');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!flow?.identifier) return <Navigate to="/connexion" replace />;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      if (channel === 'email') await sendEmailOtp(flow.identifier, flow.role);
      else await sendPhoneOtp(flow.identifier, channel, flow.role);
      writeAuthFlow({ channel, sentAt: Date.now() });
      navigate('/connexion/code');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  if (sending) {
    // AUTH 07 — Envoi du code
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-ink" aria-hidden />
        <div className="h2">Envoi du code {channel === 'email' ? 'par e-mail' : `sur ${LABEL[channel]}`}…</div>
        <div className="p">{isEmail ? flow.identifier : formatIntlDZ(flow.identifier)}</div>
      </div>
    );
  }

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/connexion" right="Étape 2 sur 3" />
      <h1 className="h1">Comment recevoir le code ?</h1>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Canal de vérification">
        {!isEmail && (
          <>
            <Card as="button" sel={channel === 'whatsapp'} onClick={() => setChannel('whatsapp')} className="!flex-row items-center gap-4">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-ok-bg text-ok-fg">
                <I icon={MessageCircle} size={20} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[20px] font-semibold">WhatsApp</span>
                <span className="p block">Recommandé · instantané et gratuit</span>
              </span>
              <Badge tone="ok" dot={false} md>
                Par défaut
              </Badge>
            </Card>
            <Card as="button" sel={channel === 'sms'} onClick={() => setChannel('sms')} className="!flex-row items-center gap-4">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full border border-line bg-surface text-text">
                <I icon={MessageCircle} size={20} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[20px] font-semibold">SMS</span>
                <span className="p block">Si WhatsApp n'est pas installé</span>
              </span>
            </Card>
          </>
        )}
        {(isEmail || EMAIL_FALLBACK) && (
          <Card as="button" sel={channel === 'email'} onClick={() => setChannel('email')} className="!flex-row items-center gap-4">
            <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full border border-line bg-surface text-text">
              <I icon={Mail} size={20} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[20px] font-semibold">E-mail</span>
              <span className="p block">{isEmail ? flow.identifier : 'Si le téléphone ne reçoit pas de code'}</span>
            </span>
          </Card>
        )}
      </div>
      <InfoBox>
        Le code arrive sur <b className="text-text">{isEmail || channel === 'email' ? flow.identifier : formatIntlDZ(flow.identifier)}</b>. Vous pouvez modifier le numéro.
      </InfoBox>
      {error && (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void send()}>{channel === 'email' ? 'Envoyer par e-mail' : `Envoyer sur ${LABEL[channel]}`}</Button>
    </Screen>
  );
}
