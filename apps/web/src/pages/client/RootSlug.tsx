import { Navigate, useLocation, useParams } from 'react-router';
import { isRootSlug } from '@salondz/constants';
import { NotFound } from '@/pages/NotFound';

/**
 * `salondz.com/<slug>` — lien court imprimé sur les étiquettes (`shortSalonPath`). Redirige sans
 * rechargement vers la page du salon, en gardant la chaîne de requête ; toute autre adresse
 * inconnue reste une page introuvable.
 */
export function RootSlug() {
  const { slug = '' } = useParams();
  const { search, hash } = useLocation();
  const s = slug.toLowerCase();
  if (!isRootSlug(s)) return <NotFound />;
  return <Navigate to={`/s/${s}${search}${hash}`} replace />;
}
