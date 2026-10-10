/**
 * NOTIFICATION REÇUE PENDANT QUE L'APPLICATION EST OUVERTE.
 *
 * Android ne montre rien quand l'application est au premier plan, et iOS montre un bandeau système
 * sans que l'écran bouge. Ici : les données se rechargent (rendez-vous, compteurs) et un bandeau
 * dit ce qui vient d'arriver ; le toucher mène au rendez-vous, comme un appui sur la notification.
 * Il part seul après quelques secondes — c'est une information du moment, pas un écran.
 *
 * Monté UNE fois, dans `AppFrame` : présent sur tous les écrans, sans que chacun ait à y penser.
 * Sans effet sur le site dans un navigateur : l'événement n'y est jamais émis.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { queryKeys } from '@salondz/api-client';
import { PUSH_EVENT, type ForegroundPush } from '@/lib/nativePush';
import { I } from './ui';

const DUREE_MS = 5_000;

export function PushToast() {
  const [push, setPush] = useState<ForegroundPush | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const onPush = (e: Event) => {
      const detail = (e as CustomEvent<ForegroundPush>).detail;
      if (!detail) return;
      // Le serveur est la source de vérité : on recharge, on n'invente aucun compteur.
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      void qc.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.pro.bookingsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.pro.stats });
      setPush(detail);
    };
    window.addEventListener(PUSH_EVENT, onPush);
    return () => window.removeEventListener(PUSH_EVENT, onPush);
  }, [qc]);

  useEffect(() => {
    if (!push) return;
    const t = window.setTimeout(() => setPush(null), DUREE_MS);
    return () => window.clearTimeout(t);
  }, [push]);

  if (!push) return null;
  const ouvrir = () => {
    setPush(null);
    if (push.url) navigate(push.url);
  };
  return (
    <button type="button" className="toast !cursor-pointer text-start" role="status" onClick={ouvrir}>
      <I icon={BellRing} size={18} className="flex-none" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{push.title}</span>
        {push.body && <span className="block truncate text-white/85">{push.body}</span>}
      </span>
    </button>
  );
}
