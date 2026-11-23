/**
 * BADGES DES BOUTIQUES (23 nov. 2026) — « Télécharger dans l'App Store » et « Disponible sur Google
 * Play », sur le site seulement (jamais dans l'application). `pro` = l'application Salon DZ Pro.
 * Sur un téléphone, seul le badge de SON système s'affiche ; sur ordinateur, les deux.
 */
import { AppleLogo, GooglePlayLogo } from './BrandIcons';
import { APP_STORE_PRO_URL, APP_STORE_URL, PLAY_STORE_PRO_URL, PLAY_STORE_URL, mobileOS } from '@/lib/appLinks';
import { NATIF } from '@/lib/flavor';
import { t } from '@/i18n';

export function StoreBadges({ pro = false, tone = 'dark', className = '' }: { pro?: boolean; tone?: 'dark' | 'light'; className?: string }) {
  if (NATIF) return null;
  const os = mobileOS();
  const apple = pro ? APP_STORE_PRO_URL : APP_STORE_URL;
  const play = pro ? PLAY_STORE_PRO_URL : PLAY_STORE_URL;
  return (
    <div className={`sb ${tone} ${className}`}>
      {os !== 'android' && (
        <a className="sb-b" href={apple} target="_blank" rel="noopener noreferrer">
          <AppleLogo size={22} />
          <span>
            <small>{t('Télécharger dans')}</small>
            <b>App Store</b>
          </span>
        </a>
      )}
      {os !== 'ios' && (
        <a className="sb-b" href={play} target="_blank" rel="noopener noreferrer">
          <GooglePlayLogo size={20} />
          <span>
            <small>{t('Disponible sur')}</small>
            <b>Google Play</b>
          </span>
        </a>
      )}
    </div>
  );
}
