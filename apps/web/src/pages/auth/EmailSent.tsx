/**
 * « Vérifiez votre boîte mail » : l'écran vit dans `pages/auth/Acces.tsx` (`/acces/envoye`,
 * `/pro/acces/envoye`), avec le bouton au logo de la messagerie. `/connexion/envoye` reste branchée
 * (anciens signets) et renvoie au bon portail d'après le rôle du parcours en cours.
 */
import { Navigate, useSearchParams } from 'react-router';
import { readAuthFlow } from '@/lib/authFlow';

export function EmailSent() {
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'confirm';
  const base = readAuthFlow()?.role === 'pro' ? '/pro/acces' : '/acces';
  return <Navigate to={`${base}/envoye?mode=${mode}`} replace />;
}
