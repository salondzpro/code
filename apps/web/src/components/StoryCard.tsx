/**
 * La story se prépare sur l'accueil, sans changer de page : l'aperçu est le vrai fichier, la photo du
 * salon ou une photo du téléphone, et le jour dans une liste. Aujourd'hui par défaut s'il reste des
 * disponibilités, sinon demain. La photo ajoutée reste sur le téléphone.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ImagePlus } from 'lucide-react';
import { addDaysToKey, formatLocale, minutesToTime, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { InstagramGlyph, WhatsAppLogo } from './BrandIcons';
import { I, Skeleton } from './ui';
import { drawStory, shareStory, storyMessage, type StoryChannel } from '@/lib/storyImage';
import { fullStoryDate, hoursOf, rangesOf, useStoryDefaultDay, useStorySlots } from '@/lib/useStorySlots';
import { t } from '@/i18n';

export function StoryCard({ salon, url, short }: { salon: SalonOwnerView; url: string; short: string }) {
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const { date: byDefault, noneToday } = useStoryDefaultDay(salon);
  const date = chosen ?? byDefault;
  const { parts, ready } = useStorySlots(salon, date);
  // Toutes les heures libres par défaut : on retire celles qu'on ne veut pas montrer.
  const hours = hoursOf(parts);
  const [off, setOff] = useState<number[]>([]);
  const times = rangesOf(hours.filter((h) => !off.includes(h.start)));
  const label = (d: string) => (d === today ? t("Aujourd'hui") : d === tomorrow ? t('Demain') : fullStoryDate(d));
  const short2 = (d: string) =>
    d === today || d === tomorrow ? label(d) : new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const pick = (d: string) => {
    setChosen(d);
    setOff([]);
    setMenu(false);
  };

  // La photo : celle du salon, ou celle qu'on vient d'ajouter.
  const salonPhoto = salon.coverUrl ?? salon.photos[0]?.url ?? null;
  const [own, setOwn] = useState<string | null>(null);
  const [useOwn, setUseOwn] = useState(false);
  const photo = useOwn && own ? own : salonPhoto;
  const addPhoto = (file: File | undefined) => {
    if (!file) return;
    if (own) URL.revokeObjectURL(own);
    setOwn(URL.createObjectURL(file));
    setUseOwn(true);
  };

  const [image, setImage] = useState<{ blob: Blob; src: string } | null>(null);
  const shown = useRef<string | null>(null);
  const key = `${date}|${times.join(',')}|${photo}`;
  useEffect(() => {
    if (!times.length) {
      setImage(null);
      return;
    }
    let dead = false;
    void drawStory({
      model: 'photo',
      photo,
      dayLabel: label(date),
      dateLabel: fullStoryDate(date),
      subtitle: t('Disponibilités'),
      times,
      salon: salon.name,
      link: short,
    }).then((blob) => {
      if (dead || !blob) return;
      if (shown.current) URL.revokeObjectURL(shown.current);
      shown.current = URL.createObjectURL(blob);
      setImage({ blob, src: shown.current });
    });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [busy, setBusy] = useState<StoryChannel | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const share = async (channel: StoryChannel) => {
    if (!image || busy) return;
    setBusy(channel);
    if (channel !== 'whatsapp') setNote(t('Lien copié : collez-le dans le sticker Lien de la story.'));
    try {
      await shareStory({ blob: image.blob, name: `salondz-story-${salon.slug}.png`, channel, link: url, message: storyMessage(label(date), times, url) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="ma-story" className="h12-sc" aria-label={t('Créer ma story')}>
      <div className="h12-sl">
        <div className="h12-sp">
          {image ? (
            <img src={image.src} alt={t('Aperçu de la story')} />
          ) : ready && !times.length ? (
            <span>{hours.length ? t('Choisissez au moins une heure.') : t('Plus de créneau libre ce jour-là.')}</span>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
        <div className="h12-st">
          {salonPhoto && (
            <button type="button" aria-label={t('Photo du salon')} aria-pressed={!useOwn} className={useOwn ? '' : 'on'} onClick={() => setUseOwn(false)}>
              <img src={salonPhoto} alt="" />
            </button>
          )}
          <label aria-label={t('Ajouter une photo')} className={useOwn ? 'on' : ''}>
            {own ? <img src={own} alt="" /> : <I icon={ImagePlus} size={20} />}
            <input
              type="file"
              accept="image/*"
              onClick={(e) => {
                // Une photo déjà ajoutée revient d'un toucher ; la touche à nouveau, on la change.
                if (own && !useOwn) {
                  e.preventDefault();
                  setUseOwn(true);
                }
              }}
              onChange={(e) => {
                addPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div className="h12-sr">
        <div className="h12-shd">
          <h2>{t('Ma story')}</h2>
          <div className="h12-sd">
            <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              {short2(date)}
              <I icon={ChevronDown} size={16} />
            </button>
            {menu && (
              <>
                <span className="h12-so" aria-hidden onClick={() => setMenu(false)} />
                <div className="h12-sm" role="menu">
                  {!noneToday && (
                    <button type="button" role="menuitem" className={date === today ? 'on' : ''} onClick={() => pick(today)}>
                      {t("Aujourd'hui")}
                    </button>
                  )}
                  <button type="button" role="menuitem" className={date === tomorrow ? 'on' : ''} onClick={() => pick(tomorrow)}>
                    {t('Demain')}
                  </button>
                  <label className={date !== today && date !== tomorrow ? 'on' : ''}>
                    {t('Autre date')}
                    <input
                      type="date"
                      value={date}
                      min={today}
                      aria-label={t('Autre date')}
                      onChange={(e) => e.target.value && pick(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
        {hours.length > 0 && (
          <div className="h12-hs" role="group" aria-label={t('Heures')}>
            {hours.map((h) => {
              const on = !off.includes(h.start);
              return (
                <button
                  key={h.start}
                  type="button"
                  dir="ltr"
                  aria-pressed={on}
                  className={on ? 'on' : ''}
                  onClick={() => setOff((o) => (on ? [...o, h.start] : o.filter((x) => x !== h.start)))}
                >
                  {minutesToTime(h.start)}
                </button>
              );
            })}
          </div>
        )}
        <div className="h12-sb">
          <button type="button" className="ig" disabled={!image} aria-busy={busy === 'instagram' || undefined} onClick={() => void share('instagram')}>
            {busy === 'instagram' ? <span className="btn-spin" aria-hidden /> : <InstagramGlyph size={20} />}
            {t('Story Instagram')}
          </button>
          <button type="button" disabled={!image} aria-busy={busy === 'whatsapp' || undefined} onClick={() => void share('whatsapp')}>
            {busy === 'whatsapp' ? <span className="btn-spin" aria-hidden /> : <WhatsAppLogo size={20} />}
            {t('Statut WhatsApp')}
          </button>
        </div>
        {note && (
          <p className="h12-sn" role="status">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}
