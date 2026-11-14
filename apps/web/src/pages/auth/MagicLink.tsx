/**
 * Lien de connexion par e-mail : il a désormais sa place dans le parcours « e-mail d'abord »
 * (`pages/auth/Acces.tsx`, bouton « Recevoir un lien de connexion » de l'écran du mot de passe).
 * Cette adresse, `/connexion/lien`, reste branchée pour les anciens signets : elle renvoie à l'écran
 * de l'adresse, en gardant l'adresse déjà saisie et la destination.
 */
import { Navigate, useSearchParams } from 'react-router';
import { readAuthFlow } from '@/lib/authFlow';
import { MARCHE } from '@/lib/flavor';

export function MagicLink() {
  const [params] = useSearchParams();
  const pro = params.get('role') === 'pro';
  const q = new URLSearchParams({ next: params.get('next') ?? readAuthFlow()?.next ?? (pro ? '/pro' : MARCHE) });
  const email = params.get('email') ?? readAuthFlow()?.identifier;
  if (email) q.set('email', email);
  return <Navigate to={`${pro ? '/pro/acces' : '/acces'}?${q.toString()}`} replace />;
}
