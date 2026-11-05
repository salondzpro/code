/**
 * « Partager mes disponibilités » : un message prêt à envoyer à qui demande les disponibilités en
 * message privé. On choisit la prestation et le jour, le texte se fait tout seul avec les vraies
 * disponibilités, puis Copier ou Partager. Une prestation choisie mène directement à sa réservation.
 */
import { useState } from 'react';
import { addDaysToKey, dayChipLabelDZ, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { BottomSheet, Button, Dim, Pill, Skeleton } from './ui';
import { env } from '@/lib/env';
import { storyMessage } from '@/lib/storyImage';
import { fullStoryDate, useStoryDefaultDay, useStorySlots } from '@/lib/useStorySlots';
import { t } from '@/i18n';

const DAYS_OFFERED = 7;

export function DispoSheet({ salon, url, onCopy, onClose }: { salon: SalonOwnerView; url: string; onCopy: (text: string) => void; onClose: () => void }) {
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const services = salon.services.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const { date: byDefault, noneToday } = useStoryDefaultDay(salon);
  const date = chosen ?? byDefault;
  const { slots, ready } = useStorySlots(salon, date, undefined, serviceId ?? undefined);

  const label = (d: string) => (d === today ? t("Aujourd'hui") : d === tomorrow ? t('Demain') : dayChipLabelDZ(d));
  const days = Array.from({ length: DAYS_OFFERED }, (_, i) => addDaysToKey(today, i)).filter((d) => d !== today || !noneToday);
  const service = services.find((s) => s.id === serviceId);
  const dayText = date === today || date === tomorrow ? label(date) : fullStoryDate(date);
  const link = service ? `${env.siteUrl}/s/${salon.slug}/prestations?service=${service.id}` : url;
  const message = slots.length ? storyMessage(dayText, slots, link, service?.name) : '';

  const share = async () => {
    if (!navigator.share) {
      onCopy(message);
      return;
    }
    try {
      await navigator.share({ text: message });
      onClose();
    } catch {
      /* feuille refermée : on reste ici */
    }
  };

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[88vh] overflow-y-auto">
        <div>
          <h2 className="h2">{t('Partager mes disponibilités')}</h2>
          <p className="ds-p">{t('Un message prêt à envoyer à qui vous demande vos disponibilités.')}</p>
        </div>

        <div className="ds-g">
          <span>{t('Prestation')}</span>
          <div className="pills bleed" role="group" aria-label={t('Prestation')}>
            <Pill on={!serviceId} onClick={() => setServiceId(null)}>
              {t('Toutes')}
            </Pill>
            {services.map((s) => (
              <Pill key={s.id} on={s.id === serviceId} onClick={() => setServiceId(s.id)}>
                {s.name}
              </Pill>
            ))}
          </div>
        </div>

        <div className="ds-g">
          <span>{t('Jour')}</span>
          <div className="pills bleed" role="group" aria-label={t('Jour')}>
            {days.map((d) => (
              <Pill key={d} on={d === date} onClick={() => setChosen(d)}>
                {label(d)}
              </Pill>
            ))}
          </div>
        </div>

        <div className="ds-g">
          <span>{t('Message')}</span>
          {!ready ? (
            <Skeleton className="h-[6rem] w-full !rounded-[var(--radius-card-sm)]" />
          ) : (
            <p className="ds-m">{message || t('Plus de créneau libre ce jour-là.')}</p>
          )}
        </div>

        <div className="g2">
          <Button sm className="ag9-b" disabled={!message} onClick={() => onCopy(message)}>
            {t('Copier')}
          </Button>
          <Button sm className="ag9-n" disabled={!message} onClick={() => void share()}>
            {t('Partager')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
