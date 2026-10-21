/**
 * NOTIFICATIONS COUPÉES SUR CE TÉLÉPHONE : la ligne des réglages devient une action.
 *
 * Écrire « Bloquées » à côté d'un interrupteur absent laissait la personne chercher seule où les
 * rallumer. Dans l'application, le bouton ouvre DIRECTEMENT l'écran « Notifications » de Salon DZ
 * dans les réglages du téléphone (greffon `ReglagesNotifications`). Au retour, l'écran relit l'état
 * réel (`usePushPermission`) : la ligne redevient un interrupteur allumé sans rien recharger.
 *
 * Sur le web, aucune page ne peut ouvrir les réglages du navigateur : on dit où ils sont.
 */
import { useState } from 'react';
import { BellOff, Settings } from 'lucide-react';
import { enCoque, ouvrirReglagesNotifications } from '@/lib/pushSettings';
import { Button, I } from './ui';
import { t } from '@/i18n';

export function PushBlocked() {
  const [aLaMain, setALaMain] = useState(false);
  const app = enCoque();
  return (
    <div className="li !flex-col !items-stretch !gap-2" role="status">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-fill">
          <I icon={BellOff} size={18} strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block text-[1rem] font-semibold">{t('Notifications coupées sur cet appareil')}</span>
          <span className="p block text-[0.857rem]">
            {app
              ? t('Vous ne recevrez ni demandes, ni rappels, ni confirmations application fermée. Activez « Autoriser les notifications » dans l’écran qui s’ouvre, puis revenez.')
              : t('Sur ordinateur, l’autorisation se change dans les réglages du navigateur, à côté de la barre d’adresse.')}
          </span>
        </span>
      </div>
      {app && (
        <Button onClick={() => void ouvrirReglagesNotifications().then((ok) => setALaMain(!ok))}>
          <I icon={Settings} size={18} /> {t('Activer dans les réglages du téléphone')}
        </Button>
      )}
      {aLaMain && (
        <p className="t3">{t('Ouvrez Réglages, puis Applications, puis Salon DZ, puis Notifications. Mettez l’application à jour pour y aller en un geste.')}</p>
      )}
    </div>
  );
}
