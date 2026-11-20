/**
 * PREMIÈRE VISITE DE LA PLACE DE MARCHÉ (20 nov. 2026, demande du propriétaire) : on dit tout de suite
 * que les salons affichés sont ceux d'ALGER par défaut, et on propose la position — un toucher sur
 * « Utiliser ma position » déclenche la question du téléphone. Une seule fois par appareil
 * (`lib/useAutoLocate.ts`) ; « Rester sur Alger » ne redemande plus, le lieu reste modifiable en haut
 * de la recherche.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';
import { BottomSheet, Button, Dim, I } from './ui';
import { localiser, positionADemander, resterSurAlger } from '@/lib/useAutoLocate';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function LocationGate() {
  const [ouvert, setOuvert] = useState(positionADemander);
  const [enCours, setEnCours] = useState(false);
  if (!ouvert) return null;

  const accepter = () => {
    setEnCours(true);
    localiser(() => {
      setEnCours(false);
      setOuvert(false);
    });
    // La question du système prend le relais : la fenêtre se referme sans attendre la mesure.
    window.setTimeout(() => setOuvert(false), 400);
  };
  const refuser = () => {
    resterSurAlger();
    setOuvert(false);
  };

  return createPortal(
    <>
      <Dim onClose={refuser} />
      <BottomSheet modal>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-fill">
            <I icon={MapPin} size={30} strokeWidth={1.6} />
          </span>
          <div className="h1 !text-[1.429rem]">{t('Les salons près de vous')}</div>
          <p className="p">{t('Par défaut, nous affichons les salons d’Alger. Autorisez votre position pour voir ceux autour de vous.')}</p>
          <Button icon={ICONE.lieu} className="w-full" loading={enCours} onClick={accepter}>
            {t('Utiliser ma position')}
          </Button>
          <Button variant="g" className="w-full" onClick={refuser}>
            {t('Rester sur Alger')}
          </Button>
        </div>
      </BottomSheet>
    </>,
    document.body,
  );
}
