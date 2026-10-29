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
 *   - refusé → on ne peut plus demander : seul le système peut rouvrir le robinet, on y emmène
 *     (application) ou l'on dit exactement où aller (navigateur) ;
 *   - accordé → rien, le bandeau n'existe pas.
 */
import { useState } from 'react';
import { BellRing, ExternalLink, X } from 'lucide-react';
import { useNotificationStatus } from '@/lib/useNotificationStatus';
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
  // État RÉEL, relu à chaque retour dans l'application : revenu des réglages avec les notifications
  // rallumées, le bandeau disparaît de lui-même. Sur le site, un compte qui a l'application n'est
  // jamais relancé : ses notifications arrivent sur l'application.
  const n = useNotificationStatus();
  const [masque, setMasque] = useState(() => enRepos());
  /** Chemin écrit, affiché quand l'écran de réglage ne peut pas s'ouvrir d'un geste. */
  const [chemin, setChemin] = useState(false);

  // Rien tant que l'état réel n'est pas connu : le bandeau clignoterait chez quelqu'un dont tout est
  // en ordre.
  if (masque || !n.pret || n.situation === 'actives' || n.situation === 'impossibles') return null;

  const bloquees = n.situation === 'bloquees';

  const plusTard = () => {
    localStorage.setItem(CLE, String(Date.now() + REPOS[role] * 86_400_000));
    setMasque(true);
  };

  const agir = async () => {
    // Bloquées : la demande ne s'affichera plus jamais, c'est une décision du système. Dans
    // l'application, on emmène DIRECTEMENT au bon écran ; ailleurs, on dit exactement où aller.
    if (bloquees) {
      if (n.ouvrable && (await n.ouvrir())) return;
      setChemin(true);
      return;
    }
    await n.activer();
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
          {bloquees
            ? t('Les notifications de Salon DZ sont coupées sur cet appareil.')
            : role === 'pro'
              ? t('Sans notifications, vous découvrez les demandes en ouvrant l’application. Avec, vous les recevez à l’instant où elles arrivent.')
              : t('Rappel 1 h puis 30 min avant, et un mot dès que le salon confirme.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!(bloquees && chemin) && (
            <Button sm auto loading={n.occupe} onClick={() => void agir()}>
              {!bloquees ? (
                t('Activer les notifications')
              ) : n.ouvrable ? (
                <>
                  {t('Ouvrir les réglages')} <I icon={ExternalLink} size={15} />
                </>
              ) : (
                t('Comment les réactiver')
              )}
            </Button>
          )}
          <Button sm auto variant="g" onClick={plusTard}>
            {t('Plus tard')}
          </Button>
        </div>
        {bloquees && chemin && <p className="t3 mt-2">{n.consigne}</p>}
        {n.erreur && (
          <p className="mt-2 text-[0.857rem] text-danger" role="alert">
            {n.erreur}
          </p>
        )}
      </div>
      <button type="button" aria-label={t('Masquer')} className="-mt-1 -me-1 flex-none self-start p-1 text-subtle" onClick={plusTard}>
        <I icon={X} size={18} />
      </button>
    </div>
  );
}
