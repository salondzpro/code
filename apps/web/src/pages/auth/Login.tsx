/**
 * ANCIENNE PORTE DE CONNEXION, DEVENUE UN RELAIS (14 nov. 2026). Le portail client est refait sur le
 * modèle du portail pro : une ouverture (`pages/auth/Welcome.tsx`, `/intro`), puis l'adresse e-mail
 * d'abord (`pages/auth/Acces.tsx`, `/acces/*`). Cette adresse, `/connexion`, reste branchée partout
 * (gardes, liens d'e-mails, anciens signets) : elle garde la destination visée, l'adresse déjà
 * tapée et l'erreur d'un lien périmé, puis envoie au bon parcours — celui du pro pour `?role=pro`.
 *
 * `EMAIL_RE` reste exporté d'ici : les écrans d'accès s'en servent.
 */
import { Navigate, useSearchParams } from 'react-router';
import { readAuthFlow } from '@/lib/authFlow';
import { useAuth } from '@/lib/auth';
import { HOME, PRO_ONLY } from '@/lib/flavor';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const pro = PRO_ONLY || params.get('role') === 'pro';
  const next = params.get('next') ?? readAuthFlow()?.next ?? (pro ? '/pro' : HOME);
  if (session) return <Navigate to={`/connexion/retour?next=${encodeURIComponent(next)}`} replace />;
  const q = new URLSearchParams({ next });
  const email = params.get('email');
  if (email) q.set('email', email);
  const erreur = params.get('erreur');
  if (erreur) q.set('erreur', erreur);
  return <Navigate to={`${pro ? '/pro/acces' : '/acces'}?${q.toString()}`} replace />;
}
