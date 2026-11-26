/**
 * FAVORISER L'APPLICATION, côté site (18 nov. 2026) — `lib/appLinks.ts` décide ; ici, l'affichage :
 *   - `AppBanner` : barre en haut des pages de salon et de réservation (téléphone, site seulement) :
 *     l'icône, « Salon DZ », et « Ouvrir » (l'application si elle est là, sinon le bon store). Fermée,
 *     elle ne revient pas de la session ;
 *   - après la réservation : `AppHandoff.tsx` (passation façon Uber).
 */
import { useState } from 'react';
import { useLocation } from 'react-router';
import { X } from 'lucide-react';
import { mobileOS, openInApp } from '@/lib/appLinks';
import { Button, I } from './ui';
import { t } from '@/i18n';

const FERMEE = 'salondz:app-banner:fermee';

export function AppBanner() {
  const os = mobileOS();
  const { pathname } = useLocation();
  const [fermee, setFermee] = useState(() => {
    try {
      return sessionStorage.getItem(FERMEE) === '1';
    } catch {
      return false;
    }
  });
  if (!os || fermee) return null;
  const fermer = () => {
    try {
      sessionStorage.setItem(FERMEE, '1');
    } catch {
      /* rien */
    }
    setFermee(true);
  };
  // Une page de réservation s'ouvre dans l'application sur la page du salon (le brouillon est sur le site).
  const cible = pathname.replace(/^(\/s\/[^/]+).*$/, '$1');
  return (
    <div className="app-bn" role="region" aria-label={t('Application Salon DZ')}>
      <button type="button" className="app-bn-x" aria-label={t('Fermer')} onClick={fermer}>
        <I icon={X} size={16} />
      </button>
      <img src="/logo/app-client.png" alt="" className="app-bn-ic" />
      <span className="min-w-0 flex-1">
        <b>Salon DZ</b>
        <small>{os === 'ios' ? t('Sur l’App Store') : t('Sur Google Play')}</small>
      </span>
      <Button sm auto onClick={() => openInApp(cible)}>
        {t('Ouvrir')}
      </Button>
    </div>
  );
}
