/**
 * Prochains rendez-vous de l'accueil pro (refonte du 6 nov. 2026), dans l'en-tête violet :
 *
 *   1. le RÉSUMÉ du jour sur toute la largeur (anneau, à venir, terminés) : seul lien vers l'agenda ;
 *   2. LE prochain rendez-vous en grand, avec le temps qui reste (« Dans 25 min » ; pendant la
 *      prestation « En ce moment », « Encore 10 min » et sa barre d'avancement), puis sa seule action
 *      utile : valider une demande, sinon joindre le client. Le rappel se confirme SUR la carte, comme
 *      sur la page Rappels : « Message envoyé à … ? » ✕ / ✓, puis « Prévenu par WhatsApp à 14:32 » ;
 *   3. ENSUITE, les suivants en lignes courtes ; au-delà de trois, un compte.
 *
 * La carte et chaque ligne ouvrent la fenêtre du rendez-vous, qui porte tout le reste.
 */
import { ICONE } from '@/lib/actionIcons';
import { Link } from 'react-router';
import { Check, ChevronRight, X } from 'lucide-react';
import type { useProBookingMutations } from '@salondz/api-client';
import { formatDA, formatTimeDZ } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Button, I } from './ui';
import { ClientContact } from './ClientContact';
import { formatDuration } from '@/lib/format';
import { answerReminder, remindedLabel, useAskInline, usePendingReminder, useReminded } from '@/lib/reminders';
import { t } from '@/i18n';

const SHOWN_AFTER = 3;

/** « Dans 25 min », « Dans 1 h 05 », ou pendant la prestation « Encore 10 min ». */
function until(b: BookingWithStaff, now: number): { text: string; live: boolean; progress: number } {
  const start = new Date(b.startsAt).getTime();
  const end = new Date(b.endsAt).getTime();
  if (start <= now) {
    const left = Math.max(1, Math.round((end - now) / 60_000));
    return { text: t('Encore {n} min', { n: left }), live: true, progress: Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start))) };
  }
  const min = Math.max(1, Math.round((start - now) / 60_000));
  if (min < 60) return { text: t('Dans {n} min', { n: min }), live: false, progress: 0 };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { text: m ? t('Dans {h} h {m}', { h, m: String(m).padStart(2, '0') }) : t('Dans {h} h', { h }), live: false, progress: 0 };
}

export function HomeUpcoming({
  all,
  upcoming,
  now,
  salon,
  setStatus,
  onPeek,
}: {
  all: BookingWithStaff[];
  upcoming: BookingWithStaff[];
  now: number;
  salon: SalonOwnerView | null;
  setStatus: ReturnType<typeof useProBookingMutations>['setStatus'];
  onPeek: (id: string) => void;
}) {
  const total = all.length;
  const done = total - upcoming.length;

  return (
    <section className="h13" aria-label={t('Prochains rendez-vous')}>
      <Link to="/pro/agenda" className="h13-sum">
        <span className="h13-ring" aria-hidden>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" pathLength="100" />
            {done > 0 && <circle className="on" cx="50" cy="50" r="44" pathLength="100" strokeDasharray={`${(done / total) * 100} 100`} />}
          </svg>
          <b>{total}</b>
        </span>
        <span className="min-w-0 flex-1">
          <b>{t('rendez-vous aujourd’hui')}</b>
          <span>{upcoming.length ? t('{a} à venir · {d} terminé(s)', { a: upcoming.length, d: done }) : t('Plus rien de prévu')}</span>
        </span>
        <I icon={ChevronRight} size={20} strokeWidth={2} className="h13-chev" />
      </Link>

      {/* SIMPLIFIÉ (20 nov. 2026, demande du propriétaire : « le pro a le réflexe de regarder l'agenda,
          ça sert à rien de dupliquer ») : plus de grande carte ni de liste « Ensuite » — une rangée
          qui défile de côté, une petite carte par rendez-vous à venir (heure, client), qui ouvre la
          fenêtre du rendez-vous. Le détail et les actions sont dans l'agenda. */}
      {upcoming.length > 0 && (
        <div className="h13-strip" role="list" aria-label={t('Prochains rendez-vous')}>
          {upcoming.map((b) => {
            const live = new Date(b.startsAt).getTime() <= now;
            return (
              <button
                key={b.id}
                type="button"
                role="listitem"
                className={`h13-chip${b.status === 'pending' ? ' pd' : ''}${live ? ' live' : ''}`}
                onClick={() => onPeek(b.id)}
              >
                <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
                <span dir="auto">{b.clientName}</span>
                {b.status === 'pending' && <em>{t('À valider')}</em>}
                {live && <em>{t('En ce moment')}</em>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function NextCard({
  b,
  now,
  salon,
  setStatus,
  onPeek,
}: {
  b: BookingWithStaff;
  now: number;
  salon: SalonOwnerView | null;
  setStatus: ReturnType<typeof useProBookingMutations>['setStatus'];
  onPeek: (id: string) => void;
}) {
  const when = until(b, now);
  const pending = b.status === 'pending';
  const askable = pending && !when.live;
  const remind = b.status === 'confirmed' && !when.live;
  const ask = usePendingReminder();
  const asking = ask?.id === b.id ? ask : null;
  const done = useReminded()[b.id];
  useAskInline(asking ? b.id : null);
  return (
    <article className={`h13-hero${when.live ? ' live' : ''}`}>
      <button type="button" className="h13-hb" onClick={() => onPeek(b.id)}>
        <span className="h13-top">
          <span className={`h13-tag${pending ? ' wait' : when.live ? ' live' : ''}`}>
            {pending ? t('À valider') : when.live ? t('En ce moment') : t('Prochain rendez-vous')}
          </span>
          <span className={`h13-when${when.live ? ' live' : ''}`}>
            {when.live && <i aria-hidden />}
            {when.text}
          </span>
        </span>
        <span className="h13-row">
          <span className="h13-time">
            <b dir="ltr">{formatTimeDZ(b.startsAt)}</b>
            <small dir="ltr">{formatTimeDZ(b.endsAt)}</small>
          </span>
          <span className="h13-info">
            <b dir="auto">{b.clientName}</b>
            <span dir="auto">
              {b.serviceName} · {formatDuration(b.durationMinutes)}
            </span>
          </span>
          <b className="h13-price" dir="ltr">
            {formatDA(b.priceDa)}
          </b>
        </span>
        {when.live && (
          <span className="h13-prog" aria-hidden>
            <i style={{ width: `${Math.round(when.progress * 100)}%` }} />
          </span>
        )}
      </button>
      {askable ? (
        <div className="ag9-ac h13-ac">
          <Button icon={ICONE.refuser} sm className="ag9-n r" onClick={() => onPeek(b.id)}>
            {t('Refuser')}
          </Button>
          <Button icon={ICONE.accepter}
            sm
            className="ag9-b"
            loading={setStatus.isPending && setStatus.variables?.id === b.id}
            onClick={() => setStatus.mutate({ id: b.id, status: 'confirmed' })}
          >
            {t('Accepter')}
          </Button>
        </div>
      ) : asking ? (
        <div className="h13-ft">
          <span className="h13-q" dir="auto">
            {asking.via === 'call' ? t('Avez-vous joint {name} ?', { name: asking.name }) : t('Message envoyé à {name} ?', { name: asking.name })}
          </span>
          <span className="rp-q">
            <button type="button" className="rp-i" aria-label={t('Non')} title={t('Non')} onClick={() => answerReminder(false)}>
              <I icon={X} size={18} />
            </button>
            <button type="button" className="rp-i yes" aria-label={t('Oui')} title={t('Oui')} onClick={() => answerReminder(true)}>
              <I icon={Check} size={18} />
            </button>
          </span>
        </div>
      ) : b.clientPhone ? (
        <div className="h13-ft">
          {done && (
            <span className="h13-ok">
              <I icon={Check} size={16} strokeWidth={2.4} />
              <span>{remindedLabel(done)}</span>
            </span>
          )}
          <ClientContact booking={b} salon={salon} remind={remind && !done} />
        </div>
      ) : null}
    </article>
  );
}
