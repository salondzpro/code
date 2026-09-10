/**
 * Espace pro — Fiche client, pensée pour le quotidien : le nom et le téléphone en grand avec Appeler / WhatsApp,
 * le prochain rendez-vous en avant (« dans 2 h », heure), trois chiffres qui comptent (visites, dépensé, dernière
 * visite) et les signaux d'alerte (annulations, absences), les notes privées, puis l'historique (pavé date,
 * prestation, heure · prix · membre, statut). Un rendez-vous passé encore « Confirmé » se règle sur place :
 * Terminé ou Client absent. Une icône sur chaque action.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Ban,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
  StickyNote,
  UserX,
} from 'lucide-react-native';
import {
  pagesItems,
  useProBookingMutations,
  useProClient,
  useProClientHistoryInfinite,
  useProClientMutations,
} from '@salondz/api-client';
import { LoadMore } from '@/ui/LoadMore';
import {
  formatDA,
  formatDZPhone,
  formatDateShortDZ,
  formatTimeDZ,
  relativeDayLabelDZ,
  toLocalDateKey,
  untilLabelFR,
} from '@salondz/constants';
import type { ProClientHistoryItem } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { open } from '@/lib/salon';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Grid,
  H1,
  I,
  Input,
  ListCard,
  P,
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

const DZ = 'Africa/Algiers';
const dayNum = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { day: 'numeric', timeZone: DZ }).format(new Date(iso));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('fr-DZ', { month: 'short', timeZone: DZ })
    .format(new Date(iso))
    .replace('.', '');

/** Pavé date de l'historique : jour en grand, mois. */
function DateBlock({ iso, muted }: { iso: string; muted?: boolean }) {
  return (
    <View
      style={{
        width: 42,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: C.fill,
        paddingVertical: 6,
      }}
    >
      <Tx size={18} weight={700} ls={-0.5} lh={21} color={muted ? C.muted : C.text}>
        {dayNum(iso)}
      </Tx>
      <Tx size={10} lh={13} color={C.muted}>
        {monthShort(iso)}
      </Tx>
    </View>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <View
      style={{
        backgroundColor: C.fill,
        borderRadius: 11,
        paddingHorizontal: 10,
        paddingVertical: 10,
      }}
    >
      <Tx size={17} weight={700} ls={-0.5} lh={21} numberOfLines={1}>
        {v}
      </Tx>
      <Tx size={10.5} color={C.muted} lh={14}>
        {l}
      </Tx>
    </View>
  );
}

function Label({ children, color = C.text }: { children: string; color?: string }) {
  return (
    <Tx size={12} weight={600} lh={16} color={color}>
      {children}
    </Tx>
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
  const newBooking = () =>
    router.push({
      pathname: '/pro-rdv/nouveau',
      params: { name: c.name, ...(c.phone ? { phone: c.phone } : {}) },
    } as never);
  const nextKey = c.nextAt ? toLocalDateKey(new Date(c.nextAt)) : null;
  const warn = c.cancelledCount + c.noShowCount > 0;

  return (
    <Screen gap={13}>
      <TopBar
        backTo="/(pro)/(tabs)/clients"
        right={
          <Badge tone={c.blocked ? 'cn' : 'ok'} md>
            {c.blocked ? 'Client bloqué' : 'Client actif'}
          </Badge>
        }
      />

      {/* Identité en grand + contact direct */}
      <Card gap={13}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <Avatar name={c.name} size={58} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <H1 size={19.5} lh={23} ls={-0.6} numberOfLines={1}>
              {c.name}
            </H1>
            {c.phone ? (
              <Pressable accessibilityRole="link" onPress={() => void open(`tel:${c.phone}`)}>
                <Tx size={14.5} weight={600} lh={19} mono>
                  {formatDZPhone(c.phone)}
                </Tx>
              </Pressable>
            ) : (
              <P>Sans numéro de téléphone</P>
            )}
            {!!c.email && (
              <Pressable
                accessibilityRole="link"
                onPress={() => void open(`mailto:${c.email}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <I icon={Mail} size={12} color={C.muted} />
                <Tx size={11.5} color={C.muted} lh={15} numberOfLines={1} style={{ flex: 1 }}>
                  {c.email}
                </Tx>
              </Pressable>
            )}
          </View>
        </View>
        {!!c.phone && (
          <Grid cols={2} gap={8}>
            <Button variant="g" sm onPress={() => void open(`tel:${c.phone}`)}>
              <I icon={Phone} size={14} />
              <Label>Appeler</Label>
            </Button>
            <Button
              variant="g"
              sm
              onPress={() => void open(`https://wa.me/${c.phone!.replace(/\D/g, '')}`)}
            >
              <I icon={MessageCircle} size={14} />
              <Label>WhatsApp</Label>
            </Button>
          </Grid>
        )}
      </Card>

      {/* Prochain rendez-vous en avant */}
      {c.nextAt && nextKey ? (
        <Card
          gap={4}
          style={{ borderColor: C.ink }}
          onPress={() => c.lastBookingId && router.push(`/pro-rdv/${c.lastBookingId}` as never)}
          accessibilityLabel="Prochain rendez-vous"
        >
          <Tx size={10} weight={700} upper ls={0.8} lh={14} color={C.muted}>
            Prochain rendez-vous · {untilLabelFR(c.nextAt, now)}
          </Tx>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Tx size={26} weight={700} ls={-0.9} lh={29} mono>
              {formatTimeDZ(c.nextAt)}
            </Tx>
            <Tx size={14.5} weight={700} lh={19}>
              {relativeDayLabelDZ(nextKey)}
            </Tx>
          </View>
        </Card>
      ) : (
        <Card
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <I icon={CalendarClock} size={14} color={C.muted} />
            <Tx size={12} color={C.muted} lh={16}>
              Aucun rendez-vous prévu
            </Tx>
          </View>
          <Button auto sm onPress={newBooking} disabled={c.blocked}>
            <I icon={CalendarPlus} size={14} color={C.onInk} />
            <Label color={C.onInk}>Ajouter</Label>
          </Button>
        </Card>
      )}

      {/* Trois chiffres qui comptent, puis les signaux d'alerte */}
      <Grid cols={3} gap={6}>
        <Stat v={String(c.completedCount)} l={c.completedCount > 1 ? 'visites' : 'visite'} />
        <Stat v={formatDA(c.spentDa)} l="dépensés" />
        <Stat v={c.lastAt ? formatDateShortDZ(c.lastAt) : '—'} l="dernière visite" />
      </Grid>
      <Tx size={12} lh={16} color={warn ? C.danger : C.muted} style={{ marginTop: -6 }}>
        {c.bookingsCount} rendez-vous au total · {c.cancelledCount} annulé
        {c.cancelledCount > 1 ? 's' : ''} · {c.noShowCount} absence{c.noShowCount > 1 ? 's' : ''}
      </Tx>

      {/* Notes privées */}
      <Card gap={10}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <I icon={StickyNote} size={15} />
          <Tx size={13} weight={700} lh={17}>
            Notes privées
          </Tx>
        </View>
        <Input
          multiline
          value={notes}
          onChangeText={setNotesDraft}
          maxLength={2000}
          placeholder="Préférences, allergies, remarques… visibles uniquement par vous."
          accessibilityLabel="Notes privées"
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Tx size={10.5} color={C.muted} lh={14} style={{ flex: 1 }}>
            {saved ? 'Enregistré' : 'Jamais visibles du client'}
          </Tx>
          <Button
            auto
            sm
            onPress={() => void saveNotes()}
            disabled={setNotes.isPending || notes.trim() === (c.notes ?? '')}
            loading={setNotes.isPending}
          >
            <I icon={Save} size={14} color={C.onInk} />
            <Label color={C.onInk}>Enregistrer</Label>
          </Button>
        </View>
      </Card>

      {/* Actions */}
      <Grid cols={2} gap={8}>
        <Button disabled={c.blocked} onPress={newBooking}>
          <I icon={CalendarPlus} size={14} color="#fff" />
          <Label color="#fff">Rendez-vous</Label>
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
            <Label color={c.blocked ? C.text : C.danger}>
              {c.blocked ? 'Débloquer' : 'Bloquer'}
            </Label>
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

      {/* Historique */}
      <SectionLabel>Historique</SectionLabel>
      {history.isPending ? (
        <Skeleton h={130} radius={16} />
      ) : (
        <ListCard>
          {historyItems.map((h, i, arr) => {
            const past = new Date(h.startsAt).getTime() < now;
            const pendingOutcome = h.status === 'confirmed' && past;
            const cancelLabel = historyStatusLabel(h);
            const cancelled = h.status === 'cancelled';
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
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <DateBlock iso={h.startsAt} muted={cancelled} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Tx
                      size={13.5}
                      weight={700}
                      ls={-0.3}
                      lh={17.5}
                      numberOfLines={1}
                      color={cancelled ? C.muted : C.text}
                    >
                      {h.serviceName}
                    </Tx>
                    <Tx size={12} color={C.muted} lh={16}>
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
                      <I icon={Check} size={14} color="#fff" />
                      <Label color="#fff">Terminé</Label>
                    </Button>
                    <Button
                      sm
                      variant="g"
                      disabled={setStatus.isPending}
                      onPress={() => setStatus.mutate({ id: h.id, status: 'no_show' })}
                    >
                      <I icon={UserX} size={14} />
                      <Label>Client absent</Label>
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
