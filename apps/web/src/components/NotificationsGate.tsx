/**
 * DEMANDE DES NOTIFICATIONS À CHAQUE OUVERTURE (client, 17 nov. 2026, demande du propriétaire :
 * « ne rien rater », stratégie des grandes applications).
 *
 * Tant que les notifications ne sont pas actives sur l'appareil, une fenêtre les demande à chaque
 * ouverture de l'application (ou du site) et à chaque retour après 30 min en arrière-plan :
 *   - le système peut encore demander → « Activer » pose SA question (pré-demande puis système,
 *     comme Uber : la question du système n'arrive qu'après un geste, elle est donc acceptée) ;
 *   - refusées → « Ouvrir les réglages » emmène à l'écran Notifications du téléphone, sinon le
 *     chemin exact est écrit ;
 *   - impossibles (Safari hors écran d'accueil) → RIEN (20 nov. 2026 : l'explication ne servait à rien).
 * MISE À JOUR DU 20 NOV. 2026 : plus de pré-demande, la question de l'appareil est posée directement
 * (application : à l'ouverture ; navigateur : au premier toucher). La fenêtre ne sert plus qu'aux
 * notifications REFUSÉES dans l'application (un toucher ouvre les réglages du téléphone).
 * « Plus tard » reste offert : Apple (règle 4.5.4) et Google interdisent d'exiger les notifications
 * pour utiliser l'application. Revenu des réglages avec les notifications allumées, la fenêtre se
 * ferme d'elle-même (état relu au retour, `usePushPermission`).
 *
 * ÉTENDUE AUX PROS le 26 nov. 2026 (demande du propriétaire, « comme Uber Eats ») : montée par
 * `RequirePro`, elle remplace le bandeau de l'accueil pro. Un toucher sur « Ouvrir les réglages »
 * ouvre l'écran Notifications de Salon DZ Pro dans le téléphone (greffon natif, Android et iPhone).
 *
 * Remplace, côté client, le bandeau `NotificationsNudge` et les réglages « Rappels » /
 * « Confirmations » : rappels et confirmations sont toujours envoyés.
 */
import { positionADemander } from '@/lib/useAutoLocate';
import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useNotificationStatus } from '@/lib/useNotificationStatus';
import { ICONE } from '@/lib/actionIcons';
import { BottomSheet, Button, Dim, I } from './ui';
import { t } from '@/i18n';

/** Une seule fois par ouverture : vit en module, donc remis à zéro à chaque lancement. */
let vuCetteOuverture = false;
const RETOUR_MS = 30 * 60_000;

function useOuverture(): [boolean, () => void] {
  const [vu, setVu] = useState(vuCetteOuverture);
  useEffect(() => {
    let cache = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') cache = Date.now();
      else if (cache && Date.now() - cache > RETOUR_MS) {
        vuCetteOuverture = false;
        setVu(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return [
    vu,
    () => {
      vuCetteOuverture = true;
      setVu(true);
    },
  ];
}

export function NotificationsGate({ role = 'client' }: { role?: 'client' | 'pro' }) {
  const n = useNotificationStatus();
  const [vu, marquerVu] = useOuverture();
  const [chemin, setChemin] = useState(false);
  const natif = n.contexte === 'app-android' || n.contexte === 'app-ios';
  // La fenêtre de la position (place de marché) passe d'abord — côté client seulement.
  const position = role === 'client' && positionADemander();

  // QUESTION DIRECTE (20 nov. 2026, demande du propriétaire) : plus de fenêtre d'explication — on
  // pose LA question de l'appareil. Dans l'application, tout de suite ; dans un navigateur, au premier
  // toucher (les navigateurs n'affichent leur question qu'après un geste de la personne).
  const aDemander = !vu && n.pret && n.situation === 'a-demander' && !position;
  useEffect(() => {
    if (!aDemander) return;
    if (natif) {
      marquerVu();
      void n.activer();
      return;
    }
    const auToucher = () => {
      marquerVu();
      void n.activer();
    };
    document.addEventListener('click', auToucher, { once: true, capture: true });
    return () => document.removeEventListener('click', auToucher, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aDemander, natif]);

  // Rien à montrer : actives, impossibles ici (Safari hors écran d'accueil — on ne l'explique plus),
  // question en cours, ou la position d'abord. Refusées dans un NAVIGATEUR : rien ne peut les rouvrir
  // d'un geste, on n'insiste pas.
  if (vu || !n.pret || n.situation !== 'bloquees' || !natif || position) return null;

  // Refusées dans l'APPLICATION : un toucher ouvre directement l'écran Notifications du téléphone.
  const agir = async () => {
    if (n.ouvrable && (await n.ouvrir())) return;
    setChemin(true);
  };

  return (
    <>
      <Dim onClose={() => undefined} />
      <BottomSheet modal>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-fill">
            <I icon={BellRing} size={30} strokeWidth={1.6} />
          </span>
          <div className="h1 !text-[1.429rem]">{t('Notifications coupées')}</div>
          <p className="p">
            {chemin
              ? n.consigne
              : role === 'pro'
                ? t('Nouvelles réservations, demandes à valider, rappels : ne manquez aucune cliente.')
                : t('Confirmation du salon, rappel 1 h puis 30 min avant : ne ratez aucun rendez-vous.')}
          </p>
        </div>
        {!chemin && (
          <Button icon={ICONE.reglages} loading={n.occupe} onClick={() => void agir()}>
            {t('Ouvrir les réglages')}
          </Button>
        )}
        <Button icon={ICONE.plusTard} variant="g" onClick={marquerVu}>
          {t('Plus tard')}
        </Button>
      </BottomSheet>
    </>
  );
}
