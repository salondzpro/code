/**
 * Comptes de DÉMONSTRATION seulement : numéro de démonstration + code fixe à 4 chiffres →
 * vraie session délivrée par l'API. La connexion des vrais comptes passe par e-mail et mot
 * de passe (`Login`).
 */
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { isTestPhone } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { clearAuthFlow, formatIntlDZ, readAuthFlow } from '@/lib/authFlow';
import { errorText } from '@/components/ErrorMessage';
import { Button, I, InfoBox, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { t } from '@/i18n';

export function Code() {
  const navigate = useNavigate();
  const { demoLogin } = useAuth();
  const flow = readAuthFlow();
  const [digits, setDigits] = useState<string[]>(Array(4).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  if (!flow?.identifier || !isTestPhone(flow.identifier)) return <Navigate to="/connexion" replace />;
  const code = digits.join('');
  const complete = digits.every((d) => d !== '');

  const onChange = (i: number, raw: string) => {
    const v = raw.replace(/\D/g, '');
    const next = [...digits];
    if (!v) next[i] = '';
    else for (let k = 0; k < v.length && i + k < 4; k++) next[i + k] = v[k]!;
    setDigits(next);
    setError(null);
    if (v) inputs.current[Math.min(3, i + v.length)]?.focus();
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (v.length) {
      e.preventDefault();
      setDigits([...v.padEnd(4, ' ')].map((c) => (c === ' ' ? '' : c)));
      inputs.current[Math.min(3, v.length)]?.focus();
    }
  };

  const verify = async () => {
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      await demoLogin(flow.identifier, code);
      const role = flow.role;
      const next = flow.next;
      clearAuthFlow();
      navigate(role === 'pro' ? '/pro' : next || '/', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/connexion" right="Démonstration" />
      <h1 className="h1">{t("Code de démonstration")}</h1>
      <InfoBox>
        {t("Compte de démonstration")}{' '}<b className="text-text">{formatIntlDZ(flow.identifier)}</b> {t(": saisissez le code fixe à 4 chiffres.")}
      </InfoBox>
      <div className="flex gap-2.5" aria-label={t("Code à 4 chiffres")}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            className={`inp !p-0 h-[4.25rem] text-center text-[1.143rem] font-medium${d ? ' f' : ''}${error ? ' err' : ''}`}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={4}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            aria-label={`Chiffre ${i + 1}`}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {error && (
        <p className="flex items-center gap-2 text-[1rem] text-danger" role="alert">
          <I icon={AlertCircle} size={16} /> {error}
        </p>
      )}
      <Button onClick={() => void verify()} disabled={!complete || busy}>
        {busy ? 'Vérification…' : 'Vérifier'}
      </Button>
    </Screen>
  );
}
