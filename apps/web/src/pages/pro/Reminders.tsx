/**
 * Rappels, sur le modèle de mew3id : le titre, une phrase qui dit ce qu'on voit, « Modifier le
 * message », puis une ligne par rendez-vous confirmé et pas encore rappelé, avec trois boutons :
 * WhatsApp et SMS (message déjà écrit), Appeler. Un message envoyé fait quitter la liste ; un appel non,
 * il peut rester sans réponse. Par défaut, les prochains rendez-vous d'aujourd'hui ; demain se prépare
 * d'un toucher.
 */
import { useState } from 'react';
import { MessageCircle, MessageSquareText, Pencil, Phone, Send } from 'lucide-react';
import { useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatLocale, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { BottomSheet, Button, Dim, I, Segmented, Skeleton, Textarea } from '@/components/ui';
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

const longDay = (key: string) =>
  new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${key}T12:00:00Z`),
  );

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
    <Screen bottom={NAV_PAD} gap={12}>
      <div>
        <h1 className="h1">{t('Rappels')}</h1>
        <p className="rp-sub">
          {day === 'today'
            ? t('Prochains rendez-vous confirmés d’aujourd’hui ({date}) pas encore rappelés.', { date: longDay(key) })
            : t('Rendez-vous confirmés de demain ({date}) pas encore rappelés.', { date: longDay(key) })}
        </p>
      </div>
      <button type="button" className="rp-edit" onClick={() => setEditing(true)}>
        <I icon={Pencil} size={15} /> {t('Modifier le message')}
      </button>
      <Segmented
        sm
        label={t('Jour')}
        value={day}
        onChange={setDay}
        options={[
          { value: 'today', label: t("Aujourd'hui") },
          { value: 'tomorrow', label: t('Demain') },
        ]}
      />
      {list.isError && <ErrorMessage error={list.error} retry={() => list.refetch()} />}
      {list.isPending && <Skeleton className="h-[9rem] w-full !rounded-[var(--radius-card)]" />}
      {list.data && waiting.length === 0 && (
        <div className="rp-card rp-empty">
          <I icon={Send} size={36} strokeWidth={1.6} />
          <b>{t('Aucun rappel à envoyer')}</b>
          <span>
            {day === 'today'
              ? t('Les prochains rendez-vous confirmés d’aujourd’hui apparaîtront ici.')
              : t('Les rendez-vous confirmés pour demain apparaîtront ici.')}
          </span>
        </div>
      )}
      {waiting.length > 0 && (
        <div className="rp-card">
          {waiting.map((b) => (
            <article key={b.id} className="rp-r">
              <b className="rp-n">{b.clientName}</b>
              <span className="rp-s">
                <span dir="ltr">{formatTimeDZ(b.startsAt)}</span> · {b.serviceName}
                {team && b.staff ? ` · ${b.staff.displayName}` : ''}
              </span>
              {b.clientPhone ? (
                <div className="rp-a">
                  <button type="button" className="rp-b wa" onClick={() => whatsapp(b)}>
                    <I icon={MessageCircle} size={20} /> WhatsApp
                  </button>
                  {/* `?&body=` : la seule écriture comprise à la fois par Android et l'iPhone. */}
                  <a href={`sms:${b.clientPhone}?&body=${message(b)}`} className="rp-b sms" onClick={() => markReminded(b.id)}>
                    <I icon={MessageSquareText} size={20} /> {t('SMS')}
                  </a>
                  <a href={`tel:${b.clientPhone}`} className="rp-b tel">
                    <I icon={Phone} size={20} /> {t('Appeler')}
                  </a>
                </div>
              ) : (
                <span className="rp-no">{t('Sans numéro')}</span>
              )}
            </article>
          ))}
        </div>
      )}
      {editing && <MessageSheet salon={salon} sample={waiting[0] ?? items[0]} onClose={() => setEditing(false)} />}
    </Screen>
  );
}
