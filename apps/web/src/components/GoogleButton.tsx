/**
 * « Continuer avec Google » (21 nov. 2026) — UN composant pour tous les endroits où l'on se connecte :
 * écrans d'accès client et pro (`pages/auth/Acces.tsx`) et étape « 3. Identification » de la
 * réservation (`BookingWhen`). Affiché seulement quand Google est activé sur Supabase.
 */
import { useState } from 'react';
import { GoogleLogo } from './BrandIcons';
import { AuthError } from './AuthShell';
import { connexionGoogle, useGoogleDisponible } from '@/lib/googleAuth';
import { writeAuthFlow } from '@/lib/authFlow';
import { t } from '@/i18n';

export function GoogleButton({ role, next }: { role: 'client' | 'pro'; next: string }) {
  const dispo = useGoogleDisponible();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!dispo) return null;
  return (
    <>
      <button
        type="button"
        className="pl-btn pl-btn-out pl-google"
        disabled={busy}
        onClick={() => {
          setErr(null);
          setBusy(true);
          writeAuthFlow({ role, next, identifier: '', channel: 'email' });
          connexionGoogle(role, next)
            .catch(() => setErr(t('Connexion avec Google impossible pour le moment. Réessayez.')))
            .finally(() => setBusy(false));
        }}
      >
        <GoogleLogo size={20} />
        {t('Continuer avec Google')}
      </button>
      {err && <AuthError texte={err} />}
    </>
  );
}
