/**
 * Le bandeau « vous agissez en tant que … ».
 *
 * Il est voyant exprès, et il ne se replie pas. On travaille dans l'espace de quelqu'un d'autre :
 * oublier dans quel salon on est, c'est modifier le catalogue du mauvais professionnel. Il reste
 * donc collé en haut, sur tous les écrans pro, tant qu'on n'en est pas sorti.
 */
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, X } from 'lucide-react';
import { stopActingAs, useActingAs } from '@/lib/actingAs';
import { I } from '@/components/ui';
import { t } from '@/i18n';

export function ActingAsBanner() {
  const salon = useActingAs();
  const qc = useQueryClient();
  const navigate = useNavigate();
  if (!salon) return null;

  const sortir = () => {
    stopActingAs();
    // Tout ce qui est en cache appartient au salon qu'on quitte : le garder montrerait son agenda
    // et sa clientèle à l'écran suivant. On repart de zéro, c'est un changement de contexte.
    qc.clear();
    navigate(`/admin/salons/${salon.id}`, { replace: true });
  };

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-2 bg-ink px-4 py-2 text-on-ink"
      role="status"
      aria-live="polite"
    >
      <I icon={ShieldAlert} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[0.857rem]">
        {t('Vous agissez en tant que {salon}. Tout ce que vous modifiez est enregistré au journal.', {
          salon: salon.name,
        })}
      </span>
      <button
        type="button"
        onClick={sortir}
        className="flex shrink-0 items-center gap-1 rounded-[var(--radius-btn)] bg-on-ink/15 px-2 py-1 text-[0.857rem] font-semibold"
      >
        <I icon={X} size={14} /> {t('Quitter')}
      </button>
    </div>
  );
}
