/** C-F 10 — Vos coordonnées : nom, téléphone (+213), note pour le salon, rappel WhatsApp, feuille « Vérifier ». */
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
import { BottomSheet, Button, Card, Field, H1, I, Input, P, Toggle, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, R } from '@/theme/design';

export default function BookingDetails() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const salon = useSalon(slug);
  const me = useMe(!!session);
  const draft = readDraft(slug);
  const [name, setName] = useState(draft.name ?? '');
  const [digits, setDigits] = useState(() => (draft.phone ?? '').replace(/^\+213/, ''));
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [whatsapp, setWhatsapp] = useState(draft.whatsapp ?? true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = me.data?.profile;
    if (!p) return;
    setName((v) => v || p.fullName || '');
    setDigits((v) => v || (p.phone ?? '').replace(/^\+213/, ''));
    setWhatsapp(p.whatsappReminders ?? true);
  }, [me.data]);

  if (!draft.startsAt || draft.serviceIds.length === 0) return <Redirect href={`/s/${slug}/prestations` as never} />;
  if (!session) return <Redirect href={{ pathname: '/connexion', params: { next: `/s/${slug}/reserver/coordonnees` } } as never} />;
  if (salon.isPending || me.isPending) return <Splash />;
  const s = salon.data;
  if (!s) return null;
  const chosen = draft.serviceIds.map((id) => s.services.find((x) => x.id === id)).filter(Boolean);
  const minutes = chosen.reduce((a, x) => a + (x?.durationMinutes ?? 0), 0);
  const price = chosen.reduce((a, x) => a + (x?.priceDa ?? 0), 0);
  const nameError = !!error && name.trim().length < 2;
  const phoneError = !!error && name.trim().length >= 2;

  const submit = () => {
    if (name.trim().length < 2) return setError('Indiquez votre nom.');
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError('Numéro algérien invalide (9 chiffres après +213).');
    setError(null);
    writeDraft(slug, { name: name.trim(), phone: parsed.data, notes: notes.trim(), whatsapp });
    router.push(`/s/${slug}/reserver/recap` as never);
  };

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Tx size={26} weight={700} ls={-0.5} lh={31}>
                {formatDA(price)}
              </Tx>
              <P>
                {formatDuration(minutes)} · {formatDateLongDZ(draft.startsAt).replace(/^\p{L}/u, (c) => c.toLowerCase())}, {formatTimeDZ(draft.startsAt)}
              </P>
            </View>
            <Button pill onPress={submit} style={{ paddingHorizontal: 28, paddingVertical: 14 }}>
              Vérifier
            </Button>
          </View>
        </BottomSheet>
      }
    >
      <TopBar backTo={`/s/${slug}/reserver/quand`} right="Étape 4 sur 4" />
      <View style={{ gap: 12 }}>
        <H1>Vos coordonnées</H1>
        <P>Vous êtes connecté{me.data?.profile.gender === 'female' ? 'e' : ''} : vos coordonnées sont préremplies depuis votre compte.</P>
      </View>
      <Field label="Nom et prénom" error={nameError ? error : null}>
        <Input lg f={!!name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      </Field>
      <Field label="Téléphone" error={phoneError ? error : null}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.fill, borderRadius: R.input, paddingHorizontal: 16 }}>
            <Tx size={17} weight={500} lh={22}>
              +213
            </Tx>
            <I icon={ChevronDown} size={16} color={C.subtle} />
          </View>
          <Input lg style={{ flex: 1 }} keyboardType="number-pad" value={groupLocalDigits(digits)} onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, 9))} accessibilityLabel="Téléphone" err={phoneError} />
        </View>
      </Field>
      <Field label="Note pour le salon (optionnel)">
        <Input multiline value={notes} onChangeText={setNotes} maxLength={300} placeholder="Base fine, gel rose pâle si possible" />
      </Field>
      <Card row gap={16}>
        <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={MessageCircle} size={22} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={17} lh={22}>
            Confirmation et rappel sur WhatsApp
          </Tx>
          <P>2 h avant le rendez-vous</P>
        </View>
        <Toggle on={whatsapp} onChange={setWhatsapp} label="Rappel WhatsApp" />
      </Card>
    </Screen>
  );
}
