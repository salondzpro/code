/**
 * VERSEMENT, CÔTÉ PROFESSIONNEL (14 nov. 2026, migration 0057) — dans la fenêtre du rendez-vous et sur
 * sa fiche.
 *
 * Une décision, un écran : le justificatif s'affiche EN GRAND (image en vignette qui s'ouvre plein écran,
 * PDF qui s'ouvre à part), avec deux gestes — « Valider » (confirme le rendez-vous, la cliente est
 * prévenue) et « Refuser » (motif choisi d'un toucher ou écrit, la cliente renvoie un justificatif).
 * Sous la décision, la trace complète : réservation, envoi, décision.
 */
import { useState } from 'react';
import { FileText, Landmark, X } from 'lucide-react';
import { useDecideDeposit, useDepositProof } from '@salondz/api-client';
import { PENDING_REQUEST_TTL_HOURS, formatDA } from '@salondz/constants';
import type { Booking } from '@salondz/types';
import { BottomSheet, Button, Dim, I, Textarea } from '@/components/ui';
import { DepositTrace } from '@/components/DepositCard';
import { ErrorMessage } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { REJECT_REASONS, formatWhen } from '@/lib/deposit';
import { t } from '@/i18n';

const LABEL = {
  awaiting: 'Versement attendu',
  submitted: 'À vérifier',
  accepted: 'Versement validé',
  rejected: 'Justificatif refusé',
} as const;

/** Pastille d'état, pour les listes (Demandes, agenda). */
export function DepositChip({ booking: b }: { booking: Pick<Booking, 'depositStatus' | 'depositAmount' | 'status'> }) {
  if (!b.depositStatus || !b.depositAmount) return null;
  if (b.status !== 'pending' && b.depositStatus !== 'accepted') return null;
  return (
    <span className={`dp-chip ${b.depositStatus}`}>
      <I icon={Landmark} size={12} /> {t(LABEL[b.depositStatus])}
    </span>
  );
}

function ProofViewer({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="dp-view" role="dialog" aria-label={t('Justificatif')}>
      <button type="button" className="dp-view-x" onClick={onClose} aria-label={t('Fermer')}>
        <I icon={X} size={22} />
      </button>
      <img src={url} alt={t('Justificatif de versement')} />
    </div>
  );
}

function RejectSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const decide = useDecideDeposit();
  const [reason, setReason] = useState<string>('');
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="h2">{t('Refuser le justificatif')}</h2>
            <p className="t3 mt-1">{t('Votre motif est envoyé avec la demande d’un autre justificatif. Le créneau reste bloqué.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" className={`pill${reason === t(r) ? ' on' : ''}`} onClick={() => setReason(t(r))}>
                {t(r)}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder={t('Ou écrivez le motif…')} rows={2} />
          <ErrorMessage error={decide.error} />
          <Button
            variant="d"
            icon={ICONE.refuserJustificatif}
            loading={decide.isPending}
            disabled={!reason.trim()}
            onClick={() => decide.mutate({ id, decision: 'reject', reason: reason.trim() }, { onSuccess: onClose })}
          >
            {t('Envoyer le refus')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function DepositReview({ booking: b }: { booking: Booking }) {
  const status = b.depositStatus ?? null;
  const submitted = status === 'submitted' && b.status === 'pending';
  const proof = useDepositProof(b.id, !!b.depositSubmittedAt && (submitted || status === 'accepted' || status === 'rejected'));
  const decide = useDecideDeposit();
  const [view, setView] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  if (!b.depositAmount || !status) return null;
  const amount = formatDA(b.depositAmount);
  const isPdf = proof.data?.type === 'application/pdf';
  const deadline = new Date(Math.min(new Date(b.createdAt).getTime() + PENDING_REQUEST_TTL_HOURS * 3_600_000, new Date(b.startsAt).getTime())).toISOString();

  const steps = [
    { label: t('Créneau réservé en ligne'), when: formatWhen(b.createdAt), state: 'done' as const },
    status === 'awaiting'
      ? { label: t('Versement attendu'), when: t('avant {quand}', { quand: formatWhen(deadline) }), state: 'now' as const }
      : { label: t('Justificatif reçu'), when: b.depositSubmittedAt ? formatWhen(b.depositSubmittedAt) : null, state: 'done' as const },
    status === 'rejected'
      ? { label: t('Justificatif refusé'), when: b.depositReviewedAt ? formatWhen(b.depositReviewedAt) : null, state: 'bad' as const, note: b.depositRejectReason }
      : status === 'accepted'
        ? { label: t('Versement validé, rendez-vous confirmé'), when: b.depositReviewedAt ? formatWhen(b.depositReviewedAt) : null, state: 'done' as const }
        : { label: t('Votre vérification'), state: (submitted ? 'now' : 'todo') as 'now' | 'todo' },
  ];

  return (
    <section className={`dp pro ${status}`}>
      <div className="dp-pro-h">
        <span className="dp-pro-ic" aria-hidden>
          <I icon={Landmark} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <small>{t('Versement')}</small>
          <b dir="ltr">{amount}</b>
        </span>
        <span className={`dp-chip ${status}`}>{t(LABEL[status])}</span>
      </div>

      {proof.data && (
        isPdf ? (
          <a className="dp-proof pdf" href={proof.data.url} target="_blank" rel="noreferrer">
            <I icon={FileText} size={26} />
            <span>
              <b>{t('Reçu en PDF')}</b>
              <small>{t('Ouvrir le document')}</small>
            </span>
          </a>
        ) : (
          <button type="button" className="dp-proof" onClick={() => setView(true)} aria-label={t('Voir le justificatif en grand')}>
            <img src={proof.data.url} alt="" loading="lazy" />
            <span className="dp-proof-zoom">
              <I icon={ICONE.voirJustificatif} size={15} /> {t('Voir en grand')}
            </span>
          </button>
        )
      )}
      {proof.isPending && !!b.depositSubmittedAt && submitted && <div className="dp-proof sk" aria-hidden />}

      {submitted && (
        <>
          <p className="t3">{t('Vérifiez sur votre compte que {montant} est bien arrivé avant de valider.', { montant: amount })}</p>
          <div className="dp-dec">
            <Button variant="g" icon={ICONE.refuserJustificatif} onClick={() => setRejecting(true)} disabled={decide.isPending}>
              {t('Refuser le reçu')}
            </Button>
            <Button
              className="dp-yes"
              icon={ICONE.validerVersement}
              loading={decide.isPending}
              onClick={() => decide.mutate({ id: b.id, decision: 'accept' })}
            >
              {t('Valider et confirmer')}
            </Button>
          </div>
          <ErrorMessage error={decide.error} />
        </>
      )}

      <DepositTrace steps={steps} />
      {view && proof.data && <ProofViewer url={proof.data.url} onClose={() => setView(false)} />}
      {rejecting && <RejectSheet id={b.id} onClose={() => setRejecting(false)} />}
    </section>
  );
}
