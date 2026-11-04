/**
 * Rappels : un écran, une tâche. Les clients à prévenir, un grand bouton WhatsApp par personne, le
 * message déjà écrit et modifiable. Ce qui est parti descend dans « Déjà envoyés » : il ne reste en
 * haut que ce qui reste à faire. Demain d'abord : un rappel se prépare la veille.
 *
 * Le rappel automatique part du serveur (notification 1 h et 30 min avant) vers les clients qui ont
 * un compte. WhatsApp ne s'envoie qu'à la main : aucun envoi automatique n'existe.
 */
import { useState } from 'react';
import { Check, MessageCircle, Pencil, Phone, Send, Zap } from 'lucide-react';
import { useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { BottomSheet, Button, Dim, EmptyState, I, SectionLabel, Segmented, Skeleton, Textarea } from '@/components/ui';
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

type Day = 'tomorrow' | 'today';

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
        <div className="h2 !text-[1.286rem]">{t('Message de rappel')}</div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={400} aria-label={t('Message de rappel')} />
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
  const [picked, setPicked] = useState<Day | null>(null);
  const [editing, setEditing] = useState(false);
  if (!salon) return <PageLoading />;

  const keyOf = (b: BookingWithStaff) => toLocalDateKey(new Date(b.startsAt));
  const of = (d: string) => items.filter((b) => keyOf(b) === d);
  const toSend = (l: BookingWithStaff[]) => l.filter((b) => b.clientPhone && !sent[b.id]).length;
  // Demain d'abord, sauf s'il n'y a rien à y faire et qu'il reste du monde aujourd'hui.
  const day: Day = picked ?? (toSend(of(tomorrow)) === 0 && toSend(of(today)) > 0 ? 'today' : 'tomorrow');
  const shown = of(day === 'today' ? today : tomorrow);
  const waiting = shown.filter((b) => !sent[b.id]);
  const done = shown.filter((b) => sent[b.id]);

  const send = (b: BookingWithStaff) => {
    if (!b.clientPhone) return;
    const text = encodeURIComponent(fillReminder(readReminderMessage(salon.id), b, salon));
    // Pas `wa.me` : sa redirection casse les émojis du message.
    window.open(`https://api.whatsapp.com/send?phone=${b.clientPhone.replace(/\D/g, '')}&text=${text}`, '_blank', 'noopener');
    markReminded(b.id);
  };

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="h1">{t('Rappels')}</h1>
        <button type="button" className="rp-edit" onClick={() => setEditing(true)}>
          <I icon={Pencil} size={15} /> {t('Message')}
        </button>
      </div>
      <Segmented
        label={t('Jour')}
        value={day}
        onChange={setPicked}
        options={[
          { value: 'tomorrow', label: `${t('Demain')} (${toSend(of(tomorrow))})` },
          { value: 'today', label: `${t("Aujourd'hui")} (${toSend(of(today))})` },
        ]}
      />
      {list.isError && <ErrorMessage error={list.error} retry={() => list.refetch()} />}
      {list.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}
      {list.data && shown.length === 0 && (
        <EmptyState
          icon={Send}
          title={t('Aucun rappel à envoyer')}
          description={day === 'tomorrow' ? t('Aucun rendez-vous confirmé demain.') : t('Plus aucun rendez-vous à venir aujourd’hui.')}
        />
      )}
      {list.data && shown.length > 0 && waiting.length === 0 && (
        <div className="rp-ok">
          <I icon={Check} size={18} /> {t('Tout le monde est prévenu')}
        </div>
      )}
      {waiting.map((b) => (
        <article key={b.id} className="rp-c">
          <div className="rp-h">
            <b className="rp-t" dir="ltr">
              {formatTimeDZ(b.startsAt)}
            </b>
            <span className="min-w-0 flex-1">
              <span className="rp-n">{b.clientName}</span>
              <span className="rp-s">
                {b.serviceName}
                {b.staff && salon.staff.filter((m) => m.isActive).length > 1 ? ` · ${b.staff.displayName}` : ''}
              </span>
            </span>
          </div>
          {b.clientPhone ? (
            <div className="rp-a">
              <button type="button" className="rp-b" onClick={() => send(b)}>
                <I icon={MessageCircle} size={18} /> WhatsApp
              </button>
              <a href={`tel:${b.clientPhone}`} className="rp-p" aria-label={t('Appeler {name}', { name: b.clientName })}>
                <I icon={Phone} size={18} />
              </a>
            </div>
          ) : (
            <span className="rp-no">{t('Sans numéro')}</span>
          )}
        </article>
      ))}
      {done.length > 0 && (
        <>
          <SectionLabel>{t('Déjà envoyés')}</SectionLabel>
          <div className="crd !gap-0 !py-1">
            {done.map((b) => (
              <button key={b.id} type="button" className="rp-d" onClick={() => send(b)} aria-label={t('Renvoyer à {name}', { name: b.clientName })}>
                <I icon={Check} size={16} className="text-ok" />
                <span className="min-w-0 flex-1 truncate">{b.clientName}</span>
                <span dir="ltr">{formatTimeDZ(b.startsAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="rp-auto">
        <I icon={Zap} size={14} /> {t('Automatique : notification 1 h et 30 min avant, pour les clients avec un compte.')}
      </p>
      {editing && <MessageSheet salon={salon} sample={shown[0] ?? items[0]} onClose={() => setEditing(false)} />}
    </Screen>
  );
}
