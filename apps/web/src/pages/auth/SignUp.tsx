/**
 * ANCIENNE INSCRIPTION, DEVENUE UN RELAIS (14 nov. 2026). Créer un compte et se connecter ne sont
 * plus deux portes : c'est l'adresse e-mail, saisie en premier (`pages/auth/Acces.tsx`), qui dit
 * si l'on crée ou si l'on se connecte. `/inscription` reste branchée pour les anciens liens.
 *
 * `PASSWORD_MIN` reste exporté d'ici : les écrans d'accès et le nouveau mot de passe s'en servent.
 */
import { Navigate, useSearchParams } from 'react-router';
import { readAuthFlow } from '@/lib/authFlow';

export const PASSWORD_MIN = 8;

export function SignUp() {
  const [params] = useSearchParams();
  const pro = params.get('role') === 'pro';
  const next = params.get('next') ?? readAuthFlow()?.next ?? (pro ? '/pro' : '/');
  return <Navigate to={`${pro ? '/pro/acces' : '/acces'}?next=${encodeURIComponent(next)}`} replace />;
}
