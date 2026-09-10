/**
 * Espace pro — Fiche client complète : identité (téléphone, e-mail), compteurs (rendez-vous, terminés, annulés,
 * absences, montant dépensé), dernière visite, prochain rendez-vous, notes privées, statut Actif / Bloqué,
 * et l'historique détaillé (date, prestation, heure, statut). Depuis l'historique, un rendez-vous passé encore
 * « Confirmé » se marque Terminé ou Client absent.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, CalendarPlus, ChevronRight, Mail, Phone, ShieldCheck } from 'lucide-react-native';
import {
  pagesItems,
  useProBookingMutations,
  useProClient,
  useProClientHistoryInfinite,
  useProClientMutations,
} from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import { formatDA, formatDZPhone, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import type { ProClientHistoryItem } from '@salondz/types';
import { errorText } from '@/lib/errors';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Grid,
  H1,
  I,
  Input,
  ListCard,
  P,
  Row,
  S,
  SectionLabel,
  Skeleton,
  StatusBadge,
  TopBar,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

function historyStatusLabel(
  h: Pick<ProClientHistoryItem, 'status' | 'cancelledBy'>,
): string | null {
  if (h.status !== 'cancelled') return null;
  if (h.cancelledBy === 'client') return 'Annulé par le client';
  if (h.cancelledBy === 'salon') return 'Annulé par le salon';
  return 'Demande expirée';
}

function Stat({ v, l }: { v: number | string; l: string }) {
  return (
    <View
      style={{
        backgroundColor: C.fill,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
      }}
    >
      <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} numberOfLines={1}>
        {String(v)}
      </Tx>
      <Tx size={10} color={C.muted} lh={13}>
        {l}
      </Tx>
    </View>
  );
}

export default function ClientDetail() {
  const { key = '' } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const client = useProClient(key);
  const history = useProClientHistoryInfinite(key, !!key);
  const historyItems = pagesItems(history.data);
  const { block, unblock, setNotes } = useProClientMutations();
  const { setStatus } = useProBookingMutations();
  const c = client.data ?? null;
  const [notes, setNotesDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (c) setNotesDraft(c.notes ?? '');
  }, [c?.notes, c]);

  if (client.isPending) return <Splash />;
  if (!c)
    return (
      <Screen gap={13}>
        <TopBar backTo="/(pro)/(tabs)/clients" />
        <P>Client introuvable.</P>
      </Screen>
    );
  const ident = { clientId: c.clientId ?? undefined, phone: c.phone ?? undefined };
  const canBlock = !!(c.clientId || c.phone);
  const now = Date.now();
  const toggleBlock = async () => {
    setError(null);
    try {
      if (c.blocked) await unblock.mutateAsync(ident);
      else await block.mutateAsync(ident);
    } catch (err) {
      setError(errorText(err));
    }
  };
  const saveNotes = async () => {
    setError(null);
    try {
      await setNotes.mutateAsync({ key, notes: notes.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={13}>
      <TopBar
        backTo="/(pro)/(tabs)/clients"
        right={
          <Badge tone={c.blocked ? 'cn' : 'ok'}>
            {c.blocked ? 'Client bloqué' : 'Client actif'}
          </Badge>
        }
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar name={c.name} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <H1 size={18} lh={22} ls={-0.5} numberOfLines={1}>
            {c.name}
          </H1>
          {c.phone && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(`tel:${c.phone}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <I icon={Phone} size={12} color={C.muted} />
              <Tx size={12} color={C.muted} lh={16}>
                {formatDZPhone(c.phone)}
              </Tx>
            </Pressable>
          )}
          {c.email && (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(`mailto:${c.email}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <I icon={Mail} size={12} color={C.muted} />
              <Tx size={12} color={C.muted} lh={16} numberOfLines={1}>
                {c.email}
              </Tx>
            </Pressable>
          )}
        </View>
      </View>

      <Grid cols={3} gap={6}>
        <Stat v={c.bookingsCount} l="rendez-vous" />
        <Stat v={c.completedCount} l="terminés" />
        <Stat v={c.cancelledCount} l="annulés" />
        <Stat v={c.noShowCount} l="absences" />
        <Stat v={formatDA(c.spentDa)} l="dépensés" />
        <Stat v={c.lastAt ? formatDateShortDZ(c.lastAt) : '—'} l="dernière visite" />
      </Grid>
      <ListCard>
        <Row
          py={10}
          chevron={false}
          right={
            <Tx size={12} color={C.muted} lh={16}>
              {c.nextAt ? `${formatDateShortDZ(c.nextAt)} · ${formatTimeDZ(c.nextAt)}` : 'Aucun'}
            </Tx>
          }
        >
          <Tx size={12} lh={16}>
            Prochain rendez-vous
          </Tx>
        </Row>
      </ListCard>

      <SectionLabel right={<S>{saved ? 'Enregistré' : 'Jamais visibles du client'}</S>}>
        Notes privées
      </SectionLabel>
      <Input
        multiline
        value={notes}
        onChangeText={setNotesDraft}
        maxLength={2000}
        placeholder="Préférences, allergies, remarques… visibles uniquement par vous."
        accessibilityLabel="Notes privées"
      />
      <Button
        variant="g"
        sm
        onPress={() => void saveNotes()}
        disabled={setNotes.isPending || notes.trim() === (c.notes ?? '')}
        loading={setNotes.isPending}
      >
        Enregistrer les notes
      </Button>

      <Grid cols={2} gap={8}>
        <Button
          disabled={c.blocked}
          onPress={() =>
            router.push({
              pathname: '/pro-rdv/nouveau',
              params: { name: c.name, ...(c.phone ? { phone: c.phone } : {}) },
            } as never)
          }
        >
          <I icon={CalendarPlus} size={14} color="#fff" />
          <Tx size={12} weight={600} color="#fff" lh={16}>
            Rendez-vous
          </Tx>
        </Button>
        {canBlock ? (
          <Button
            variant={c.blocked ? 'g' : 'd'}
            onPress={() => void toggleBlock()}
            disabled={block.isPending || unblock.isPending}
          >
            <I
              icon={c.blocked ? ShieldCheck : Ban}
              size={14}
              color={c.blocked ? C.text : C.danger}
            />
            <Tx size={12} weight={600} lh={16} color={c.blocked ? C.text : C.danger}>
              {c.blocked ? 'Débloquer' : 'Bloquer le client'}
            </Tx>
          </Button>
        ) : (
          <View />
        )}
      </Grid>
      {c.blocked && (
        <Alert>
          Ce client ne peut plus prendre de rendez-vous chez vous. Le blocage ne concerne que votre
          salon.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <SectionLabel>Historique</SectionLabel>
      {history.isPending ? (
        <Skeleton h={130} radius={16} />
      ) : (
        <ListCard>
          {historyItems.map((h, i, arr) => {
            const past = new Date(h.startsAt).getTime() < now;
            const pendingOutcome = h.status === 'confirmed' && past;
            const cancelLabel = historyStatusLabel(h);
            return (
              <View
                key={h.id}
                style={{
                  paddingVertical: 10,
                  gap: 8,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: C.lineSoft,
                }}
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`${h.serviceName} ${formatDateShortDZ(h.startsAt)}`}
                  onPress={() => router.push(`/pro-rdv/${h.id}` as never)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx size={10.5} color={C.muted} lh={14}>
                      {formatDateShortDZ(h.startsAt)}
                    </Tx>
                    <Tx size={13} weight={600} lh={17}>
                      {h.serviceName}
                    </Tx>
                    <Tx size={11.5} color={C.muted} lh={15}>
                      {formatTimeDZ(h.startsAt)} · {formatDA(h.priceDa)}
                      {h.staffName ? ` · ${h.staffName}` : ''}
                    </Tx>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {cancelLabel ? (
                      <Badge tone="cn">{cancelLabel}</Badge>
                    ) : (
                      <StatusBadge status={h.status} />
                    )}
                    <I icon={ChevronRight} size={14} color={C.disabled} />
                  </View>
                </Pressable>
                {pendingOutcome && (
                  <Grid cols={2} gap={8}>
                    <Button
                      sm
                      disabled={setStatus.isPending}
                      onPress={() => setStatus.mutate({ id: h.id, status: 'completed' })}
                    >
                      Terminé
                    </Button>
                    <Button
                      sm
                      variant="g"
                      disabled={setStatus.isPending}
                      onPress={() => setStatus.mutate({ id: h.id, status: 'no_show' })}
                    >
                      Client absent
                    </Button>
                  </Grid>
                )}
              </View>
            );
          })}
          {historyItems.length === 0 && (
            <View style={{ paddingVertical: 10 }}>
              <P>Aucun rendez-vous pour l'instant.</P>
            </View>
          )}
        </ListCard>
      )}
      <LoadMore
        hasMore={history.hasNextPage}
        loading={history.isFetchingNextPage}
        onMore={() => void history.fetchNextPage()}
        label="Voir plus de rendez-vous"
      />
    </Screen>
  );
}
