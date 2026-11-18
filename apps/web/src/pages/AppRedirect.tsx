/**
 * `salondz.com/app` (18 nov. 2026) — UN lien pour l'application, imprimable et scannable (QR de la
 * passation sur ordinateur) : sur téléphone, l'application si elle est installée (iPhone : lien
 * universel ; Android : `intent://` avec repli sur Google Play), sinon le bon store ; sur ordinateur,
 * les deux boutons.
 */
import { useEffect } from 'react';
import { Screen } from '@/components/AppFrame';
import { TopBar } from '@/components/ui';
import { AppHandoffCard } from '@/components/AppHandoff';
import { APP_STORE_URL, PLAY_STORE_URL, mobileOS } from '@/lib/appLinks';
import { MARCHE } from '@/lib/flavor';
import { t } from '@/i18n';

export function AppRedirect() {
  const os = mobileOS();
  useEffect(() => {
    if (os === 'android') {
      window.location.replace(`intent://reprise?d=${encodeURIComponent('/')}#Intent;scheme=salondz;package=dz.salondz.app;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`);
    } else if (os === 'ios') {
      window.location.replace(APP_STORE_URL);
    }
  }, [os]);
  return (
    <Screen gap={14}>
      <TopBar backTo={MARCHE} title={t('Application Salon DZ')} />
      <AppHandoffCard />
    </Screen>
  );
}
