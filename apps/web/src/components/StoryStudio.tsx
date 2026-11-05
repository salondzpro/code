/**
 * Studio de story : plein écran, sombre comme l'éditeur d'Instagram. La story est au centre, en grand,
 * et chaque modèle est le vrai fichier : on les fait glisser au doigt, on choisit le jour, on retire une
 * plage, l'image suit. Toutes les disponibilités y figurent, en plages « de telle heure à telle heure »,
 * pour que le client comprenne d'un coup d'œil. Une image ne peut pas porter de lien cliquable : pour une
 * story, le lien est copié d'office, à coller dans le sticker « Lien » d'Instagram ou de Snapchat.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, X } from 'lucide-react';
import { useAvailability } from '@salondz/api-client';
import { addDaysToKey, formatLocale, formatTimeDZ, minutesToTime, timeToMinutes, toLocalDateKey } from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { InstagramGlyph, SnapchatGhost, WhatsAppGlyph } from './BrandIcons';
import { I } from './ui';
import { drawStory, saveImage, shareImage, shareToInstagram, type StoryModel } from '@/lib/storyImage';
import { t } from '@/i18n';

type Channel = 'instagram' | 'snapchat' | 'whatsapp';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fullDate = (key: string) =>
  capitalize(
    new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`)),
  );

export function StoryStudio({
  salon,
  url,
  short,
  date: startDate,
  from,
  to,
  onClose,
}: {
  salon: SalonOwnerView;
  url: string;
  short: string;
  /** Depuis un créneau libre de l'agenda : ce jour, et les heures de ce créneau (en minutes). */
  date?: string;
  from?: number;
  to?: number;
  onClose: () => void;
}) {
  const today = toLocalDateKey();
  const tomorrow = addDaysToKey(today, 1);
  const label = (d: string) => (d === today ? t("Aujourd'hui") : d === tomorrow ? t('Demain') : fullDate(d));
  const photo = salon.coverUrl ?? salon.photos[0]?.url ?? null;
  const models = useMemo<{ id: StoryModel; name: string }[]>(
    () => [
      ...(photo ? [{ id: 'photo' as const, name: t('Photo') }] : []),
      { id: 'violet', name: t('Violet') },
      { id: 'clair', name: t('Clair') },
    ],
    [photo],
  );

  const shortest = [...salon.services.filter((s) => s.isActive)].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const [date, setDate] = useState(startDate ?? today);
  const [other, setOther] = useState(!!startDate && startDate !== today && startDate !== tomorrow);
  const [range, setRange] = useState(from !== undefined);
  const av = useAvailability(salon.id, { serviceId: shortest?.id ?? '', date });

  // Les créneaux qui se suivent forment une plage : « 09:00 – 12:30 ». La fin est celle de la dernière
  // prestation possible, donc l'heure où le pro redevient pris ou ferme.
  const slots = useMemo(() => {
    const step = av.data?.slotIntervalMinutes || 15;
    const duration = av.data?.durationMinutes || step;
    const groups: { start: number; last: number }[] = [];
    for (const s of av.data?.slots ?? []) {
      if (new Date(s.startsAt).getTime() <= Date.now()) continue;
      const m = timeToMinutes(formatTimeDZ(s.startsAt));
      if (range && from !== undefined && to !== undefined && (m < from || m >= to)) continue;
      const g = groups[groups.length - 1];
      if (g && m - g.last <= step) g.last = m;
      else groups.push({ start: m, last: m });
    }
    // Depuis un créneau de l'agenda, la plage ne déborde pas de ce créneau.
    const end = (g: { last: number }) => (range && to !== undefined ? Math.min(g.last + duration, to) : g.last + duration);
    return groups.map((g) => `${minutesToTime(g.start)} – ${minutesToTime(end(g))}`);
  }, [av.data, range, from, to]);

  const [off, setOff] = useState<string[]>([]);
  const pick = (d: string, isOther = false) => {
    setRange(false);
    setOff([]);
    setOther(isOther);
    setDate(d);
  };
  const times = slots.filter((x) => !off.includes(x));

  // Toutes les images d'avance : glisser d'un modèle à l'autre est immédiat, et le partage aussi.
  const [images, setImages] = useState<Partial<Record<StoryModel, { blob: Blob; src: string }>>>({});
  const key = `${date}|${times.join(',')}`;
  useEffect(() => {
    if (!times.length) return setImages({});
    let dead = false;
    const timer = window.setTimeout(() => {
      for (const m of models)
        void drawStory({
          model: m.id,
          photo,
          dayLabel: label(date),
          dateLabel: fullDate(date),
          subtitle: t('Disponibilités'),
          times,
          salon: salon.name,
          link: short,
        }).then((blob) => {
          if (dead || !blob) return;
          const src = URL.createObjectURL(blob);
          setImages((old) => {
            const prev = old[m.id];
            if (prev) URL.revokeObjectURL(prev.src);
            return { ...old, [m.id]: { blob, src } };
          });
        });
    }, 120);
    return () => {
      dead = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Le modèle affiché = celui qui est au centre de la rangée.
  const row = useRef<HTMLDivElement | null>(null);
  const [model, setModel] = useState<StoryModel>(models[0]!.id);
  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const mid = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = model;
    let gap = Infinity;
    for (const c of Array.from(el.children) as HTMLElement[]) {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < gap) {
        gap = d;
        best = c.dataset.model as StoryModel;
      }
    }
    if (best !== model) setModel(best);
  };
  const goTo = (m: StoryModel) => {
    row.current?.querySelector(`[data-model="${m}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };

  // Plein écran : la page ne défile plus derrière, Échap referme, la barre d'état passe en sombre.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.getPropertyValue('--bar-top-bg');
    const overflow = document.body.style.overflow;
    root.style.setProperty('--bar-top-bg', '#14121f');
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      if (before) root.style.setProperty('--bar-top-bg', before);
      else root.style.removeProperty('--bar-top-bg');
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const [busy, setBusy] = useState<Channel | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const image = images[model];
  const message = `${t('Salam 😊 Mes disponibilités {day} : {times}. Réservez ici 👉', { day: label(date).toLowerCase(), times: times.join(', ') })} ${url}`;
  const file = `salondz-story-${salon.slug}.png`;

  const share = async (channel: Channel) => {
    if (!image || busy) return;
    setBusy(channel);
    const story = channel !== 'whatsapp';
    if (story) {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
      setNote(t('Lien copié : collez-le dans le sticker Lien de la story.'));
    }
    try {
      if (channel === 'instagram') await shareToInstagram(image.blob, file);
      else await shareImage(image.blob, file, story ? undefined : message);
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div className="st" role="dialog" aria-modal="true" aria-label={t('Créer ma story')}>
      <header className="st-h">
        <button type="button" className="st-x" aria-label={t('Fermer')} onClick={onClose}>
          <I icon={X} size={20} />
        </button>
        <span>{t('Créer ma story')}</span>
      </header>

      <div className="st-row" ref={row} onScroll={onScroll}>
        {models.map((m) => (
          <button key={m.id} type="button" data-model={m.id} className={`st-s${m.id === model ? ' on' : ''}`} aria-label={m.name} onClick={() => goTo(m.id)}>
            {images[m.id] ? <img src={images[m.id]!.src} alt={t('Aperçu de la story')} /> : <span className="st-e">{times.length ? '' : t('Plus de créneau libre ce jour-là.')}</span>}
          </button>
        ))}
      </div>

      <div className="st-m" role="group" aria-label={t('Modèle')}>
        {models.map((m) => (
          <button key={m.id} type="button" aria-pressed={m.id === model} className={m.id === model ? 'on' : ''} onClick={() => goTo(m.id)}>
            {m.name}
          </button>
        ))}
      </div>

      <div className="st-p">
        <div className="st-d" role="group" aria-label={t('Jour')}>
          <button type="button" className={!other && date === today ? 'on' : ''} onClick={() => pick(today)}>
            {t("Aujourd'hui")}
          </button>
          <button type="button" className={!other && date === tomorrow ? 'on' : ''} onClick={() => pick(tomorrow)}>
            {t('Demain')}
          </button>
          <label className={other ? 'on' : ''}>
            {other ? new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : t('Autre date')}
            <input
              type="date"
              value={date}
              min={today}
              aria-label={t('Autre date')}
              onChange={(e) => e.target.value && pick(e.target.value, true)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </label>
        </div>

        {slots.length > 0 && (
          <div className="st-t" role="group" aria-label={t('Heures')}>
            {slots.map((x) => {
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
        )}

        <button type="button" className="st-go" disabled={!image} aria-busy={busy === 'instagram' || undefined} onClick={() => void share('instagram')}>
          {busy === 'instagram' ? <span className="btn-spin" aria-hidden /> : <InstagramGlyph size={22} />}
          {t('Partager sur Instagram')}
        </button>

        <div className="st-o">
          <button type="button" disabled={!image} aria-busy={busy === 'snapchat' || undefined} onClick={() => void share('snapchat')}>
            <i className="snap">{busy === 'snapchat' ? <span className="btn-spin" aria-hidden /> : <SnapchatGhost size={22} />}</i>
            Snapchat
          </button>
          <button type="button" disabled={!image} aria-busy={busy === 'whatsapp' || undefined} onClick={() => void share('whatsapp')}>
            <i className="wa">{busy === 'whatsapp' ? <span className="btn-spin" aria-hidden /> : <WhatsAppGlyph size={22} />}</i>
            {t('Statut')}
          </button>
          <button
            type="button"
            disabled={!times.length}
            onClick={() => {
              void navigator.clipboard?.writeText(message);
              setNote(t('Message copié'));
            }}
          >
            <i>
              <I icon={Copy} size={20} />
            </i>
            {t('Message')}
          </button>
          <button
            type="button"
            disabled={!image}
            onClick={() => {
              if (image) void saveImage(image.blob, file).then(() => setNote(t('Image enregistrée')));
            }}
          >
            <i>
              <I icon={Download} size={20} />
            </i>
            {t('Enregistrer')}
          </button>
        </div>
        {note && (
          <p className="st-n" role="status">
            {note}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
