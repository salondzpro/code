/**
 * VERSEMENT, CÔTÉ CLIENTE (14 nov. 2026, migration 0057).
 *
 * Une seule carte, à la confirmation de la réservation ET sur la fiche du rendez-vous :
 * - versement à faire (ou justificatif refusé) : le montant en grand, l'heure limite, le compte du salon
 *   en lignes blanches (numéro CCP et montant à copier d'un toucher), deux étapes, et « Joindre le
 *   justificatif » (image ou PDF) ;
 * - justificatif envoyé : le suivi, étape par étape, jusqu'à la validation du salon ;
 * - versement validé : une ligne, verte.
 * Le compte n'est jamais affiché une fois le justificatif envoyé : l'API ne le rend plus.
 */
import { useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, Check, Clock3, Copy, Landmark } from 'lucide-react';
import { useApi, useBookingDeposit } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import type { BookingWithSalon } from '@salondz/types';
import { useQueryClient } from '@tanstack/react-query';
import { Button, I } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { METHOD_LABEL, ProofError, formatDeadline, formatWhen, sendDepositProof } from '@/lib/deposit';
import { t } from '@/i18n';

function CopyChip({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`dp-copy${done ? ' on' : ''}`}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
    >
      <I icon={done ? Check : Copy} size={15} />
      {done ? t('Copié') : t('Copier')}
    </button>
  );
}

/** Le suivi, étape par étape — ce qui est fait est coché, l'étape en cours est cerclée. */
export function DepositTrace({ steps }: { steps: { label: string; when?: string | null; state: 'done' | 'now' | 'todo' | 'bad'; note?: string | null }[] }) {
  return (
    <ol className="dp-trace">
      {steps.map((s, i) => (
        <li key={i} className={s.state}>
          <span className="dp-dot" aria-hidden>
            {s.state === 'done' && <I icon={Check} size={12} strokeWidth={2.4} />}
            {s.state === 'bad' && <I icon={AlertCircle} size={12} strokeWidth={2.2} />}
          </span>
          <span className="dp-tl">
            <b>{s.label}</b>
            {s.when && <small dir="auto">{s.when}</small>}
            {s.note && <em>« {s.note} »</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DepositCard({ booking: b }: { booking: BookingWithSalon }) {
  const { api } = useApi();
  const qc = useQueryClient();
  const status = b.depositStatus ?? null;
  const live = b.status === 'pending';
  const info = useBookingDeposit(b.id, !!b.depositAmount && live);
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Étape affichée : 0 verser, 1 joindre le reçu (un refus du salon ramène directement au reçu).
  const [step, setStep] = useState<0 | 1>(status === 'rejected' ? 1 : 0);
  if (!b.depositAmount || !status) return null;
  const amount = formatDA(b.depositAmount);

  // Versement validé : une ligne suffit.
  if (status === 'accepted')
    return (
      <div className="dp-ok">
        <I icon={BadgeCheck} size={20} />
        <span>
          <b>{t('Versement de {montant} validé', { montant: amount })}</b>
          {b.depositReviewedAt && <small>{formatWhen(b.depositReviewedAt)}</small>}
        </span>
      </div>
    );
  // Demande close sans versement validé (annulée, expirée) : rien à faire.
  if (!live) return null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSending(true);
    try {
      await sendDepositProof(api, b.id, file);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['booking', b.id] }),
        qc.invalidateQueries({ queryKey: ['me', 'bookings'] }),
      ]);
    } catch (e) {
      setError(e instanceof ProofError ? e.message : t('L’envoi a échoué. Vérifiez votre connexion et réessayez.'));
    } finally {
      setSending(false);
      if (input.current) input.current.value = '';
    }
  };
  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*,application/pdf"
      className="hidden"
      onChange={(e) => void pick(e.target.files?.[0])}
    />
  );

  const d = info.data;
  const deadline = d?.deadline ? formatDeadline(d.deadline) : null;

  // PARCOURS ÉTAPE PAR ÉTAPE (15 nov. 2026, demande du propriétaire) : Verser → Reçu → Confirmé, une
  // étape à la fois, barre de progression en tête, très peu de texte — comme l'inscription pro.
  const current = status === 'submitted' ? 2 : step;
  const acc = d?.account ?? null;
  const bar = (
    <ol className="dps-bar" aria-label={t('Étapes du versement')}>
      {[t('Verser'), t('Reçu'), t('Confirmé')].map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="dps-dot">{i < current ? <I icon={Check} size={12} strokeWidth={3} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );

  if (status === 'submitted')
    return (
      <section className="dp dps">
        {bar}
        <div className="dps-wait">
          <span className="dps-wait-ic" aria-hidden>
            <I icon={Clock3} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <b>{t('Reçu en vérification')}</b>
            <small>{t('Le salon confirme dès réception.')}</small>
          </span>
        </div>
        {fileInput}
        <Button variant="g" sm icon={ICONE.joindreJustificatif} loading={sending} onClick={() => input.current?.click()}>
          {t('Remplacer le reçu')}
        </Button>
        {error && <p className="dp-err" role="alert">{error}</p>}
      </section>
    );

  return (
    <section className="dp dps">
      {bar}
      {status === 'rejected' && (
        <div className="dp-bad" role="alert">
          <I icon={AlertCircle} size={18} />
          <span>
            <b>{t('Reçu refusé')}</b>
            {b.depositRejectReason && <span>« {b.depositRejectReason} »</span>}
          </span>
        </div>
      )}

      {current === 0 ? (
        <>
          <div className="dps-amt">
            <strong dir="ltr">{amount}</strong>
            {deadline && <small>{t('avant {quand}', { quand: deadline })}</small>}
          </div>
          {info.isPending ? (
            <div className="dp-acc sk" aria-hidden />
          ) : acc?.account ? (
            <div className="dp-acc">
              <div className="dp-acc-li">
                <span className="dp-acc-who">
                  <small>{t(METHOD_LABEL[acc.method])}</small>
                  <b className="mono" dir="ltr">{acc.account}</b>
                  <span dir="auto">{acc.holder || b.salon.name}</span>
                </span>
                <CopyChip value={acc.account.replace(/\s/g, '')} label={t('Copier le numéro CCP')} />
              </div>
            </div>
          ) : (
            <p className="dp-sub">{t('Le salon n’a pas encore indiqué son compte.')}</p>
          )}
          <Button icon={ICONE.continuer} onClick={() => setStep(1)}>
            {t('J’ai versé {montant}', { montant: amount })}
          </Button>
        </>
      ) : (
        <>
          {fileInput}
          <button type="button" className="dps-drop" onClick={() => input.current?.click()} disabled={sending}>
            <span className="dps-drop-ic" aria-hidden>
              <I icon={ICONE.joindreJustificatif} size={24} />
            </span>
            <b>{sending ? t('Envoi…') : t('Joindre la capture du reçu')}</b>
            <small>{t('Image ou PDF')}</small>
          </button>
          {status !== 'rejected' && (
            <button type="button" className="dps-back" onClick={() => setStep(0)}>
              {t('Revoir le compte')}
            </button>
          )}
        </>
      )}
      {error && <p className="dp-err" role="alert">{error}</p>}
    </section>
  );
}
