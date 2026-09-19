/**
 * Réponse publique d'un salon sous un avis. Décalée et discrète : on lit l'avis d'abord, la
 * réponse ensuite — l'inverse donnerait au salon le dernier mot avant même qu'on ait lu le client.
 */
import { t } from '@/i18n';

export function ReviewReply({ reply, salonName }: { reply?: string | null; salonName?: string }) {
  if (!reply) return null;
  return (
    <div className="mt-1 border-s-2 border-line ps-3">
      <span className="block text-[0.857rem] font-semibold text-muted">
        {salonName ? t('Réponse de {salon}', { salon: salonName }) : t('Réponse du salon')}
      </span>
      <p className="p text-[1rem]">{reply}</p>
    </div>
  );
}
