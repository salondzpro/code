/**
 * Accueil pro — « Fermer/Pause » : un bouton icône dans l'en-tête (entre « Votre journée » et le logo) qui ouvre
 * le choix « jusqu'à la fermeture du jour / 1 h / 2 h / 3 h » et pose un blocage tout salon : plus de réservations
 * en ligne immédiatement. Pendant une fermeture, le bouton passe en rouge (porte ouverte = rouvrir) et une bannière
 * « Fermé jusqu'à … » s'affiche sous les chiffres du jour avec « Rouvrir maintenant ».
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DoorClosed, DoorOpen, Siren } from 'lucide-react-native';
import { useProBlockMutations, useProBlocks } from '@salondz/api-client';
import {
  addDaysToKey,
  dayOfWeekFromKey,
  formatTimeDZ,
  localDateTimeToISO,
  toLocalDateKey,
} from '@salondz/constants';
import type { OpeningHour } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, Button, Card, I, Toast, Tx } from './index';
import { PickerSheet } from './Pickers';
import { C } from '@/theme/design';

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
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}

/** Bouton icône de l'en-tête : « Fermer/Pause » (ou « Rouvrir » quand une fermeture est en cours). */
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
        pill
        variant="g"
        accessibilityLabel={
          active ? `Rouvrir (fermé jusqu'à ${formatTimeDZ(active.endsAt)})` : 'Fermer/Pause'
        }
        disabled={create.isPending || remove.isPending}
        onPress={() => (active ? void reopen() : setChoosing(true))}
        style={[
          { paddingHorizontal: 12, paddingVertical: 9 },
          active ? { backgroundColor: C.danger, borderColor: C.danger } : null,
        ]}
      >
        <I icon={active ? DoorOpen : Siren} size={15} color={active ? '#fff' : C.text} />
        <Tx size={11.5} weight={600} lh={15} color={active ? '#fff' : C.text}>
          {active ? 'Rouvrir' : 'Fermer/Pause'}
        </Tx>
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
  return (
    <Card gap={10} style={{ backgroundColor: C.cancelBg, borderColor: C.dangerLine }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: C.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I icon={DoorClosed} size={14.5} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={13} weight={700} lh={17} color={C.cancelFg}>
            Fermé jusqu'à {formatTimeDZ(active.endsAt)}
          </Tx>
          <Tx size={10.5} lh={14} color={C.cancelFg}>
            Aucune réservation en ligne d'ici là. Vos rendez-vous déjà pris restent en place.
          </Tx>
        </View>
      </View>
      {error && <Alert>{error}</Alert>}
      <Button
        variant="g"
        disabled={remove.isPending}
        loading={remove.isPending}
        onPress={async () => {
          setError(null);
          try {
            await remove.mutateAsync(active.id);
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <I icon={DoorOpen} size={14} />
        <Tx size={12} weight={600} lh={16}>
          Rouvrir maintenant
        </Tx>
      </Button>
    </Card>
  );
}
