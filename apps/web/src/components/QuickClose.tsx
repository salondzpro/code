/**
 * Accueil pro — « Fermer maintenant » : un blocage tout salon (sans membre) qui suspend les réservations en ligne
 * immédiatement, jusqu'à la fermeture du jour ou pendant 1 h / 2 h / 3 h. Tant qu'il est actif, la carte affiche
 * « Fermé jusqu'à … » et un bouton « Rouvrir » qui supprime le blocage. Le calcul des créneaux (SQL) ignore
 * déjà les blocages : rien d'autre à faire côté client.
 */
import { useState } from 'react';
import { DoorClosed, DoorOpen } from 'lucide-react';
import { useProBlockMutations, useProBlocks } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatTimeDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import type { OpeningHour } from '@salondz/types';
import { errorText } from './ErrorMessage';
import { Button, I } from './ui';

const DURATIONS = [1, 2, 3] as const;

export function QuickClose({ openingHours }: { openingHours: OpeningHour[] }) {
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, 1));
  const { create, remove } = useProBlockMutations();
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const active = (blocks.data?.items ?? []).find((t) => !t.staffId && new Date(t.startsAt).getTime() <= now && new Date(t.endsAt).getTime() > now && (t.reason ?? '').startsWith('Fermé'));
  const closesAt = openingHours
    .filter((h) => h.dayOfWeek === dayOfWeekFromKey(today) && !h.isClosed)
    .map((h) => h.closesAt)
    .sort()
    .pop();
  const untilClose = closesAt ? localDateTimeToISO(today, closesAt) : null;
  const canCloseDay = !!untilClose && new Date(untilClose).getTime() > now + 60_000;

  const closeFor = async (endsAt: string, reason: string) => {
    setError(null);
    try {
      await create.mutateAsync({ startsAt: new Date(now).toISOString(), endsAt, reason });
    } catch (err) {
      setError(errorText(err));
    }
  };
  const reopen = async () => {
    if (!active) return;
    setError(null);
    try {
      await remove.mutateAsync(active.id);
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (active) {
    return (
      <div className="crd !gap-3 !border-danger-line !bg-cancel-bg">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-danger text-white">
            <I icon={DoorClosed} size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1rem] font-bold text-cancel-fg">Fermé jusqu'à {formatTimeDZ(active.endsAt)}</span>
            <span className="block text-[0.8125rem] text-cancel-fg/80">Aucune réservation en ligne d'ici là. Vos rendez-vous déjà pris restent en place.</span>
          </span>
        </div>
        {error && <p className="text-[0.875rem] text-danger">{error}</p>}
        <Button variant="g" onClick={() => void reopen()} disabled={remove.isPending}>
          <I icon={DoorOpen} size={18} /> Rouvrir maintenant
        </Button>
      </div>
    );
  }

  return (
    <div className="crd !gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[1rem] font-semibold">Fermer maintenant</span>
        <span className="text-[0.8125rem] text-muted">Plus de réservations en ligne</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {canCloseDay && (
          <Button auto sm onClick={() => void closeFor(untilClose!, `Fermé · jusqu'à ${closesAt}`)} disabled={create.isPending}>
            <I icon={DoorClosed} size={16} /> Jusqu'à la fermeture ({closesAt})
          </Button>
        )}
        {DURATIONS.map((h) => (
          <Button key={h} auto sm variant="g" onClick={() => void closeFor(new Date(now + h * 3_600_000).toISOString(), `Fermé · ${h} h`)} disabled={create.isPending}>
            {h} h
          </Button>
        ))}
      </div>
      {error && <p className="text-[0.875rem] text-danger">{error}</p>}
    </div>
  );
}
