/**
 * Administration — signalements d'avis (migration 0047).
 *
 * La file de ce que des utilisateurs jugent abusif : l'avis, le salon concerné, qui le signale et pourquoi.
 * Deux gestes, et un seul décide quelque chose :
 *   • MASQUER l'avis — le geste de toujours, avec son motif obligatoire, montré à la personne concernée ; le
 *     signalement est classé « traité » dans la foulée ;
 *   • SANS SUITE — l'avis reste, le signalement est classé « rejeté ».
 * Rien ne se supprime : un avis masqué reste en base, et un signalement classé aussi.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { EyeOff, ExternalLink, X } from 'lucide-react';
import { useAdminActions, useAdminReports, type AdminReportRow } from '@salondz/api-client';
import { REPORT_REASON_LABELS_FR, formatDateShortDZ } from '@salondz/constants';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Badge, Button, I, Skeleton } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { ReasonSheet } from './ReasonSheet';
import { t } from '@/i18n';

export function AdminReports() {
  const liste = useAdminReports();
  const actions = useAdminActions();
  const [hiding, setHiding] = useState<AdminReportRow | null>(null);
  const rows = liste.data?.items ?? [];

  const fermer = () => setHiding(null);
  const enCours = actions.hideReview.isPending || actions.closeReport.isPending;
  const erreur = actions.hideReview.error ?? actions.closeReport.error;

  return (
    <Screen gap={12} width="page">
      <div className="flex items-end justify-between gap-3">
        <h1 className="h1">{t('Signalements')}</h1>
        <span className="text-[1rem] text-muted">{rows.length}</span>
      </div>
      <p className="p text-[1rem]">
        {t('Des avis que des utilisateurs jugent abusifs. Masquer un avis demande un motif, montré à la personne concernée ; rien n’est supprimé.')}
      </p>

      {liste.isError ? (
        <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />
      ) : liste.isPending ? (
        <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />
      ) : rows.length === 0 ? (
        <p className="p pt-6 text-center">{t('Aucun signalement à traiter.')}</p>
      ) : (
        <div className="gr flex flex-col gap-2">
          {rows.map((r) => {
            const avis = r.reviews;
            const raison = REPORT_REASON_LABELS_FR[r.reason];
            return (
              <div key={r.id} className="crd !gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[1.143rem] font-semibold">
                    {'★'.repeat(avis?.rating ?? 0)}
                    <span className="text-disabled">{'★'.repeat(5 - (avis?.rating ?? 0))}</span>
                  </span>
                  <Badge tone="cn">{t(raison.label)}</Badge>
                </div>
                {avis?.comment ? <p className="p text-[1rem]">{avis.comment}</p> : <p className="p text-[1rem] text-muted">{t('Note sans commentaire.')}</p>}
                {r.message && (
                  <p className="sf !py-2 text-[0.857rem]">
                    <b>{t('Précision :')}</b> {r.message}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.857rem] text-muted">
                  <span>
                    {t('Signalé par {nom}', { nom: r.reporter?.fullName ?? '—' })} · {formatDateShortDZ(r.createdAt)}
                  </span>
                  {avis?.salons && (
                    <Link to={`/admin/salons/${avis.salons.id}`} className="inline-flex items-center gap-1 underline">
                      {avis.salons.name} <I icon={ExternalLink} size={14} />
                    </Link>
                  )}
                </div>
                <div className="g2">
                  {avis && !avis.hiddenAt ? (
                    <Button variant="d" onClick={() => setHiding(r)} disabled={enCours}>
                      <I icon={EyeOff} size={16} /> {t('Masquer l’avis')}
                    </Button>
                  ) : (
                    <Button
                      variant="g"
                      onClick={() => actions.closeReport.mutate({ id: r.id, outcome: 'handled' })}
                      disabled={enCours}
                    >
                      {t('Déjà masqué : classer')}
                    </Button>
                  )}
                  <Button
                    variant="g"
                    onClick={() => actions.closeReport.mutate({ id: r.id, outcome: 'rejected' })}
                    disabled={enCours}
                  >
                    <I icon={X} size={16} /> {t('Sans suite')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hiding?.reviews && (
        <ReasonSheet
          title={t('Masquer cet avis')}
          description={t('Il quitte la page publique et le calcul de la note. Il n’est pas supprimé : une décision doit pouvoir s’expliquer plus tard.')}
          confirmLabel={t('Masquer l’avis')}
          danger
          pending={enCours}
          error={erreur}
          onClose={fermer}
          onConfirm={(reason) =>
            actions.hideReview.mutate(
              { id: hiding.reviews!.id, reason },
              {
                // Masqué : on classe le signalement dans la foulée, avec le même motif.
                onSuccess: () => actions.closeReport.mutate({ id: hiding.id, outcome: 'handled', note: reason }, { onSuccess: fermer }),
              },
            )
          }
        />
      )}
    </Screen>
  );
}
