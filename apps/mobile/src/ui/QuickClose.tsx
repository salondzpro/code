/**
 * Accueil pro — « Fermer maintenant » : un blocage tout salon qui suspend les réservations en ligne immédiatement,
 * jusqu'à la fermeture du jour ou pendant 1 h / 2 h / 3 h. Tant qu'il est actif : « Fermé jusqu'à … » + « Rouvrir ».
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { DoorClosed, DoorOpen } from 'lucide-react-native';
import { useProBlockMutations, useProBlocks } from '@salondz/api-client';
import { addDaysToKey, dayOfWeekFromKey, formatTimeDZ, localDateTimeToISO, toLocalDateKey } from '@salondz/constants';
import type { OpeningHour } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, Button, Card, I, Tx } from './index';
import { C } from '@/theme/design';

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

  if (active) {
    return (
      <Card gap={10} style={{ backgroundColor: C.cancelBg, borderColor: C.dangerLine }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }}>
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

  return (
    <Card gap={10}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Tx size={13} weight={600} lh={17}>
          Fermer maintenant
        </Tx>
        <Tx size={10.5} color={C.muted} lh={14}>
          Plus de réservations en ligne
        </Tx>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {canCloseDay && (
          <Button sm pill disabled={create.isPending} onPress={() => void closeFor(untilClose!, `Fermé · jusqu'à ${closesAt}`)} style={{ paddingHorizontal: 13, paddingVertical: 9 }}>
            <I icon={DoorClosed} size={13} color="#fff" />
            <Tx size={11.5} weight={600} color="#fff" lh={15}>
              Jusqu'à la fermeture ({closesAt})
            </Tx>
          </Button>
        )}
        {DURATIONS.map((h) => (
          <Button key={h} sm pill variant="g" disabled={create.isPending} onPress={() => void closeFor(new Date(now + h * 3_600_000).toISOString(), `Fermé · ${h} h`)} style={{ paddingHorizontal: 13, paddingVertical: 9 }}>
            <Tx size={11.5} weight={600} lh={15}>
              {h} h
            </Tx>
          </Button>
        ))}
      </View>
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}
