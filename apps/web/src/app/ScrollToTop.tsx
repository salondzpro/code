/**
 * Toute page s'ouvre en haut, sur sa première section : le navigateur restaure sinon la position de la page
 * précédente (impression de « page déjà défilée »). Le retour navigateur garde son comportement naturel.
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';

export function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, type]);
  return <Outlet />;
}
