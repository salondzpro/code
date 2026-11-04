/**
 * Rappels, version minimaliste : le titre, un crayon pour le message, Aujourd'hui / Demain, puis une
 * ligne par rendez-vous confirmé et pas encore rappelé, avec trois icônes : WhatsApp et SMS (message
 * déjà écrit), appel. Un message envoyé fait quitter la liste ; un appel non,
 * il peut rester sans réponse. Par défaut, les prochains rendez-vous d'aujourd'hui ; demain se prépare
 * d'un toucher.
 */
import { useState } from 'react';
import { Pencil, Phone, Send } from 'lucide-react';
import { useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { BottomSheet, Button, Dim, I, Skeleton, Textarea } from '@/components/ui';
import { WhatsAppLogo } from '@/components/BrandIcons';
import {
  defaultReminderMessage,
  fillReminder,
  markReminded,
  readReminderMessage,
  saveReminderMessage,
  useReminded,
  useReminderBookings,
} from '@/lib/reminders';
import { t } from '@/i18n';

type Day = 'today' | 'tomorrow';

const TAGS = [
  { key: 'prenom', label: 'Prénom' },
  { key: 'prestation', label: 'Prestation' },
  { key: 'jour', label: 'Jour' },
  { key: 'heure', label: 'Heure' },
];

function MessageSheet({
  salon,
  sample,
  onClose,
}: {
  salon: SalonOwnerView;
  sample: BookingWithStaff | undefined;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => readReminderMessage(salon.id));
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[88vh] overflow-y-auto">
        <div className="h2 !text-[1.286rem]">{t('Modifier le message')}</div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={400} aria-label={t('Modifier le message')} />
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map((x) => (
            <button key={x.key} type="button" className="rp-tag" onClick={() => setText((v) => `${v.trimEnd()} {${x.key}}`)}>
              + {t(x.label)}
            </button>
          ))}
        </div>
        {sample && <p className="rp-prev">{fillReminder(text, sample, salon)}</p>}
        <Button
          className="ag9-b"
          onClick={() => {
            saveReminderMessage(salon.id, text);
            onClose();
          }}
        >
          {t('Enregistrer')}
        </Button>
        <button type="button" className="rp-reset" onClick={() => setText(defaultReminderMessage())}>
          {t('Revenir au message d’origine')}
        </button>
      </BottomSheet>
    </>
  );
}

export function Reminders() {
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const { list, items } = useReminderBookings(!!salon);
  const sent = useReminded();
  const [day, setDay] = useState<Day>('today');
  const [editing, setEditing] = useState(false);
  if (!salon) return <PageLoading />;

  const key = day === 'today' ? today : tomorrow;
  const ofDay = items.filter((b) => toLocalDateKey(new Date(b.startsAt)) === key);
  const waiting = ofDay.filter((b) => !sent[b.id]);
  const team = salon.staff.filter((m) => m.isActive).length > 1;

  const message = (b: BookingWithStaff) => encodeURIComponent(fillReminder(readReminderMessage(salon.id), b, salon));
  const whatsapp = (b: BookingWithStaff) => {
    if (!b.clientPhone) return;
    // Pas `wa.me` : sa redirection casse les émojis du message.
    window.open(`https://api.whatsapp.com/send?phone=${b.clientPhone.replace(/\D/g, '')}&text=${message(b)}`, '_blank', 'noopener');
    markReminded(b.id);
  };

  return (
    <Screen bottom={NAV_PAD} gap={8}>
      <div className="rp-hd">
        <h1 className="h1">{t('Rappels')}</h1>
        <button type="button" className="rp-i" aria-label={t('Modifier le message')} title={t('Modifier le message')} onClick={() => setEditing(true)}>
          <I icon={Pencil} size={18} />
        </button>
      </div>
      <div className="rp-tabs" role="tablist" aria-label={t('Jour')}>
        {(['today', 'tomorrow'] as Day[]).map((d) => (
          <button key={d} type="button" role="tab" aria-selected={day === d} className={day === d ? 'on' : ''} onClick={() => setDay(d)}>
            {d === 'today' ? t("Aujourd'hui") : t('Demain')}
          </button>
        ))}
      </div>
      {list.isError && <ErrorMessage error={list.error} retry={() => list.refetch()} />}
      {list.isPending && <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card-sm)]" />}
      {list.data && waiting.length === 0 && (
        <div className="rp-empty">
          <I icon={Send} size={28} strokeWidth={1.6} />
          <span>{t('Aucun rappel à envoyer')}</span>
        </div>
      )}
      {waiting.map((b) => (
        <article key={b.id} className="rp-r">
          <b className="rp-t" dir="ltr">
            {formatTimeDZ(b.startsAt)}
          </b>
          <span className="min-w-0 flex-1">
            <span className="rp-n">{b.clientName}</span>
            <span className="rp-s">
              {b.serviceName}
              {team && b.staff ? ` · ${b.staff.displayName}` : ''}
            </span>
          </span>
          {b.clientPhone ? (
            <span className="rp-a">
              <button type="button" className="rp-i" aria-label={t('WhatsApp')} title={t('WhatsApp')} onClick={() => whatsapp(b)}>
                <WhatsAppLogo size={20} />
              </button>
              {/* `?&body=` : la seule écriture comprise à la fois par Android et l'iPhone. */}
              <a href={`sms:${b.clientPhone}?&body=${message(b)}`} className="rp-i" aria-label={t('SMS')} title={t('SMS')} onClick={() => markReminded(b.id)}>
                <I icon={Send} size={18} />
              </a>
              <a href={`tel:${b.clientPhone}`} className="rp-i" aria-label={t('Appeler')} title={t('Appeler')}>
                <I icon={Phone} size={18} />
              </a>
            </span>
          ) : (
            <span className="rp-no">{t('Sans numéro')}</span>
          )}
        </article>
      ))}
      {editing && <MessageSheet salon={salon} sample={waiting[0] ?? items[0]} onClose={() => setEditing(false)} />}
    </Screen>
  );
}
