/**
 * Partager mes disponibilités : on choisit le jour, on garde les heures voulues, et l'image de la story
 * se dessine sous les yeux. Une image ne peut pas porter de lien cliquable : pour une story, le lien
 * est copié d'office, à coller dans le sticker « Lien » d'Instagram ou de Snapchat.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { useAvailability } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatLocale, formatTimeDZ, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { PickerField } from './Picker';
import { SocialShare, type SocialChannel } from './SocialShare';
import { BottomSheet, Dim, I, Skeleton } from './ui';
import { drawStory, shareImage } from '@/lib/storyImage';
import { t } from '@/i18n';

const MAX_DAYS = 3;
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

  // Les prochains jours d'ouverture : aujourd'hui, demain, ou après-demain si le salon ferme demain.
  const days = useMemo(() => {
    const open = new Set(salon.openingHours.filter((h) => !h.isClosed).map((h) => h.dayOfWeek));
    return Array.from({ length: 14 }, (_, i) => addDaysToKey(today, i))
      .filter((d) => open.has(dayOfWeekFromKey(d)))
      .slice(0, MAX_DAYS);
  }, [salon.openingHours, today]);

  const shortest = [...salon.services.filter((s) => s.isActive)].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const [date, setDate] = useState(days[0] ?? today);
  const chosen = useRef(false);
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

  // Journée déjà pleine ou finie : on passe au jour suivant, sauf si la personne a choisi ce jour-là.
  useEffect(() => {
    if (!av.data || slots.length || chosen.current) return;
    const next = days[days.indexOf(date) + 1];
    if (next) setDate(next);
  }, [av.data, slots.length, date, days]);

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
            <PickerField
              label={t('Jour')}
              title={t('Quel jour ?')}
              value={date}
              onChange={(d: string) => {
                chosen.current = true;
                setDate(d);
              }}
              options={days.map((d) => ({ value: d, label: label(d) }))}
            />
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
