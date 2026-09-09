/**
 * Espace pro — Clients : fiche simple par client (compte, sinon numéro, sinon nom), calculée en base :
 * nombre de rendez-vous, dernier, prochain, annulés, absences, bloqué/actif. ⋮ → Bloquer / Débloquer :
 * le blocage ne vaut que pour ce salon (le client ne peut plus y réserver en ligne).
 */
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ban, CalendarPlus, ChevronRight, MoreVertical, Phone, ShieldCheck } from 'lucide-react-native';
import { useProClientMutations, useProClients, useProSalon } from '@salondz/api-client';
import { formatDZPhone, formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import type { ProClient } from '@salondz/types';
import { errorText } from '@/lib/errors';
import { Alert, Avatar, Badge, Button, Grid, H1, I, IconButton, ListCard, ModalSheet, P, Row, SearchBox, Skeleton, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD, R } from '@/theme/design';

function Stat({ v, l }: { v: number | string; l: string }) {
  return (
    <View style={{ backgroundColor: C.fill, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Tx size={14.5} weight={700} ls={-0.4} lh={18.5}>
        {String(v)}
      </Tx>
      <Tx size={10} color={C.muted} lh={13}>
        {l}
      </Tx>
    </View>
  );
}

function ClientSheet({ c, onClose }: { c: ProClient; onClose: () => void }) {
  const router = useRouter();
  const { block, unblock } = useProClientMutations();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ident = { clientId: c.clientId ?? undefined, phone: c.phone ?? undefined };
  const canBlock = !!(c.clientId || c.phone);
  const toggleBlock = async () => {
    setError(null);
    setMenu(false);
    try {
      if (c.blocked) await unblock.mutateAsync(ident);
      else await block.mutateAsync(ident);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <ModalSheet open onClose={onClose} scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Avatar name={c.name} size={45.5} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14.5} weight={700} ls={-0.4} lh={18.5} numberOfLines={1}>
            {c.name}
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            {c.phone ? formatDZPhone(c.phone) : 'Sans numéro'}
          </Tx>
        </View>
        <Badge tone={c.blocked ? 'cn' : 'ok'} dot={false}>
          {c.blocked ? 'Bloqué' : 'Actif'}
        </Badge>
        {canBlock && (
          <IconButton accessibilityLabel="Actions" onPress={() => setMenu((m) => !m)}>
            <I icon={MoreVertical} size={16} />
          </IconButton>
        )}
      </View>
      {menu && (
        <Pressable accessibilityRole="menuitem" onPress={() => void toggleBlock()} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.cardSm, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-end' }}>
          <I icon={c.blocked ? ShieldCheck : Ban} size={14} color={c.blocked ? C.okFg : C.danger} />
          <Tx size={12} weight={500} lh={16} color={c.blocked ? C.text : C.danger}>
            {c.blocked ? 'Débloquer' : 'Bloquer'}
          </Tx>
        </Pressable>
      )}
      {c.blocked && <Alert>Ce client ne peut plus prendre de rendez-vous chez vous{c.blockedReason ? ` · ${c.blockedReason}` : ''}. Le blocage ne concerne que votre salon.</Alert>}
      <Grid cols={3} gap={6}>
        <Stat v={c.bookingsCount} l="rendez-vous" />
        <Stat v={c.cancelledCount} l="annulés" />
        <Stat v={c.noShowCount} l="absences" />
      </Grid>
      <ListCard>
        <Row py={10} chevron={false} right={<Tx size={12} color={C.muted} lh={16}>{c.lastAt ? `${formatDateShortDZ(c.lastAt)} · ${formatTimeDZ(c.lastAt)}` : '—'}</Tx>}>
          <Tx size={12} lh={16}>
            Dernier rendez-vous
          </Tx>
        </Row>
        <Row py={10} chevron={false} right={<Tx size={12} color={C.muted} lh={16}>{c.nextAt ? `${formatDateShortDZ(c.nextAt)} · ${formatTimeDZ(c.nextAt)}` : 'Aucun'}</Tx>}>
          <Tx size={12} lh={16}>
            Prochain rendez-vous
          </Tx>
        </Row>
        <Row py={10} chevron={false} right={<Tx size={12} color={C.muted} lh={16}>{String(c.completedCount)}</Tx>}>
          <Tx size={12} lh={16}>
            Terminés
          </Tx>
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
      <Grid cols={2} gap={8}>
        {c.phone ? (
          <Button variant="g" onPress={() => void Linking.openURL(`tel:${c.phone}`)}>
            <I icon={Phone} size={14} />
            <Tx size={12} weight={600} lh={16}>
              Appeler
            </Tx>
          </Button>
        ) : (
          <View />
        )}
        <Button disabled={c.blocked} onPress={() => router.push({ pathname: '/pro-rdv/nouveau', params: { name: c.name, ...(c.phone ? { phone: c.phone } : {}) } } as never)}>
          <I icon={CalendarPlus} size={14} color="#fff" />
          <Tx size={12} weight={600} color="#fff" lh={16}>
            Rendez-vous
          </Tx>
        </Button>
      </Grid>
      {c.lastBookingId && (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/pro-rdv/${c.lastBookingId}` as never)} style={{ alignSelf: 'center', paddingVertical: 4 }}>
          <Tx size={11.5} color={C.muted} lh={15} style={{ textDecorationLine: 'underline' }}>
            Voir le dernier rendez-vous
          </Tx>
        </Pressable>
      )}
    </ModalSheet>
  );
}

export default function Clients() {
  const salon = useProSalon().data?.salon ?? null;
  const clients = useProClients();
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = clients.data?.items ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle.replace(/\s/g, ''))) : list;
  }, [clients.data, q]);
  const current = (clients.data?.items ?? []).find((c) => c.clientKey === openKey) ?? null;
  const blockedCount = (clients.data?.items ?? []).filter((c) => c.blocked).length;

  if (!salon) return <Splash />;

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <H1 size={23} lh={26} ls={-0.8}>
        Clients
      </H1>
      <SearchBox value={q} onChange={setQ} placeholder="Nom ou téléphone" />
      <Tx size={10.5} color={C.muted} lh={14.5}>
        {rows.length} client{rows.length > 1 ? 's' : ''}
        {blockedCount ? ` · ${blockedCount} bloqué${blockedCount > 1 ? 's' : ''}` : ''}
      </Tx>
      {clients.isPending ? (
        <Skeleton h={162} radius={16} />
      ) : rows.length === 0 ? (
        <P>Vos clients apparaîtront ici après leur premier rendez-vous.</P>
      ) : (
        <ListCard>
          {rows.map((c) => (
            <Row key={c.clientKey} py={13} onPress={() => setOpenKey(c.clientKey)} accessibilityLabel={c.name} chevron={false} right={<I icon={ChevronRight} size={14.5} color={C.disabled} />}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Avatar name={c.name} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Tx size={13} weight={700} ls={-0.3} lh={17} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {c.name}
                    </Tx>
                    {c.blocked && (
                      <Badge tone="cn" dot={false}>
                        Bloqué
                      </Badge>
                    )}
                  </View>
                  <Tx size={12} color={C.muted} lh={16}>
                    {c.phone ? `${formatDZPhone(c.phone)} · ` : ''}
                    {c.bookingsCount} rendez-vous
                    {c.noShowCount ? ` · ${c.noShowCount} absence${c.noShowCount > 1 ? 's' : ''}` : ''}
                    {c.nextAt ? ` · prochain ${formatDateShortDZ(c.nextAt)}` : c.lastAt ? ` · dernier ${formatDateShortDZ(c.lastAt)}` : ''}
                  </Tx>
                </View>
              </View>
            </Row>
          ))}
        </ListCard>
      )}
      {current && <ClientSheet c={current} onClose={() => setOpenKey(null)} />}
    </Screen>
  );
}
