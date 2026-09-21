/**
 * Le bandeau « vous agissez en tant que … ».
 *
 * Il est voyant exprès, et il ne se replie pas. On travaille dans l'espace de quelqu'un d'autre :
 * oublier dans quel salon on est, c'est modifier le catalogue du mauvais professionnel. Il reste
 * donc collé en haut, sur tous les écrans pro, tant qu'on n'en est pas sorti.
 *
 * L'accès est daté (deux heures) : le bandeau dit jusqu'à quelle heure, et referme lui-même
 * l'espace à l'échéance. Le serveur refuse le jeton passé ce délai, que la page soit ouverte ou non.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, X } from 'lucide-react';
import { useAdminActions } from '@salondz/api-client';
import { formatTimeDZ } from '@salondz/constants';
import { stopActingAs, useActingAs } from '@/lib/actingAs';
import { I } from '@/components/ui';
import { t } from '@/i18n';

export function ActingAsBanner() {
  const salon = useActingAs();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { leaveSalon } = useAdminActions();

  const id = salon?.id;
  const expiresAt = salon?.expiresAt;

  /** `manuel` : l'administrateur a cliqué. Sinon l'accès est arrivé à échéance et le serveur l'a déjà fermé. */
  const sortir = (manuel: boolean) => {
    if (!id) return;
    // La sortie se date au journal ; un échec n'empêche jamais de sortir (le jeton meurt seul).
    if (manuel) leaveSalon.mutate(id);
    stopActingAs();
    // Tout ce qui est en cache appartient au salon qu'on quitte : le garder montrerait son agenda
    // et sa clientèle à l'écran suivant. On repart de zéro, c'est un changement de contexte.
    qc.clear();
    navigate(`/admin/salons/${id}`, { replace: true });
  };

  useEffect(() => {
    if (!expiresAt) return;
    const reste = new Date(expiresAt).getTime() - Date.now();
    const h = window.setTimeout(() => sortir(false), Math.max(0, reste));
    return () => window.clearTimeout(h);
    // `sortir` ne dépend que de `id` et d'objets stables : refaire la minuterie à chaque rendu
    // n'apporterait rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, expiresAt]);

  if (!salon) return null;

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-2 bg-ink px-4 py-2 text-on-ink"
      role="status"
      aria-live="polite"
    >
      <I icon={ShieldAlert} size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 text-[0.857rem]">
        <span className="block truncate">
          {t('Vous agissez en tant que {salon}. Tout ce que vous modifiez est enregistré au journal.', {
            salon: salon.name,
          })}
        </span>
        <span className="block truncate opacity-75" dir="auto">
          {t('Accès valable jusqu’à {heure} (heure d’Alger).', { heure: formatTimeDZ(salon.expiresAt) })}
        </span>
      </span>
      <button
        type="button"
        onClick={() => sortir(true)}
        className="flex shrink-0 items-center gap-1 rounded-[var(--radius-btn)] bg-on-ink/15 px-2 py-1 text-[0.857rem] font-semibold"
      >
        <I icon={X} size={14} /> {t('Quitter')}
      </button>
    </div>
  );
}
