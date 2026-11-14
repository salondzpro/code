/**
 * Toute page s'ouvre en haut, sur sa première section : le navigateur restaure sinon la position de la page
 * précédente (impression de « page déjà défilée »). Le retour navigateur garde son comportement naturel.
 */
import { noterPage } from '@/lib/pageView';
import { useEffect, useState } from 'react';
import { languageChosen } from '@/i18n';
import { isNative } from '@/lib/native';
import { PRO_ONLY } from '@/lib/flavor';
import { LangChoice } from '@/components/LangChoice';
import { HERO_MIXTE, HERO_PRO } from '@/components/HeroSlides';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { useProTheme } from '@/lib/proTheme';

export function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  // Racine de toutes les routes : seul endroit qui voit chaque changement de page.
  useProTheme();
  // PREMIER LANCEMENT DE L'APPLICATION (14 nov. 2026) : la langue d'abord, quelle que soit la page
  // d'arrivée (l'application cliente s'ouvre sur la place de marché, la pro sur sa bienvenue). Une
  // seule fois ; ensuite, la langue se change dans les réglages. Jamais sur le site.
  const [langue, setLangue] = useState(() => !isNative() || languageChosen());
  useEffect(() => noterPage(pathname), [pathname]);
  useEffect(() => {
    if (type === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, type]);
  if (!langue) return <LangChoice photos={PRO_ONLY ? HERO_PRO : HERO_MIXTE} pro={PRO_ONLY} onDone={() => setLangue(true)} />;
  return <Outlet />;
}
