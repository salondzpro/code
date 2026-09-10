/**
 * C-F 08 / C-H 10 — Prestations cumulées : formule(s) et prestations à la carte cochables,
 * feuille de synthèse (durées, total, « Choisir un créneau »).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSalon } from '@salondz/api-client';
import { formatDA, groupServices, localDateTimeToISO } from '@salondz/constants';
import type { Service } from '@salondz/types';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { formatDuration, shortDuration } from '@/lib/format';
import {
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ErrorText,
  H1,
  Img,
  ListCard,
  P,
  Pill,
  SectionLabel,
  TopBar,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

export default function BookingServices() {
  const {
    slug = '',
    services: fromUrl = '',
    date: fromDate,
    time: fromTime,
  } = useLocalSearchParams<{ slug: string; services?: string; date?: string; time?: string }>();
  const router = useRouter();
  const salon = useSalon(slug);
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = fromUrl.split(',').filter(Boolean);
    return ids.length ? ids : readDraft(slug).serviceIds;
  });

  useEffect(() => {
    writeDraft(slug, { serviceIds: selected });
  }, [slug, selected]);

  // Créneau proposé sur la carte marketplace (date + heure) : pré-rempli, l'écran « Quand » s'ouvre dessus.
  useEffect(() => {
    if (
      fromDate &&
      fromTime &&
      /^\d{4}-\d{2}-\d{2}$/.test(fromDate) &&
      /^\d{2}:\d{2}$/.test(fromTime)
    ) {
      writeDraft(slug, { date: fromDate, startsAt: localDateTimeToISO(fromDate, fromTime) });
    }
  }, [slug, fromDate, fromTime]);

  const s = salon.data;
  const chosen = useMemo(
    () =>
      s
        ? selected.map((id) => s.services.find((x) => x.id === id)).filter((x): x is Service => !!x)
        : [],
    [s, selected],
  );
  const total = chosen.reduce((a, x) => a + x.priceDa, 0);
  const minutes = chosen.reduce((a, x) => a + x.durationMinutes, 0);

  if (salon.isPending) return <Splash />;
  if (salon.isError || !s)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );

  const groups = groupServices(s.services);
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const ServiceRow = ({ sv, boxed }: { sv: Service; boxed?: boolean }) => {
    const on = selected.includes(sv.id);
    const photo = sv.photos?.[0]?.url ?? s.coverUrl;
    const inner = (
      <>
        <Img src={photo} radius={13} style={{ width: 72, height: 72 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14} weight={700} ls={-0.3} lh={18}>
            {sv.name}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {[
              formatDuration(sv.durationMinutes),
              boxed ? sv.description : null,
              formatDA(sv.priceDa),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Tx>
        </View>
        <Checkbox on={on} label={sv.name} />
      </>
    );
    if (boxed)
      return (
        <Card row gap={13} onPress={() => toggle(sv.id)} accessibilityLabel={sv.name}>
          {inner}
        </Card>
      );
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={sv.name}
        onPress={() => toggle(sv.id)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          paddingVertical: 13,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {inner}
      </Pressable>
    );
  };

  return (
    <Screen
      gap={11}
      footer={
        <BottomSheet>
          {chosen.length > 0 ? (
            <>
              <P>
                {chosen.map((x) => `${x.name} ${shortDuration(x.durationMinutes)}`).join(' + ')}
              </P>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Tx size={19.5} weight={700} ls={-0.6} lh={23.5}>
                    {formatDA(total)}
                  </Tx>
                  <P>
                    {chosen.length} prestation{chosen.length > 1 ? 's' : ''} ·{' '}
                    {formatDuration(minutes)} au total
                  </P>
                </View>
                <Button
                  pill
                  onPress={() => router.push(`/s/${s.slug}/reserver/quand` as never)}
                  style={{ paddingHorizontal: 20, paddingVertical: 13 }}
                >
                  Choisir un créneau
                </Button>
              </View>
            </>
          ) : (
            <View style={{ paddingVertical: 6 }}>
              <P center>Cochez une ou plusieurs prestations.</P>
            </View>
          )}
        </BottomSheet>
      }
    >
      <TopBar
        backTo={`/s/${s.slug}`}
        right={<Pill soft>{`${s.name} · ${s.genderTarget === 'men' ? 'Homme' : 'Femme'}`}</Pill>}
      />
      <H1>Prestations</H1>
      {groups.map((g) =>
        g.name === 'Formule' ? (
          <View key={g.name} style={{ gap: 10 }}>
            <SectionLabel>Formule</SectionLabel>
            {g.services.map((sv) => (
              <ServiceRow key={sv.id} sv={sv} boxed />
            ))}
          </View>
        ) : (
          <View key={g.name} style={{ gap: 10 }}>
            <SectionLabel>{g.name}</SectionLabel>
            <ListCard>
              {g.services.map((sv) => (
                <ServiceRow key={sv.id} sv={sv} />
              ))}
            </ListCard>
          </View>
        ),
      )}
      {groups.length === 0 && (
        <View style={{ paddingVertical: 10 }}>
          <P>Aucune prestation pour le moment.</P>
        </View>
      )}
    </Screen>
  );
}
