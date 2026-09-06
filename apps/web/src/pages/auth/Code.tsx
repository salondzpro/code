/**
 * AUTH 08 → 12 — Saisie du code à 6 chiffres : code envoyé, incorrect (tentatives restantes),
 * expiré (renvoyer + compte à rebours), erreur réseau (réessayer), puis « Numéro vérifié ».
 */
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { AlertCircle, Check, MessageCircle, WifiOff } from 'lucide-react';
import { ApiError } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { clearAuthFlow, formatIntlDZ, readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Button, Card, I, Toggle, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

const RESEND_SECONDS = 30;
const MAX_ATTEMPTS = 3;

type Status = 'idle' | 'verifying' | 'wrong' | 'expired' | 'network' | 'verified';

export function Code() {
  const navigate = useNavigate();
  const { verifyPhoneOtp, verifyEmailOtp, sendPhoneOtp, sendEmailOtp } = useAuth();
  const flow = readAuthFlow();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [status, setStatus] = useState<Status>('idle');
  const [attempts, setAttempts] = useState(0);
  const [stay, setStay] = useState(true);
  const [resendIn, setResendIn] = useState(() => Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - (flow?.sentAt ?? 0)) / 1000)));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!flow?.identifier) return <Navigate to="/connexion" replace />;
  const isEmail = flow.channel === 'email';
  const shown = isEmail ? flow.identifier : formatIntlDZ(flow.identifier);
  const code = digits.join('');
  const complete = code.length === 6 && digits.every((d) => d !== '');

  const setAt = (i: number, v: string) => {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (status === 'wrong' || status === 'network') setStatus('idle');
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const onChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, '');
    if (!v) return setAt(i, '');
    if (v.length > 1) {
      // saisie/collage de plusieurs chiffres
      const next = [...digits];
      for (let k = 0; k < v.length && i + k < 6; k++) next[i + k] = v[k]!;
      setDigits(next);
      inputs.current[Math.min(5, i + v.length)]?.focus();
      return;
    }
    setAt(i, v);
    if (i < 5) inputs.current[i + 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (v.length) {
      e.preventDefault();
      setDigits([...v.padEnd(6, ' ')].map((c) => (c === ' ' ? '' : c)));
      inputs.current[Math.min(5, v.length)]?.focus();
    }
  };

  const verify = async () => {
    if (!complete) return;
    setStatus('verifying');
    try {
      if (isEmail) await verifyEmailOtp(flow.identifier, code);
      else await verifyPhoneOtp(flow.identifier, code);
      setStatus('verified');
    } catch (err) {
      const msg = errorText(err).toLowerCase();
      const isNetwork = (err instanceof ApiError && err.isNetwork) || /fetch|network|réseau|connexion/.test(msg);
      if (isNetwork) return setStatus('network');
      if (/expired|expiré/.test(msg)) return setStatus('expired');
      setAttempts((a) => a + 1);
      setStatus('wrong');
    }
  };

  const resend = async () => {
    try {
      if (isEmail) await sendEmailOtp(flow.identifier, flow.role);
      else await sendPhoneOtp(flow.identifier, flow.channel === 'sms' ? 'sms' : 'whatsapp', flow.role);
      writeAuthFlow({ sentAt: Date.now() });
      setResendIn(RESEND_SECONDS);
      setDigits(Array(6).fill(''));
      setAttempts(0);
      setStatus('idle');
      inputs.current[0]?.focus();
    } catch (err) {
      setStatus(/network|fetch/.test(errorText(err).toLowerCase()) ? 'network' : 'idle');
    }
  };

  if (status === 'verified') {
    // AUTH 12 — Vérification réussie
    return (
      <Screen className="min-h-dvh justify-center" gap={16}>
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-ok-bg text-ok-fg">
          <I icon={Check} size={40} />
        </div>
        <div>
          <h1 className="h1">Numéro vérifié</h1>
          <p className="p mt-3">
            <b className="text-text">{shown}</b> est confirmé. Vous restez connecté sur cet appareil : aucun nouveau code ne vous sera envoyé.
          </p>
        </div>
        <Button
          onClick={() => {
            const next = flow.next;
            clearAuthFlow();
            navigate(`/profil/creer?next=${encodeURIComponent(next)}`, { replace: true });
          }}
        >
          Continuer
        </Button>
      </Screen>
    );
  }

  const expired = status === 'expired' || attempts >= MAX_ATTEMPTS;
  const remaining = MAX_ATTEMPTS - attempts;
  const resendLabel = isEmail ? 'Renvoyer par e-mail' : flow.channel === 'sms' ? 'Renvoyer par SMS' : 'Renvoyer sur WhatsApp';

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/connexion/canal" right="Étape 3 sur 3" />
      <h1 className="h1">{status === 'idle' && attempts === 0 ? 'Code envoyé' : 'Saisir le code'}</h1>

      {status === 'idle' && attempts === 0 && (
        <div className="rounded-[20px] bg-ok-bg p-4 text-[15px] leading-[1.45]">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-surface text-ok-fg">
              <I icon={MessageCircle} size={20} />
            </span>
            <span>
              <span className="block text-[17px] font-semibold">{isEmail ? 'E-mail · Beauty' : flow.channel === 'sms' ? 'SMS · Beauty' : 'WhatsApp · Beauty'}</span>
              <span className="s block">maintenant</span>
            </span>
          </div>
          Votre code de vérification arrive sur <b>{shown}</b>. Il expire dans 5 minutes.
        </div>
      )}

      <div className="flex gap-2.5" aria-label="Code à 6 chiffres">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            className={`inp !p-0 h-[68px] text-center text-[22px] font-medium${d ? ' f' : ''}${status === 'wrong' ? ' err' : ''}`}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            aria-label={`Chiffre ${i + 1}`}
            autoFocus={i === 0}
            disabled={expired}
          />
        ))}
      </div>
      {status === 'idle' && attempts === 0 && <p className="p text-[14px]">Coller automatiquement depuis {isEmail ? 'votre messagerie' : 'WhatsApp'}</p>}

      {status === 'wrong' && !expired && (
        <p className="flex items-center gap-2 text-[14px] text-danger" role="alert">
          <I icon={AlertCircle} size={16} />
          Code incorrect — {remaining} tentative{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}.
        </p>
      )}
      {expired && (
        <p className="flex items-center gap-2 text-[14px] text-danger" role="alert">
          <I icon={AlertCircle} size={16} />
          {attempts >= MAX_ATTEMPTS ? 'Trop de tentatives. Demandez un nouveau code.' : 'Code expiré. Demandez-en un nouveau.'}
        </p>
      )}
      {status === 'network' && (
        <p className="flex items-center gap-2 text-[14px] text-danger" role="alert">
          <I icon={WifiOff} size={16} />
          Connexion perdue. Vérification impossible.
        </p>
      )}

      {!expired && status !== 'network' && (
        <Card className="!flex-row items-center justify-between">
          <span>
            <span className="block text-[16px]">Rester connecté</span>
            <span className="p block text-[14px]">Session illimitée · aucun code à la prochaine visite</span>
          </span>
          <Toggle on={stay} onChange={setStay} label="Rester connecté" />
        </Card>
      )}

      {status === 'network' ? (
        <Button onClick={() => void verify()}>Réessayer</Button>
      ) : expired ? (
        <>
          <Button onClick={() => void resend()} disabled={resendIn > 0}>
            {resendLabel}
          </Button>
          {resendIn > 0 && (
            <p className="p text-center text-[14px]">
              Nouveau code disponible dans 0:{String(resendIn).padStart(2, '0')}
            </p>
          )}
        </>
      ) : (
        <>
          <Button onClick={() => void verify()} disabled={!complete || status === 'verifying'}>
            {status === 'verifying' ? 'Vérification…' : 'Vérifier'}
          </Button>
          {status === 'wrong' && (
            <button type="button" className="text-center text-[15px] text-muted underline" onClick={() => void resend()} disabled={resendIn > 0}>
              {resendIn > 0 ? `Renvoyer le code (0:${String(resendIn).padStart(2, '0')})` : 'Renvoyer le code'}
            </button>
          )}
        </>
      )}
    </Screen>
  );
}
