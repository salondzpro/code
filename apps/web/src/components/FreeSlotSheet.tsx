/**
 * Fenêtre d'un créneau libre ou d'un blocage, ouverte depuis l'agenda (maquette 9).
 *
 * Un trou dans la journée est une occasion : on le partage en story tel quel, on y pose un
 * rendez-vous, ou on le ferme. Un blocage posé par erreur se retire ici aussi, sans passer par les
 * paramètres.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useProBlockMutations } from '@salondz/api-client';
import {
  DAY_LABELS_FR,
  addDaysToKey,
  dayOfWeekFromKey,
  formatLocale,
  localDateTimeToISO,
  minutesToTime,
  toLocalDateKey,
} from '@salondz/constants';
import type { SalonOwnerView } from '@salondz/types';
import { SocialShare, type SocialChannel } from './SocialShare';
import { ErrorMessage } from './ErrorMessage';
import { BottomSheet, Button, Dim } from './ui';
import { formatDuration } from '@/lib/format';
import { drawStory, shareImage } from '@/lib/storyImage';
import { usePublicUrl } from '@/pages/pro/Link';
import { t } from '@/i18n';

export interface FreeSlot {
  date: string;
  /** Début et fin du créneau libre, en minutes depuis minuit. */
  start: number;
  end: number;
  /** Heure sous le doigt, alignée au pas du salon : c'est là que le rendez-vous se pose. */
  at: number;
  staffId: string | null;
  /** Nul pour un indépendant : il n'y a personne d'autre à nommer. */
  staffName: string | null;
}

export interface BlockedSlot {
  id: string;
  label: string;
  start: number;
  end: number;
  staffName: string | null;
}

const range = (start: number, end: number) => `${minutesToTime(start)} – ${minutesToTime(end)}`;

function dayLabel(date: string) {
  const today = toLocalDateKey();
  if (date === today) return t("Aujourd'hui");
  if (date === addDaysToKey(today, 1)) return t('Demain');
  return t(DAY_LABELS_FR[dayOfWeekFromKey(date)]);
}

const longDate = (key: string) => {
  const s = new Intl.DateTimeFormat(formatLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function SheetHead({ chip, title, sub, time }: { chip: string; title: string; sub: string; time?: string }) {
  return (
    <>
      <span className="ag9-sc off">{chip}</span>
      <div className="ag9-sh">
        <div className="min-w-0">
          <span className="ag9-st">{title}</span>
          <span className="ag9-sb">{sub}</span>
        </div>
        {time && (
          <span className="ag9-stm" dir="ltr">
            {time}
          </span>
        )}
      </div>
    </>
  );
}

function WithRow({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <div className="ag9-sr">
      <span className="text-subtle">{t('Avec')}</span>
      <b>{name}</b>
    </div>
  );
}

export function FreeSlotSheet({
  slot,
  salon,
  onClose,
}: {
  slot: FreeSlot;
  salon: SalonOwnerView;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { create } = useProBlockMutations();
  const link = usePublicUrl(salon.slug);
  const [sharing, setSharing] = useState<SocialChannel | null>(null);
  const [saved, setSaved] = useState(false);
  const [hint, setHint] = useState(false);
  const time = range(slot.start, slot.end);

  const share = async (channel: SocialChannel) => {
    setSharing(channel);
    setSaved(false);
    if (channel !== 'whatsapp') {
      void navigator.clipboard?.writeText(link.url).catch(() => undefined);
      setHint(true);
    }
    try {
      const blob = await drawStory({
        photo: salon.coverUrl ?? salon.photos[0]?.url ?? null,
        dayLabel: dayLabel(slot.date),
        dateLabel: longDate(slot.date),
        subtitle: t('créneau libre'),
        times: [time],
        salon: salon.name,
        link: link.short,
      });
      if (!blob) return;
      // Sans feuille de partage (ordinateur), l'image vient d'être téléchargée : on le dit.
      const text = channel === 'whatsapp' ? `${t('Réservez ici')} 👉 ${link.url}` : undefined;
      if (!(await shareImage(blob, `salondz-creneau-${salon.slug}.png`, text))) setSaved(true);
    } finally {
      setSharing(null);
    }
  };

  const block = async () => {
    try {
      await create.mutateAsync({
        staffId: slot.staffId,
        startsAt: localDateTimeToISO(slot.date, minutesToTime(slot.start)),
        endsAt: localDateTimeToISO(slot.date, minutesToTime(slot.end)),
      });
      onClose();
    } catch {
      /* affichée par ErrorMessage ci-dessous */
    }
  };

  const add = () =>
    navigate(
      `/pro/rendez-vous/nouveau?date=${slot.date}&time=${minutesToTime(slot.at)}${slot.staffId ? `&staff=${slot.staffId}` : ''}`,
    );

  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[88vh] overflow-y-auto">
        <SheetHead
          chip={t('Libre')}
          title={minutesToTime(slot.at)}
          sub={t('Créneau libre de {a} à {b}', { a: minutesToTime(slot.start), b: minutesToTime(slot.end) })}
        />
        <WithRow name={slot.staffName} />
        <p className="ag9-sn">
          {t('Partagez-le tel quel : la story affiche ce créneau et votre lien de réservation.')}
        </p>
        <ErrorMessage error={create.error} />
        {saved && <p className="ag9-sn">{t('Image enregistrée')}</p>}
        {hint && <p className="ag9-sn">{t('Lien copié : collez-le dans le sticker Lien de la story.')}</p>}
        <div className="flex flex-col gap-2">
          <Button className="ag9-b" onClick={add}>
            {t('Ajouter un rendez-vous à {h}', { h: minutesToTime(slot.at) })}
          </Button>
          <SocialShare busy={sharing} onShare={(c) => void share(c)} />
          <Button variant="soft" loading={create.isPending} onClick={() => void block()}>
            {t('Bloquer {r}', { r: time })}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function BlockedSlotSheet({ slot, onClose }: { slot: BlockedSlot; onClose: () => void }) {
  const { remove } = useProBlockMutations();
  const free = async () => {
    try {
      await remove.mutateAsync(slot.id);
      onClose();
    } catch {
      /* affichée par ErrorMessage ci-dessous */
    }
  };
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal className="max-h-[88vh] overflow-y-auto">
        <SheetHead
          chip={t('Fermé')}
          title={slot.label}
          sub={formatDuration(slot.end - slot.start)}
          time={range(slot.start, slot.end)}
        />
        <WithRow name={slot.staffName} />
        <ErrorMessage error={remove.error} />
        <Button className="ag9-b" loading={remove.isPending} onClick={() => void free()}>
          {t('Rouvrir ce créneau')}
        </Button>
      </BottomSheet>
    </>
  );
}
