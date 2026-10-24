/**
 * NOTIFICATIONS COUPÉES SUR CET APPAREIL : la ligne des réglages devient une action.
 *
 * Écrire « Bloquées » à côté d'un interrupteur absent laissait la personne chercher seule où les
 * rallumer. Dans l'application, le bouton ouvre DIRECTEMENT l'écran « Notifications » de l'application
 * dans les réglages du téléphone (greffon `ReglagesNotifications`). Au retour, l'écran relit l'état
 * réel : la ligne redevient un interrupteur allumé sans rien recharger.
 *
 * Ailleurs (navigateur du téléphone, ordinateur, application trop ancienne), aucune page ne peut
 * ouvrir ce réglage : on dit EXACTEMENT où il est, selon l'endroit où l'on se trouve
 * (`useNotificationStatus`), au lieu de parler des réglages d'une application qu'on n'utilise pas.
 */
import { useState } from 'react';
import { BellOff, Settings } from 'lucide-react';
import { useNotificationStatus } from '@/lib/useNotificationStatus';
import { Button, I } from './ui';
import { t } from '@/i18n';

export function PushBlocked() {
  const n = useNotificationStatus();
  const [chemin, setChemin] = useState(false);
  const dansLApplication = n.contexte === 'app-android' || n.contexte === 'app-ios';
  return (
    <div className="li !flex-col !items-stretch !gap-2" role="status">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-fill">
          <I icon={BellOff} size={18} strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block text-[1rem] font-semibold">{t('Notifications coupées sur cet appareil')}</span>
          <span className="p block text-[0.857rem]">
            {dansLApplication && n.ouvrable
              ? t('Vous ne recevrez ni demandes, ni rappels, ni confirmations application fermée. Activez « Autoriser les notifications » dans l’écran qui s’ouvre, puis revenez.')
              : n.consigne}
          </span>
        </span>
      </div>
      {n.ouvrable && (
        <Button onClick={() => void n.ouvrir().then((ok) => setChemin(!ok))}>
          <I icon={Settings} size={18} /> {t('Activer dans les réglages du téléphone')}
        </Button>
      )}
      {n.ouvrable && chemin && <p className="t3">{n.consigne}</p>}
    </div>
  );
}
