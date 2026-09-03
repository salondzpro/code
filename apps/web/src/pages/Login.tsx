import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { Field } from '@/components/Field';
import { ErrorMessage } from '@/components/ErrorMessage';

const emailSchema = z.string().trim().toLowerCase().email();

export function Login() {
  const { session, signInWithEmailOtp, verifyEmailOtp } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get('role') === 'pro' ? 'pro' : undefined;
  const next = params.get('next') || (role === 'pro' ? '/pro' : '/compte/reservations');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (session) return <Navigate to={next} replace />;

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(new Error('Adresse email invalide.'));
    setBusy(true);
    try {
      await signInWithEmailOtp(parsed.data, role);
      setEmail(parsed.data);
      setStep('code');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6,8}$/.test(code.trim())) return setError(new Error('Le code contient 6 chiffres.'));
    setBusy(true);
    try {
      await verifyEmailOtp(email, code.trim());
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="card flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">{role === 'pro' ? 'Espace professionnel' : 'Connexion'}</h1>
        <p className="text-sm text-muted">Pas de mot de passe : recevez un code à usage unique par email.</p>
        {step === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <Field label="Email" required>
              {(id) => <input id={id} className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
            </Field>
            <ErrorMessage error={error} />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Envoi…' : 'Recevoir mon code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <p className="text-sm">
              Code envoyé à <strong>{email}</strong>.
            </p>
            <Field label="Code reçu" required>
              {(id) => <input id={id} className="input tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} required />}
            </Field>
            <ErrorMessage error={error} />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Vérification…' : 'Se connecter'}
            </button>
            <button type="button" className="text-sm text-muted underline" onClick={() => setStep('email')}>
              Changer d'adresse / renvoyer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
