/**
 * « NOTIFICATIONS SUR CET APPAREIL » — une seule ligne, partagée par l'espace pro (Compte) et le
 * client (Réglages), sur le site comme dans l'application (29 oct. 2026).
 *
 * Elle remplace deux interrupteurs recopiés qui mentaient de trois façons :
 *   - allumés dès que la PERMISSION était accordée, même quand l'abonnement du navigateur avait
 *     échoué — rien n'arrivait, et l'écran disait le contraire ;
 *   - sans état de chargement : un appui ne montrait rien pendant la demande, on réappuyait ;
 *   - sans rien dire d'un échec.
 *
 * Désormais : l'état RÉEL (`useNotificationStatus`), l'interrupteur en attente pendant l'action,
 * la raison d'un échec sous la ligne, et un bouton « Envoyer un test » qui dit, appareil par
 * appareil, ce que le fournisseur a répondu. C'est la preuve de bout en bout qu'il manquait.
 */
import { useState } from 'react';
import { BellRing, Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { disableWebPush } from '@/lib/webpush';
import { useNotificationStatus } from '@/lib/useNotificationStatus';
import { isDemo } from '@/demo/session';
import { PushBlocked } from './PushBlocked';
import { Button, I, Toggle } from './ui';
import { t } from '@/i18n';

type Retour = { ok: boolean; texte: string } | null;

export function DevicePushRow({ sub }: { sub: string }) {
  const n = useNotificationStatus();
  const [coupe, setCoupe] = useState(false);
  const [test, setTest] = useState<'idle' | 'pending'>('idle');
  const [retour, setRetour] = useState<Retour>(null);

  if (!n.pret) return null;
  if (n.situation === 'bloquees') return <PushBlocked />;

  const actives = n.situation === 'actives';
  const occupe = n.occupe || coupe;

  const basculer = async (v: boolean) => {
    setRetour(null);
    if (v) {
      await n.activer();
      return;
    }
    setCoupe(true);
    try {
      await disableWebPush(api);
    } finally {
      setCoupe(false);
    }
  };

  const envoyerTest = async () => {
    setTest('pending');
    setRetour(null);
    try {
      if (isDemo()) {
        // Démonstration : aucun serveur. On affiche la notification localement, pour voir à quoi
        // elle ressemble — et vérifier que ce navigateur sait en afficher une.
        const reg = await navigator.serviceWorker?.getRegistration('/sw.js');
        await reg?.showNotification('🔔 Salon DZ', { body: t('Notification de test : tout fonctionne sur cet appareil.'), icon: '/icon-192.png' });
        setRetour({ ok: !!reg, texte: reg ? t('Notification de test affichée.') : t('Activez d’abord les notifications sur cet appareil.') });
        return;
      }
      const r = await api.me.pushTest();
      const envoyes = r.devices.filter((d) => d.outcome === 'sent').length;
      const rates = r.devices.length - envoyes;
      setRetour(
        r.devices.length === 0
          ? { ok: false, texte: t('Aucun appareil enregistré pour ce compte. Activez les notifications ci-dessus.') }
          : rates === 0
            ? { ok: true, texte: t('Test envoyé à {n} appareil(s). Il doit arriver dans quelques secondes.', { n: envoyes }) }
            : { ok: envoyes > 0, texte: t('Test envoyé à {ok} appareil(s), refusé par {ko}. Les appareils refusés ont été retirés : réactivez-les depuis chacun d’eux.', { ok: envoyes, ko: rates }) },
      );
    } catch {
      setRetour({ ok: false, texte: t('Le test n’a pas pu partir (réseau). Réessayez dans un instant.') });
    } finally {
      setTest('idle');
    }
  };

  return (
    <div className="li !flex-col !items-stretch !gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-fill">
            <I icon={BellRing} size={18} strokeWidth={1.7} />
          </span>
          <span className="min-w-0">
            <span className="block text-[1rem] font-semibold">{t('Notifications sur cet appareil')}</span>
            <span className="p block text-[0.857rem]">
              {n.situation === 'impossibles' ? n.consigne : sub}
            </span>
          </span>
        </span>
        {n.situation !== 'impossibles' && (
          <span className="flex flex-none items-center gap-2">
            {occupe && <I icon={Loader2} size={16} className="animate-spin text-muted" aria-hidden />}
            <Toggle on={actives} disabled={occupe} onChange={(v) => void basculer(v)} label={t('Notifications sur cet appareil')} />
          </span>
        )}
      </div>
      {n.erreur && (
        <p className="text-[0.857rem] text-danger" role="alert">
          {n.erreur}
        </p>
      )}
      {actives && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Button sm auto variant="g" loading={test === 'pending'} onClick={() => void envoyerTest()}>
            <I icon={Send} size={15} /> {t('Envoyer un test')}
          </Button>
          {retour && (
            <span className={`text-[0.857rem] ${retour.ok ? 'text-ok-fg' : 'text-danger'}`} role="status">
              {retour.texte}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
