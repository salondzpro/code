/**
 * AUTH 13 — Profil : nom et NUMÉRO DE TÉLÉPHONE, tous deux obligatoires. Le numéro est contrôlé
 * dans sa forme (algérien, 9 chiffres après +213) et rien de plus : aucun SMS. C'est le numéro que le
 * salon appelle en cas de retard ou de question, et celui qui rattache les rendez-vous pris par
 * quelqu'un d'autre à ce compte.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { groupLocalDigits, resolveNext } from '@/lib/authFlow';
import { errorText } from '@/lib/errors';
import { Badge, Button, Field, H1, I, Input, P, Toggle, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, R } from '@/theme/design';

export default function ProfileSetup() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = params.next || '/';
  const { session, user } = useAuth();
  const me = useMe(!!session);
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState<{ field: 'name' | 'phone' | 'form'; msg: string } | null>(null);

  useEffect(() => {
    if (me.data) {
      setName((v) => v || me.data!.profile.fullName || '');
      setDigits((v) => v || (me.data!.profile.phone ?? '').replace(/^\+213/, ''));
      setReminders(me.data.profile.remindersEnabled ?? true);
    }
  }, [me.data]);

  if (!session) return <Redirect href="/connexion" />;

  const email = user?.email;
  const isPro = me.data?.profile.role === 'pro';

  const submit = async () => {
    if (name.trim().length < 2) return setError({ field: 'name', msg: 'Indiquez votre prénom et votre nom.' });
    const parsed = phoneDZ.safeParse(`0${digits.replace(/\D/g, '')}`);
    if (!parsed.success) return setError({ field: 'phone', msg: 'Numéro algérien invalide : 9 chiffres après +213.' });
    setError(null);
    try {
      await update.mutateAsync({ fullName: name.trim(), phone: parsed.data, remindersEnabled: reminders });
      if (isPro) router.replace('/(pro)');
      else if (!me.data?.profile.market) router.replace({ pathname: '/marche', params: { next } });
      else router.replace(resolveNext(next) as never);
    } catch (err) {
      setError({ field: 'form', msg: errorText(err) });
    }
  };

  return (
    <Screen gap={13}>
      <TopBar noBack right="Dernière étape" />
      <View style={{ gap: 10 }}>
        <H1>Vos coordonnées</H1>
        <P>{isPro ? 'Votre nom et le numéro où vos clients peuvent vous joindre.' : 'Le salon voit votre nom sur la réservation et vous appelle sur ce numéro si besoin.'}</P>
      </View>
      <View style={{ gap: 16 }}>
        <Field label="Prénom et nom" error={error?.field === 'name' ? error.msg : null}>
          <Input
            lg
            f={!!name}
            err={error?.field === 'name'}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            autoComplete="name"
            textContentType="name"
            placeholder="Inès Rahmani"
            autoFocus
            returnKeyType="next"
          />
        </Field>
        <Field
          label="Numéro de téléphone"
          error={error?.field === 'phone' ? error.msg : null}
          hint="Format algérien · aucun SMS envoyé."
        >
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.fill, borderRadius: R.input, paddingHorizontal: 13 }}
              accessibilityLabel="Indicatif +213"
            >
              <Tx size={12} weight={500} lh={14.5}>
                +213
              </Tx>
              <I icon={ChevronDown} size={14} color={C.subtle} />
            </View>
            <Input
              lg
              style={{ flex: 1 }}
              err={error?.field === 'phone'}
              keyboardType="number-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              placeholder="6 61 24 87 90"
              value={groupLocalDigits(digits)}
              onChangeText={(v) => {
                setDigits(v.replace(/\D/g, '').slice(0, 9));
                setError(null);
              }}
              accessibilityLabel="Numéro de téléphone"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
          </View>
        </Field>
        {email && (
          <View>
            <Tx size={12} color={C.muted} lh={14.5} style={{ marginBottom: 5 }}>
              Adresse vérifiée
            </Tx>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: R.input, backgroundColor: C.fill, paddingHorizontal: 13, paddingVertical: 15 }}>
              <Tx size={12} lh={14.5} style={{ flexShrink: 1 }} numberOfLines={1}>
                {email}
              </Tx>
              <Badge tone="ok" md>
                Vérifiée
              </Badge>
            </View>
          </View>
        )}
        {!isPro && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Tx size={14} weight={600} lh={17}>
                Rappels de rendez-vous
              </Tx>
              <P>La veille et 2 h avant, par notification</P>
            </View>
            <Toggle on={reminders} onChange={setReminders} label="Rappels de rendez-vous" />
          </View>
        )}
        {error?.field === 'form' && <Tx size={12} color={C.danger} lh={15.5}>{error.msg}</Tx>}
        <Button onPress={() => void submit()} disabled={update.isPending} loading={update.isPending}>
          Terminer
        </Button>
      </View>
    </Screen>
  );
}
