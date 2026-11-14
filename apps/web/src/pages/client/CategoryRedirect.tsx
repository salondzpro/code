/**
 * Ancienne page « résultats d'une catégorie » : elle dupliquait la marketplace avec ses
 * propres filtres et ignorait le marché de la catégorie (une catégorie femmes ouverte sur un
 * compte hommes donnait zéro résultat). Un lien de catégorie mène désormais à la marketplace,
 * catégorie sélectionnée et marché aligné sur celui de la catégorie.
 */
import { Navigate, useParams } from 'react-router';
import { CATEGORY_BY_ID } from '@salondz/constants';
import { MARCHE } from '@/lib/flavor';

export function CategoryRedirect() {
  const { category = '' } = useParams();
  const def = CATEGORY_BY_ID.get(category);
  if (!def) return <Navigate to={MARCHE} replace />;
  return <Navigate to={`${MARCHE}?category=${encodeURIComponent(category)}&market=${def.market}`} replace />;
}
