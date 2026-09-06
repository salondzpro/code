/** AUTH 04 / 05 — Numéro de téléphone (+213 + 9 chiffres), erreur « numéro incomplet ». */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { EMAIL_FALLBACK, groupLocalDigits, readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Button, I, TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';

export function Phone() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = params.get('role') === 'pro' ? 'pro' : (readAuthFlow()?.role ?? 'client');
  const next = params.get('next') ?? readAuthFlow()?.next ?? (role === 'pro' ? '/pro' : '/');
  const [digits, setDigits] = useState(() => {
    const prev = readAuthFlow()?.identifier ?? '';
    return prev.startsWith('+213') ? prev.slice(4) : '';
  });
  const [email, setEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/connexion/retour" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (useEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Adresse e-mail invalide.');
      writeAuthFlow({ role, next, identifier: email.trim().toLowerCase(), channel: 'email' });
      navigate('/connexion/canal');
      return;
    }
    const local = digits.replace(/\D/g, '');
    if (local.length !== 9 || !/^[5-7]/.test(local)) return setError(`Numéro incomplet — 9 chiffres attendus après +213.`);
    setError(null);
    writeAuthFlow({ role, next, identifier: `+213${local}`, channel: 'whatsapp' });
    navigate('/connexion/canal');
  };

  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/bienvenue" right="Étape 1 sur 3" />
      <div>
        <h1 className="h1">Votre numéro</h1>
        <p className="p mt-3">Nous envoyons un code à 6 chiffres sur WhatsApp pour vérifier votre numéro.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {useEmail ? (
          <div>
            <input
              className={`inp lg${error ? ' err' : ''}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.dz"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              aria-label="Adresse e-mail"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex gap-2.5">
            <div className="flex flex-none items-center gap-2 rounded-[14px] bg-fill px-4 text-[17px] font-medium" aria-label="Indicatif +213">
              +213
              <I icon={ChevronDown} size={16} className="text-subtle" />
            </div>
            <input
              className={`inp lg${error ? ' err' : ''}`}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="6 61 24 87 90"
              value={groupLocalDigits(digits)}
              onChange={(e) => {
                setDigits(e.target.value.replace(/\D/g, '').slice(0, 9));
                setError(null);
              }}
              aria-label="Numéro de téléphone"
              autoFocus
            />
          </div>
        )}
        {error ? (
          <p className="flex items-center gap-2 text-[14px] text-danger" role="alert">
            <I icon={AlertCircle} size={16} />
            {error}
          </p>
        ) : (
          <p className="p text-[14px]">{useEmail ? 'Le code arrivera par e-mail.' : 'Format algérien · +213 XX XX XX XX'}</p>
        )}
        <Button type="submit">Recevoir le code</Button>
        {EMAIL_FALLBACK && (
          <button type="button" className="text-center text-[14px] text-muted underline" onClick={() => setUseEmail((v) => !v)}>
            {useEmail ? 'Utiliser un numéro de téléphone' : 'Recevoir le code par e-mail'}
          </button>
        )}
      </form>
    </Screen>
  );
}
