/**
 * C-F 10 — Pour qui ? : rendez-vous pour soi (coordonnées du compte, préremplies) ou POUR
 * QUELQU'UN D'AUTRE (son nom et son numéro) — jumeau de l'écran web
 * (apps/web/src/pages/client/BookingDetails.tsx).
 *
 * Réserver pour quelqu'un d'autre est la norme ici : on prend rendez-vous pour sa mère, sa
 * sœur, un ami sans l'application. Le rendez-vous appartient alors à cette personne — son
 * numéro l'identifie, et s'il correspond à un compte il s'y rattache — donc les mêmes règles
 * la concernent : plafond de rendez-vous à venir, doublon d'horaire, suspension pour
 * annulations.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, MessageCircle } from 'lucide-react-native';
import { useMe, useSalon } from '@salondz/api-client';
import { formatDA, formatDateLongDZ, formatTimeDZ } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { groupLocalDigits } from '@/lib/authFlow';
import { readDraft, writeDraft } from '@/lib/bookingDraft';
import { formatDuration } from '@/lib/format';
import {
  BottomSheet,
  Button,
  Card,
  Field,
  H1,
  I,
  Input,
  P,
  Segmented,
  Toggle,
  TopBar,
  Tx,
} from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

type Who = 'me' | 'other';
type FieldName = 'name' | 'phone' | 'otherName' | 'otherPhone';

export default function BookingDetails() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const me = useMe(!!session);
  const draft = readDraft(slug);
  const [who, setWho] = useState<Who>(draft.forOther ? 'other' : 'me');
  const [name, setName] = useState(draft.name ?? '');
  const [digits, setDigits] = useState(() => (draft.phone ?? '').replace(/^\+213/, ''));
  const [otherName, setOtherName] = useState(draft.otherName ?? '');
  const [otherDigits, setOtherDigits] = useState(() =>
    (draft.otherPhone ?? '').replace(/^\+213/, ''),
  );
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [whatsapp, setWhatsapp] = useState(draft.whatsapp ?? true);
  const [err, setErr] = useState<{ field: FieldName; msg: string } | null>(null);

  useEffect(() => {
    const p = me.data?.profile;
    if (!p) return;
    setName((v) => v || p.fullName || '');
    setDigits((v) => v || (p.phone ?? '').replace(/^\+213/, ''));
    setWhatsapp(p.whatsappReminders ?? true);
  }, [me.data]);

  if (!draft.startsAt || draft.serviceIds.length === 0)
    return <Redirect href={`/s/${slug}/prestations` as never} />;
  if (!session)
    return (
      <Redirect
        href={
          { pathname: '/connexion', params: { next: `/s/${slug}/reserver/coordonnees` } } as never
        }
      />
    );
  if (salon.isPending || me.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const forOther = who === 'other';
  const msg = (f: FieldName) => (err?.field === f ? err.msg : null);

  const submit = () => {
    const parse = (d: string) => phoneDZ.safeParse(`0${d.replace(/\D/g, '')}`);
    const bad = 'Numéro algérien invalide (9 chiffres après +213).';

    if (forOther) {
      if (otherName.trim().length < 2)
        return setErr({ field: 'otherName', msg: 'Indiquez le nom de la personne.' });
      const p = parse(otherDigits);
      if (!p.success) return setErr({ field: 'otherPhone', msg: bad });
      setErr(null);
      const own = parse(digits);
      writeDraft(slug, {
        forOther: true,
        otherName: otherName.trim(),
        otherPhone: p.data,
        name: name.trim() || me.data?.profile.fullName || '',
        phone: own.success ? own.data : (me.data?.profile.phone ?? undefined),
        notes: notes.trim(),
        whatsapp,
      });
      router.push(`/s/${slug}/reserver/recap` as never);
      return;
    }

    if (name.trim().length < 2) return setErr({ field: 'name', msg: 'Indiquez votre nom.' });
    const p = parse(digits);
    if (!p.success) return setErr({ field: 'phone', msg: bad });
    setErr(null);
    writeDraft(slug, {
      forOther: false,
      otherName: '',
      otherPhone: '',
      name: name.trim(),
      phone: p.data,
      notes: notes.trim(),
      whatsapp,
    });
    router.push(`/s/${slug}/reserver/recap` as never);
  };

  /** Champ téléphone algérien : indicatif figé + 9 chiffres groupés. */
  const phoneField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    error: string | null,
  ) => (
    <Field label={label} error={error}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: C.fill,
            borderRadius: R.input,
            paddingHorizontal: 13,
          }}
        >
          <Tx size={12} weight={500} lh={14.5}>
            +213
          </Tx>
          <I icon={ChevronDown} size={14} color={C.subtle} />
        </View>
        <Input
          lg
          style={{ flex: 1 }}
          keyboardType="number-pad"
          value={groupLocalDigits(value)}
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 9))}
          accessibilityLabel={label}
          err={!!error}
        />
      </View>
    </Field>
  );

  return (
    <Screen
      gap={11}
      footer={
        <BottomSheet>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Tx size={20} weight={700} ls={-0.5} lh={22}>
                {formatDA(price)}
              </Tx>
              <P>
                {formatDuration(minutes)} ·{' '}
                {formatDateLongDZ(draft.startsAt).replace(/^\p{L}/u, (c) => c.toLowerCase())},{' '}
                {formatTimeDZ(draft.startsAt)}
              </P>
            </View>
            <Button pill onPress={submit} style={{ paddingHorizontal: 23, paddingVertical: 11 }}>
              Vérifier
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/s/${slug}/reserver/quand`} right="Étape 2 sur 3" />
      <H1>Pour qui ?</H1>

      <Segmented
        label="Pour qui est ce rendez-vous"
        value={who}
        onChange={(v) => {
          setWho(v);
          setErr(null);
        }}
        options={[
          { value: 'me', label: 'Pour moi' },
          { value: 'other', label: 'Pour quelqu’un d’autre' },
        ]}
      />

      {forOther ? (
        <>
          {/* Ce que ça engage, en une ligne : le rendez-vous est à elle, règles comprises. */}
          <P>
            Le rendez-vous sera au nom de cette personne, sur son compte si elle en a un, avec les
            mêmes règles d’annulation.
          </P>
          <Field label="Nom et prénom de la personne" error={msg('otherName')}>
            <Input
              lg
              f={!!otherName}
              value={otherName}
              onChangeText={setOtherName}
              placeholder="Amina Bensalem"
            />
          </Field>
          {phoneField('Son téléphone', otherDigits, setOtherDigits, msg('otherPhone'))}
        </>
      ) : (
        <>
          <Field label="Nom et prénom" error={msg('name')}>
            <Input
              lg
              f={!!name}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
            />
          </Field>
          {phoneField('Téléphone', digits, setDigits, msg('phone'))}
        </>
      )}

      <Field label="Note pour le salon (optionnel)">
        <Input
          multiline
          value={notes}
          onChangeText={setNotes}
          maxLength={300}
          placeholder="Base fine, gel rose pâle si possible"
        />
      </Field>

      <Card row gap={11} pad={11}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: R.cardSm,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I icon={MessageCircle} size={17} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={14} weight={600} lh={18}>
            Confirmation et rappel
          </Tx>
          <Tx size={12} color={C.muted} lh={16}>
            2 h avant le rendez-vous
          </Tx>
        </View>
        <Toggle on={whatsapp} onChange={setWhatsapp} label="Rappels de rendez-vous" />
      </Card>
    </Screen>
  );
}
