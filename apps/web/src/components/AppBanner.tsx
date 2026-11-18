/**
 * FAVORISER L'APPLICATION, côté site (18 nov. 2026) — `lib/appLinks.ts` décide ; ici, l'affichage :
 *   - `AppBanner` : barre en haut des pages de salon et de réservation (téléphone, site seulement) :
 *     l'icône, « Salon DZ », et « Ouvrir » (l'application si elle est là, sinon le bon store). Fermée,
 *     elle ne revient pas de la session ;
 *   - `AppInstallCard` : après la réservation, « Suivez votre rendez-vous dans l'application » et le
 *     bouton du store du téléphone (logo officiel App Store ou Google Play).
 */
import { useState } from 'react';
import { useLocation } from 'react-router';
import { X } from 'lucide-react';
import { mobileOS, openInApp, storeUrl } from '@/lib/appLinks';
import { Button, I } from './ui';
import { t } from '@/i18n';

const FERMEE = 'salondz:app-banner:fermee';

/** Logo officiel Apple (glyphe monochrome). */
const AppleLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.66ZM14.1 6c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.76-.95 2.8 1.01.08 2.04-.51 2.67-1.27Z" />
  </svg>
);

/** Logo officiel Google Play (triangle aux quatre couleurs). */
const PlayLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M3.6 1.8 13.4 12 3.6 22.2c-.35-.2-.6-.6-.6-1.1V2.9c0-.5.25-.9.6-1.1Z" fill="#00d7fe" />
    <path d="M16.9 8.5 13.4 12 3.6 1.8c.3-.2.75-.2 1.15.02L16.9 8.5Z" fill="#00f076" />
    <path d="m16.9 15.5-12.15 6.68c-.4.22-.85.22-1.15.02L13.4 12l3.5 3.5Z" fill="#ff3a44" />
    <path d="m20.4 10.4-3.5-1.9L13.4 12l3.5 3.5 3.5-1.9c.95-.53.95-1.67 0-2.2Z" fill="#ffd500" />
  </svg>
);

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
      <img src="/icon-192.png" alt="" className="app-bn-ic" />
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

export function AppInstallCard() {
  const os = mobileOS();
  if (!os) return null;
  return (
    <div className="crd !gap-3">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="app-bn-ic" />
        <b className="min-w-0 flex-1 text-[1rem] font-semibold">{t('Suivez votre rendez-vous dans l’application')}</b>
      </div>
      <a href={storeUrl(os)} target="_blank" rel="noreferrer" className="btn store-btn">
        {os === 'ios' ? <AppleLogo size={20} /> : <PlayLogo size={20} />}
        {os === 'ios' ? t('Télécharger sur l’App Store') : t('Disponible sur Google Play')}
      </a>
    </div>
  );
}
