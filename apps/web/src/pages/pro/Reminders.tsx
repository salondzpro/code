/**
 * Rappels : les rendez-vous confirmés d'aujourd'hui et de demain, un bouton WhatsApp par personne,
 * message déjà écrit. Ce qui est parti reste marqué sur cet appareil, pour ne pas envoyer deux fois.
 *
 * Le rappel automatique (notification 1 h et 30 min avant) part du serveur vers les clients qui ont un
 * compte, sans rien faire. WhatsApp ne s'envoie qu'à la main : aucun envoi automatique n'existe.
 */
import { useState } from 'react';
import { BellRing, Check, MessageCircle, Zap } from 'lucide-react';
import { useProBookings, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatTimeDZ, toLocalDateKey } from '@salondz/constants';
import type { BookingWithStaff, SalonOwnerView } from '@salondz/types';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { PageLoading } from '@/components/PageLoading';
import { EmptyState, I, PageHead, SectionLabel, Skeleton } from '@/components/ui';
import { t } from '@/i18n';

const KEY = 'salondz:reminded';
const KEEP_MS = 3 * 86_400_000;

function readSent(): Record<string, number> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    return Object.fromEntries(Object.entries(all).filter(([, at]) => Date.now() - at < KEEP_MS));
  } catch {
    return {};
  }
}

function reminderText(b: BookingWithStaff, salon: SalonOwnerView, today: string) {
  const first = b.clientName.split(' ')[0] ?? b.clientName;
  const vars = { first, svc: b.serviceName, salon: salon.name, time: formatTimeDZ(b.startsAt) };
  return toLocalDateKey(new Date(b.startsAt)) === today
    ? t('Salam {first} 😊 Petit rappel : votre rendez-vous {svc} chez {salon} est aujourd’hui à {time}. À tout à l’heure !', vars)
    : t('Salam {first} 😊 Petit rappel : votre rendez-vous {svc} chez {salon} est demain à {time}. À demain !', vars);
}

export function Reminders() {
  const salon = useProSalon().data?.salon ?? null;
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const list = useProBookings({ from: today, to: tomorrow, limit: 200 }, !!salon);
  const [sent, setSent] = useState(readSent);
  if (!salon) return <PageLoading />;

  const upcoming = (list.data?.items ?? [])
    .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() > Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = [
    { key: today, label: t("Aujourd'hui") },
    { key: tomorrow, label: t('Demain') },
  ]
    .map((d) => ({ ...d, items: upcoming.filter((b) => toLocalDateKey(new Date(b.startsAt)) === d.key) }))
    .filter((d) => d.items.length > 0);

  const send = (b: BookingWithStaff) => {
    if (!b.clientPhone) return;
    const number = b.clientPhone.replace(/\D/g, '');
    const text = encodeURIComponent(reminderText(b, salon, today));
    // Pas `wa.me` : sa redirection casse les émojis du message.
    window.open(`https://api.whatsapp.com/send?phone=${number}&text=${text}`, '_blank', 'noopener');
    const next = { ...readSent(), [b.id]: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* navigation privée : marqué pour cette visite seulement */
    }
    setSent(next);
  };

  return (
    <Screen bottom={NAV_PAD} gap={12}>
      <PageHead title={t('Rappels')} />
      <div className="rp-auto">
        <span className="rp-auto-i">
          <I icon={Zap} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <b>{t('Automatique')}</b>
          <span>{t('Notification 1 h et 30 min avant')}</span>
        </span>
        <span className="rp-on">{t('Actif')}</span>
      </div>

      {list.isError && <ErrorMessage error={list.error} retry={() => list.refetch()} />}
      {list.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}
      {list.data && days.length === 0 && (
        <EmptyState icon={BellRing} title={t('Aucun rappel à envoyer')} description={t('Rien de prévu aujourd’hui ni demain.')} />
      )}
      {days.map((d) => (
        <section key={d.key} className="flex flex-col gap-2">
          <SectionLabel>{d.label}</SectionLabel>
          <div className="crd !gap-0 !py-1">
            {d.items.map((b) => {
              const done = !!sent[b.id];
              return (
                <div key={b.id} className="rp-r">
                  <b className="rp-t" dir="ltr">
                    {formatTimeDZ(b.startsAt)}
                  </b>
                  <span className="min-w-0 flex-1">
                    <span className="rp-n">{b.clientName}</span>
                    <span className="rp-s">{b.serviceName}</span>
                  </span>
                  {b.clientPhone ? (
                    <button type="button" className={`rp-b${done ? ' done' : ''}`} onClick={() => send(b)}>
                      <I icon={done ? Check : MessageCircle} size={16} />
                      {done ? t('Envoyé') : t('Envoyer')}
                    </button>
                  ) : (
                    <span className="rp-no">{t('Sans numéro')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Screen>
  );
}
