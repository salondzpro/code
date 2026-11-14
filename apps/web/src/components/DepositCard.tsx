/**
 * VERSEMENT, CÔTÉ CLIENTE (14 nov. 2026, migration 0057).
 *
 * Une seule carte, à la confirmation de la réservation ET sur la fiche du rendez-vous :
 * - versement à faire (ou justificatif refusé) : le montant en grand, l'heure limite, le compte du salon
 *   sur une carte d'encre (numéro et montant à copier d'un toucher), trois étapes, et « Joindre le
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

  // Justificatif envoyé : le suivi.
  if (status === 'submitted')
    return (
      <section className="dp">
        <header className="dp-h">
          <span className="dp-eyebrow">
            <I icon={Clock3} size={14} /> {t('Justificatif en vérification')}
          </span>
          <strong className="dp-amount" dir="ltr">{amount}</strong>
          <p className="dp-sub">{t('Le salon vérifie votre virement. Votre rendez-vous sera confirmé dès sa validation, et vous serez prévenu(e).')}</p>
        </header>
        <DepositTrace
          steps={[
            { label: t('Créneau réservé'), when: formatWhen(b.createdAt), state: 'done' },
            { label: t('Justificatif envoyé'), when: b.depositSubmittedAt ? formatWhen(b.depositSubmittedAt) : null, state: 'done' },
            { label: t('Vérification par le salon'), state: 'now' },
            { label: t('Rendez-vous confirmé'), state: 'todo' },
          ]}
        />
        {fileInput}
        <Button variant="g" sm icon={ICONE.joindreJustificatif} loading={sending} onClick={() => input.current?.click()}>
          {t('Remplacer le justificatif')}
        </Button>
        {error && <p className="dp-err" role="alert">{error}</p>}
      </section>
    );

  // Versement à faire (ou à refaire).
  const acc = d?.account ?? null;
  return (
    <section className="dp">
      <header className="dp-h">
        <span className="dp-eyebrow">
          <I icon={Landmark} size={14} /> {t('Versement pour confirmer')}
        </span>
        <strong className="dp-amount" dir="ltr">{amount}</strong>
        <p className="dp-sub">
          {deadline
            ? t('À verser avant {quand}. Sans justificatif, le créneau est libéré.', { quand: deadline })
            : t('Le salon demande un versement pour confirmer ce rendez-vous.')}
        </p>
      </header>

      {status === 'rejected' && (
        <div className="dp-bad" role="alert">
          <I icon={AlertCircle} size={18} />
          <span>
            <b>{t('Justificatif refusé par le salon')}</b>
            {b.depositRejectReason && <span>« {b.depositRejectReason} »</span>}
            <span>{t('Envoyez-en un autre avant l’heure limite.')}</span>
          </span>
        </div>
      )}

      {info.isPending ? (
        <div className="dp-acc sk" aria-hidden />
      ) : acc?.account ? (
        <div className="dp-acc">
          <div className="dp-acc-top">
            <span>{t(METHOD_LABEL[acc.method])}</span>
            <I icon={Landmark} size={18} />
          </div>
          <div className="dp-acc-num" dir="ltr">{acc.account}</div>
          <div className="dp-acc-row">
            <span className="dp-acc-who">
              <small>{t('Titulaire')}</small>
              <b dir="auto">{acc.holder}</b>
            </span>
            <CopyChip value={acc.account} label={t('Copier le numéro de compte')} />
          </div>
          <div className="dp-acc-row dp-acc-sum">
            <span className="dp-acc-who">
              <small>{t('Montant exact')}</small>
              <b dir="ltr">{amount}</b>
            </span>
            <CopyChip value={String(b.depositAmount)} label={t('Copier le montant')} />
          </div>
          {acc.note && <p className="dp-acc-note" dir="auto">{acc.note}</p>}
        </div>
      ) : (
        <p className="dp-sub">{t('Le salon n’a pas encore indiqué son compte. Contactez-le pour verser.')}</p>
      )}

      <ol className="dp-steps">
        <li>
          <span>1</span>
          {t('Virez {montant} sur ce compte (CCP, BaridiMob ou banque).', { montant: amount })}
        </li>
        <li>
          <span>2</span>
          {t('Faites une capture d’écran du reçu, ou gardez le PDF.')}
        </li>
        <li>
          <span>3</span>
          {t('Joignez-la ici : le salon valide et votre rendez-vous est confirmé.')}
        </li>
      </ol>

      {fileInput}
      <Button icon={ICONE.joindreJustificatif} loading={sending} onClick={() => input.current?.click()}>
        {status === 'rejected' ? t('Envoyer un autre justificatif') : t('Joindre le justificatif')}
      </Button>
      <p className="dp-foot">{t('Image ou PDF, 8 Mo au plus. Seul le salon le voit.')}</p>
      {error && <p className="dp-err" role="alert">{error}</p>}
    </section>
  );
}
