/**
 * RELANCE D'ACTIVATION DES NOTIFICATIONS.
 *
 * Pourquoi ce bandeau existe : sans notification, un professionnel apprend une réservation en
 * ouvrant son application — donc avec des heures de retard, et parfois jamais. Et un client qui ne
 * reçoit pas son rappel ne revient pas. C'est le seul réglage qui décide si le produit sert à
 * quelque chose quand il est fermé.
 *
 * Pourquoi il ne s'affiche pas tout le temps : un bandeau permanent devient du décor, on cesse de
 * le voir. Il revient à intervalle — plus souvent côté professionnel, qui perd de l'argent à chaque
 * demande manquée, plus rarement côté client.
 *
 * Trois états, trois actions différentes :
 *   - jamais demandé → on demande, dans l'application ;
 *   - refusé → on ne peut plus demander : seul le système peut rouvrir le robinet, on y emmène ;
 *   - accordé → rien, le bandeau n'existe pas.
 */
import { useEffect, useState } from 'react';
import { BellRing, ExternalLink, X } from 'lucide-react';
import { api } from '@/lib/api';
import { enableWebPush, webPushPermission } from '@/lib/webpush';
import { ouvrirReglagesNotifications, surMobile } from '@/lib/pushSettings';
import { Button, I } from './ui';
import { t } from '@/i18n';

/** Délai avant de reproposer, en jours. Un professionnel est relancé trois fois plus souvent. */
const REPOS = { pro: 7, client: 21 } as const;
const CLE = 'salondz:push:repos';

function enRepos(): boolean {
  const jusqua = Number(localStorage.getItem(CLE) ?? 0);
  return Number.isFinite(jusqua) && Date.now() < jusqua;
}

export function NotificationsNudge({ role }: { role: 'pro' | 'client' }) {
  const [etat, setEtat] = useState<NotificationPermission | 'unsupported' | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [masque, setMasque] = useState(() => enRepos());

  useEffect(() => {
    let vivant = true;
    void (async () => {
      // Dans l'application, l'état réel se lit de façon asynchrone ; sur le web il est immédiat.
      const web = webPushPermission();
      if (web !== 'default') {
        if (vivant) setEtat(web);
        return;
      }
      const { nativePushPermission } = await import('@/lib/nativePush').catch(() => ({ nativePushPermission: null }) as never);
      const reel = nativePushPermission ? await nativePushPermission() : 'default';
      if (vivant) setEtat(reel);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  if (masque || etat === null || etat === 'granted' || etat === 'unsupported') return null;

  const refuse = etat === 'denied';

  const plusTard = () => {
    localStorage.setItem(CLE, String(Date.now() + REPOS[role] * 86_400_000));
    setMasque(true);
  };

  const agir = async () => {
    // Refusé : la demande ne s'affichera plus jamais, c'est une décision du système. On emmène donc
    // directement au bon écran de réglages plutôt que d'expliquer où cliquer.
    if (refuse) return ouvrirReglagesNotifications();
    setOccupe(true);
    try {
      const ok = await enableWebPush(api);
      setEtat(ok ? 'granted' : 'denied');
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5" role="status">
      <span className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-[var(--radius-card-sm)] bg-fill">
        <I icon={BellRing} size={20} strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {role === 'pro' ? t('Ne manquez plus une réservation') : t('Ne manquez plus votre rendez-vous')}
        </p>
        <p className="p mt-1 text-[0.938rem]">
          {role === 'pro'
            ? t('Sans notifications, vous découvrez les demandes en ouvrant l’application. Avec, vous les recevez à l’instant où elles arrivent.')
            : t('Rappel 1 h puis 30 min avant, et un mot dès que le salon confirme.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button sm auto loading={occupe} onClick={() => void agir()}>
            {refuse ? (
              <>
                {t('Ouvrir les réglages')} <I icon={ExternalLink} size={15} />
              </>
            ) : (
              t('Activer les notifications')
            )}
          </Button>
          <Button sm auto variant="g" onClick={plusTard}>
            {t('Plus tard')}
          </Button>
        </div>
        {refuse && !surMobile() && (
          <p className="t3 mt-2">{t('Sur ordinateur, l’autorisation se change dans les réglages du navigateur, à côté de la barre d’adresse.')}</p>
        )}
      </div>
      <button type="button" aria-label={t('Masquer')} className="-mt-1 -me-1 flex-none self-start p-1 text-subtle" onClick={plusTard}>
        <I icon={X} size={18} />
      </button>
    </div>
  );
}
