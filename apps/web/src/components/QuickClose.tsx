/**
 * Accueil pro — « Arrêt/Pause » : un bouton icône dans l'en-tête (entre « Votre journée » et le logo) qui ouvre
 * le choix « jusqu'à la fermeture du jour / 1 h / 2 h / 3 h » et pose un blocage tout salon (sans membre) : plus de
 * réservations en ligne immédiatement. Tant qu'il est actif, le bouton passe en rouge (porte ouverte = rouvrir) et
 * une bannière « Fermé jusqu'à … » s'affiche sous les chiffres du jour avec « Rouvrir maintenant ». Le calcul des
 * créneaux (SQL) ignore déjà les blocages : rien d'autre à faire côté client.
 */
import { useEffect, useState } from 'react';
import { PickerSheet } from './Picker';
import { DoorClosed, DoorOpen, Siren } from 'lucide-react';
import { useProBlockMutations, useProBlocks } from '@salondz/api-client';
import {
  addDaysToKey,
  dayOfWeekFromKey,
  formatTimeDZ,
  localDateTimeToISO,
  toLocalDateKey,
} from '@salondz/constants';
import type { OpeningHour } from '@salondz/types';
import { errorText } from './ErrorMessage';
import { Button, I, Toast } from './ui';

const DURATIONS = [1, 2, 3] as const;

/** Blocage « Fermé … » tout salon en cours (posé par ce bouton). */
function useActiveClose() {
  const today = toLocalDateKey();
  const blocks = useProBlocks(today, addDaysToKey(today, 1));
  const now = Date.now();
  return (blocks.data?.items ?? []).find(
    (t) =>
      !t.staffId &&
      new Date(t.startsAt).getTime() <= now &&
      new Date(t.endsAt).getTime() > now &&
      (t.reason ?? '').startsWith('Fermé'),
  );
}

/** Erreur passagère (toast) : l'action est dans l'en-tête, il n'y a pas de place pour un texte. */
function useFlash(): [string | null, (m: string | null) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

/** Bouton icône de l'en-tête : « Arrêt/Pause » (ou « Rouvrir » quand une fermeture est en cours). */
export function QuickCloseButton({ openingHours }: { openingHours: OpeningHour[] }) {
  const today = toLocalDateKey();
  const active = useActiveClose();
  const { create, remove } = useProBlockMutations();
  const [error, setError] = useFlash();
  const [choosing, setChoosing] = useState(false);
  const now = Date.now();
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

  return (
    <>
      <Button
        auto
        sm
        variant="g"
        aria-label={
          active ? `Rouvrir (fermé jusqu'à ${formatTimeDZ(active.endsAt)})` : 'Arrêt/Pause'
        }
        title={active ? 'Rouvrir maintenant' : 'Arrêt/Pause'}
        className={`!rounded-full !px-3.5 !py-2.5 !text-[0.875rem] ${active ? '!border-danger !bg-danger !text-white' : ''}`}
        disabled={create.isPending || remove.isPending}
        onClick={() => (active ? void reopen() : setChoosing(true))}
        data-testid="quick-close"
      >
        <I icon={active ? DoorOpen : Siren} size={17} /> {active ? 'Rouvrir' : 'Arrêt/Pause'}
      </Button>
      {error && <Toast>{error}</Toast>}
      <PickerSheet
        open={choosing}
        onClose={() => setChoosing(false)}
        title="Fermer jusqu'à quand ?"
        value={null}
        onChange={(v) => {
          setChoosing(false);
          if (v === 'day' && untilClose) void closeFor(untilClose, `Fermé · jusqu'à ${closesAt}`);
          else if (v !== 'day')
            void closeFor(new Date(now + Number(v) * 3_600_000).toISOString(), `Fermé · ${v} h`);
        }}
        options={[
          ...(canCloseDay
            ? [
                {
                  value: 'day',
                  label: `Jusqu'à la fermeture (${closesAt})`,
                  hint: "Plus aucune réservation aujourd'hui",
                },
              ]
            : []),
          ...DURATIONS.map((h) => ({
            value: String(h),
            label: `Pendant ${h} h`,
            hint: `Réouverture à ${formatTimeDZ(new Date(now + h * 3_600_000))}`,
          })),
        ]}
      />
    </>
  );
}

/** Bannière « Fermé jusqu'à … » + « Rouvrir maintenant », visible seulement pendant une fermeture. */
export function QuickCloseBanner() {
  const active = useActiveClose();
  const { remove } = useProBlockMutations();
  const [error, setError] = useState<string | null>(null);
  if (!active) return null;
  const reopen = async () => {
    setError(null);
    try {
      await remove.mutateAsync(active.id);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <div className="crd !gap-3 !border-danger-line !bg-cancel-bg">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-danger text-white">
          <I icon={DoorClosed} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-bold text-cancel-fg">
            Fermé jusqu'à {formatTimeDZ(active.endsAt)}
          </span>
          <span className="block text-[0.8125rem] text-cancel-fg/80">
            Aucune réservation en ligne d'ici là. Vos rendez-vous déjà pris restent en place.
          </span>
        </span>
      </div>
      {error && <p className="text-[0.875rem] text-danger">{error}</p>}
      <Button variant="g" onClick={() => void reopen()} disabled={remove.isPending}>
        <I icon={DoorOpen} size={18} /> Rouvrir maintenant
      </Button>
    </div>
  );
}
