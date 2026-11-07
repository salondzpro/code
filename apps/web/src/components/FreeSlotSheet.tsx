/**
 * Fenêtre d'un créneau libre ou d'un blocage, ouverte depuis l'agenda (maquette 9).
 *
 * Un trou dans la journée est une occasion : on y pose un rendez-vous (l'action principale, en
 * accent), on le partage en story ou on le ferme (deux tuiles côte à côte). Une barre montre le trou
 * entier et l'heure touchée dedans. Un blocage posé par erreur se retire ici aussi, sans passer par
 * les paramètres.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Lock, LockOpen, Plus, Sparkles, X } from 'lucide-react';
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
import { BottomSheet, Button, Dim, I } from './ui';
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

/** En-tête commun : l'état et la personne sur une ligne, l'essentiel en grand, la croix pour fermer. */
function SheetHead({ kind, title, staffName, onClose }: { kind: 'free' | 'closed'; title: string; staffName: string | null; onClose: () => void }) {
  return (
    <div className="fs-hd">
      <div className="min-w-0">
        <span className={`fs-k ${kind}`}>
          <i aria-hidden />
          {kind === 'free' ? t('Créneau libre') : t('Fermé')}
          {staffName && (
            <>
              {' · '}
              <b dir="auto">{staffName}</b>
            </>
          )}
        </span>
        <span className="fs-t" dir="auto">
          {title}
        </span>
      </div>
      <button type="button" className="rx" aria-label={t('Fermer')} onClick={onClose}>
        <I icon={X} size={18} />
      </button>
    </div>
  );
}

/** Le trou de la journée en une barre : où l'on se place dedans, et combien de temps il reste libre. */
function GapBand({ start, end, at }: { start: number; end: number; at?: number }) {
  const pct = at === undefined ? null : Math.round(((at - start) / Math.max(1, end - start)) * 100);
  return (
    <div className="fs-band">
      <span className="fs-bar" aria-hidden>
        {pct !== null && <i style={{ insetInlineStart: `${Math.min(100, Math.max(0, pct))}%` }} />}
      </span>
      <span className="fs-bl">
        <b dir="ltr">{minutesToTime(start)}</b>
        <span>{t('{d} de libre', { d: formatDuration(end - start) })}</span>
        <b dir="ltr">{minutesToTime(end)}</b>
      </span>
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
        <SheetHead kind="free" title={minutesToTime(slot.at)} staffName={slot.staffName} onClose={onClose} />
        <GapBand start={slot.start} end={slot.end} at={slot.at} />
        <ErrorMessage error={create.error} />
        <Button className="ag9-a" onClick={add}>
          <I icon={Plus} size={18} strokeWidth={2.2} /> {t('Ajouter un rendez-vous à {h}', { h: minutesToTime(slot.at) })}
        </Button>
        <div className="fs-tiles">
          <button type="button" className="fs-tile" onClick={() => setStudio(true)}>
            <span className="fs-ic">
              <I icon={Sparkles} size={18} />
            </span>
            <span className="min-w-0">
              <b>{t('Créer ma story')}</b>
              <small>{t('Montrer ce créneau')}</small>
            </span>
          </button>
          <button type="button" className="fs-tile" disabled={create.isPending} aria-busy={create.isPending} onClick={() => void block()}>
            <span className="fs-ic">
              <I icon={Lock} size={18} />
            </span>
            <span className="min-w-0">
              <b>{t('Bloquer')}</b>
              <small>
                <span dir="ltr">{time}</span>
              </small>
            </span>
          </button>
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
        <SheetHead kind="closed" title={slot.label} staffName={slot.staffName} onClose={onClose} />
        <div className="fs-band">
          <span className="fs-bar closed" aria-hidden />
          <span className="fs-bl">
            <b dir="ltr">{minutesToTime(slot.start)}</b>
            <span>{formatDuration(slot.end - slot.start)}</span>
            <b dir="ltr">{minutesToTime(slot.end)}</b>
          </span>
        </div>
        <ErrorMessage error={remove.error} />
        <Button className="ag9-a" loading={remove.isPending} onClick={() => void free()}>
          <I icon={LockOpen} size={18} /> {t('Rouvrir ce créneau')}
        </Button>
      </BottomSheet>
    </>
  );
}
