/**
 * Partager mes disponibilités : aujourd'hui par défaut, demain ou une date précise, on garde les heures voulues, et l'image de la story
 * se dessine sous les yeux. Une image ne peut pas porter de lien cliquable : pour une story, le lien
 * est copié d'office, à coller dans le sticker « Lien » d'Instagram ou de Snapchat.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useAvailability } from '@salondz/api-client';
import { addDaysToKey, formatLocale, formatTimeDZ, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { SocialShare, type SocialChannel } from './SocialShare';
import { BottomSheet, Dim, I, Skeleton } from './ui';
import { drawStory, shareImage } from '@/lib/storyImage';
import { t } from '@/i18n';

const MAX_ON_STORY = 6;
/** Un créneau toutes les heures au plus : au quart d'heure, la liste ne se lirait plus. */
const SPACING_MINUTES = 60;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fullDate = (key: string) =>
  capitalize(
    new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
  );

export function AvailabilitySheet({
  salon,
  url,
  short,
  onClose,
  onCopied,
}: {
  salon: SalonOwnerView;
  url: string;
  short: string;
  onClose: () => void;
  onCopied: (text: string) => void;
}) {
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const label = (d: string) => (d === today ? t("Aujourd'hui") : d === tomorrow ? t('Demain') : fullDate(d));

  const shortest = [...salon.services.filter((s) => s.isActive)].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const [date, setDate] = useState(today);
  const [other, setOther] = useState(false);
  const av = useAvailability(salon.id, { serviceId: shortest?.id ?? '', date });

  const slots = useMemo(() => {
    const out: string[] = [];
    for (const s of av.data?.slots ?? []) {
      if (new Date(s.startsAt).getTime() <= Date.now()) continue;
      const time = formatTimeDZ(s.startsAt);
      if (!out.length || timeToMinutes(time) - timeToMinutes(out[out.length - 1]!) >= SPACING_MINUTES) out.push(time);
    }
    return out;
  }, [av.data]);

  const [off, setOff] = useState<string[]>([]);
  useEffect(() => setOff([]), [date]);
  const times = slots.filter((x) => !off.includes(x)).slice(0, MAX_ON_STORY);

  // L'image est prête avant le toucher : le partage part aussitôt, et l'aperçu est le vrai fichier.
  const [image, setImage] = useState<{ blob: Blob; src: string } | null>(null);
  const key = `${date}|${times.join(',')}`;
  useEffect(() => {
    if (!times.length) return setImage(null);
    let dead = false;
    void drawStory({
      photo: salon.coverUrl ?? salon.photos[0]?.url ?? null,
      dayLabel: label(date),
      dateLabel: fullDate(date),
      subtitle: times.length > 1 ? t('créneaux libres') : t('créneau libre'),
      times,
      salon: salon.name,
      link: short,
    }).then((blob) => {
      if (dead || !blob) return;
      const src = URL.createObjectURL(blob);
      setImage((old) => {
        if (old) URL.revokeObjectURL(old.src);
        return { blob, src };
      });
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const pick = (d: string) => {
    setOther(false);
    setDate(d);
  };

  const [busy, setBusy] = useState<SocialChannel | null>(null);
  const [hint, setHint] = useState(false);
  const message = `${t('Salam 😊 Mes disponibilités {day} : {times}. Réservez ici 👉', { day: label(date).toLowerCase(), times: times.join(', ') })} ${url}`;

  const share = async (channel: SocialChannel) => {
    if (!image) return;
    setBusy(channel);
    const story = channel !== 'whatsapp';
    if (story) {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      setHint(true);
    }
    try {
      await shareImage(image.blob, `salondz-creneaux-${salon.slug}.png`, story ? undefined : message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[90vh] overflow-y-auto">
        <div className="h2 !text-[1.286rem]">{t('Partager mes disponibilités')}</div>
        <div className="av-m">
          <div className="av-p">{image ? <img src={image.src} alt={t('Aperçu de la story')} /> : <Skeleton className="h-full w-full" />}</div>
          <div className="min-w-0 flex-1">
            <div className="av-d" role="group" aria-label={t('Jour')}>
              <button type="button" className={!other && date === today ? 'on' : ''} onClick={() => pick(today)}>
                {t("Aujourd'hui")}
              </button>
              <button type="button" className={!other && date === tomorrow ? 'on' : ''} onClick={() => pick(tomorrow)}>
                {t('Demain')}
              </button>
              <button type="button" className={other ? 'on' : ''} onClick={() => setOther(true)}>
                {t('Autre date')}
              </button>
            </div>
            {other && (
              <input
                type="date"
                className="inp mt-2"
                value={date}
                min={today}
                aria-label={t('Autre date')}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            )}
            {av.isPending ? (
              <Skeleton className="mt-2 h-[6rem] w-full" />
            ) : slots.length ? (
              <div className="av-s" role="group" aria-label={t('Heures')}>
                {slots.slice(0, 8).map((x) => {
                  const on = !off.includes(x);
                  return (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={on}
                      className={on ? 'on' : ''}
                      dir="ltr"
                      onClick={() => setOff((o) => (on ? [...o, x] : o.filter((y) => y !== x)))}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="ag9-sn mt-2">{t('Plus de créneau libre ce jour-là.')}</p>
            )}
          </div>
        </div>
        <SocialShare busy={busy} disabled={!image} onShare={(c) => void share(c)} />
        {hint && <p className="ag9-sn">{t('Lien copié : collez-le dans le sticker Lien de la story.')}</p>}
        <button
          type="button"
          className="av-c"
          disabled={!times.length}
          onClick={() => {
            void navigator.clipboard?.writeText(message);
            onCopied(t('Message copié'));
          }}
        >
          <I icon={Copy} size={16} /> {t('Copier le message')}
        </button>
      </BottomSheet>
    </>
  );
}
