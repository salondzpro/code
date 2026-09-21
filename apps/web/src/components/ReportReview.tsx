/**
 * « Signaler » sous un avis.
 *
 * Un avis est du contenu écrit par un utilisateur et publié à la vue de tous : Apple (1.2) et Google Play
 * attendent qu'on puisse le signaler. Le geste tient en deux touches — le bouton, puis UN motif — parce qu'on
 * signale un avis abusif en passant, pas en remplissant un formulaire. Le signalement ne masque rien à lui
 * seul : un opérateur décide (`/admin/signalements`). Sans compte, on est renvoyé à la connexion et ramené ici :
 * un signalement anonyme ne pourrait ni être limité ni être suivi.
 */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CheckCircle2, Flag } from 'lucide-react';
import { useReportReview } from '@salondz/api-client';
import { REPORT_REASONS, REPORT_REASON_LABELS_FR, type ReportReason } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/components/ErrorMessage';
import { BottomSheet, Button, Dim, I } from '@/components/ui';
import { t } from '@/i18n';

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const report = useReportReview();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const start = () => {
    if (!session) {
      navigate(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    report.reset();
    setDone(false);
    setOpen(true);
  };
  const send = (reason: ReportReason) => report.mutate({ id: reviewId, reason }, { onSuccess: () => setDone(true) });
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="mt-0.5 inline-flex items-center gap-1 self-start text-[0.857rem] text-muted underline"
        onClick={start}
      >
        <I icon={Flag} size={14} /> {t('Signaler')}
      </button>
      {open && (
        <>
          <Dim onClose={close} />
          <BottomSheet modal>
            {done ? (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-bg text-ok-fg">
                  <I icon={CheckCircle2} size={24} />
                </span>
                <div className="h1 !text-[1.429rem]">{t('Merci, nous examinons cet avis.')}</div>
                <p className="p">{t("Vous ne serez pas cité. Si l’avis ne respecte pas nos règles, il sera masqué.")}</p>
                <Button onClick={close}>{t('Fermer')}</Button>
              </>
            ) : (
              <>
                <div className="h1 !text-[1.429rem]">{t('Signaler cet avis')}</div>
                <p className="p">{t('Pourquoi signalez-vous cet avis ?')}</p>
                <div className="crd !gap-0 !py-1">
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" className="li w-full text-start" disabled={report.isPending} onClick={() => send(r)}>
                      <span className="min-w-0">
                        <span className="block text-[1rem] font-semibold">{t(REPORT_REASON_LABELS_FR[r].label)}</span>
                        <span className="block text-[0.857rem] text-muted">{t(REPORT_REASON_LABELS_FR[r].hint)}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {report.isError && (
                  <p className="text-[1rem] text-danger" role="alert">
                    {errorText(report.error)}
                  </p>
                )}
                <Button variant="g" onClick={close} disabled={report.isPending}>
                  {t('Annuler')}
                </Button>
              </>
            )}
          </BottomSheet>
        </>
      )}
    </>
  );
}
