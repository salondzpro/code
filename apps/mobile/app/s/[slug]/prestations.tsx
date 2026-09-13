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
  /**
   * UNE prestation par rendez-vous, comme sur la fiche du salon : « Choisir » écrase le
   * brouillon avec un seul identifiant et passe à l'horaire.
   */
  const chooseService = (id: string) => {
    writeDraft(slug, { serviceIds: [id] });
    router.push(`/s/${slug}/reserver/quand` as never);
  };

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

  if (salon.isPending) return <Splash />;
  if (salon.isError || !s)
    return (
      <Screen center>
        <ErrorText error={salon.error} retry={() => void salon.refetch()} />
      </Screen>
    );

  const groups = groupServices(s.services);

  const ServiceRow = ({ sv, boxed }: { sv: Service; boxed?: boolean }) => {
    const inner = (
      <>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Tx size={14} weight={700} ls={-0.3} lh={18}>
            {sv.name}
          </Tx>
          {!!sv.description && (
            <Tx size={11.5} color={C.muted} lh={15}>
              {sv.description}
            </Tx>
          )}
          <Tx size={12.5} weight={600} lh={16}>
            {formatDA(sv.priceDa)}
            <Tx size={12.5} color={C.muted} lh={16}>
              {` · ${formatDuration(sv.durationMinutes)}`}
            </Tx>
          </Tx>
        </View>
        <Button sm auto pill onPress={() => chooseService(sv.id)}>
          <Tx size={12} weight={600} color="#fff" ls={-0.2}>
            Choisir
          </Tx>
        </Button>
      </>
    );
    if (boxed)
      return (
        <Card row gap={10} style={{ alignItems: 'flex-start' }}>
          {inner}
        </Card>
      );
    return (
      <View
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11 }}
      >
        {inner}
      </View>
    );
  };

  return (
    <Screen
      gap={11}
    >
      <TopBar
        backTo={`/s/${s.slug}`}
        right={<Pill soft>{`${s.name} · ${s.genderTarget === 'men' ? 'Homme' : 'Femme'}`}</Pill>}
      />
      <H1>Prestations</H1>
      <P>
        Une prestation par rendez-vous. Pour en cumuler plusieurs, prenez un rendez-vous par
        prestation.
      </P>
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
