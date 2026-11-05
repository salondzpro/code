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
import { StoryStudio } from './StoryStudio';
import { ErrorMessage } from './ErrorMessage';
import { BottomSheet, Button, Dim } from './ui';
import { formatDuration } from '@/lib/format';
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
  const [studio, setStudio] = useState(false);
  const time = range(slot.start, slot.end);

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
        <ErrorMessage error={create.error} />
        <div className="flex flex-col gap-2">
          <Button className="ag9-b" onClick={add}>
            {t('Ajouter un rendez-vous à {h}', { h: minutesToTime(slot.at) })}
          </Button>
          <Button variant="soft" onClick={() => setStudio(true)}>
            {t('Créer ma story')}
          </Button>
          <Button variant="soft" loading={create.isPending} onClick={() => void block()}>
            {t('Bloquer {r}', { r: time })}
          </Button>
        </div>
      </BottomSheet>
      {studio && (
        <StoryStudio
          salon={salon}
          url={link.url}
          short={link.short}
          date={slot.date}
          from={slot.start}
          to={slot.end}
          onClose={() => setStudio(false)}
        />
      )}
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
