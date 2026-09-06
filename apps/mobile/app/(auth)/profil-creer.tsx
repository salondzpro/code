/** AUTH 13 — Profil client de base : prénom et nom, numéro vérifié, rappels WhatsApp. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMe, useUpdateProfile } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ, resolveNext } from '@/lib/authFlow';
import { errorText } from '@/lib/errors';
import { Badge, Button, Field, H1, Input, P, Toggle, TopBar, Tx } from '@/ui';
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
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setName((v) => v || me.data!.profile.fullName || '');
      setReminders(me.data.profile.whatsappReminders ?? true);
    }
  }, [me.data]);

  if (!session) return <Redirect href="/connexion" />;

  const phone = user?.phone ? `+${user.phone.replace(/^\+/, '')}` : me.data?.profile.phone;
  const email = user?.email;

  const submit = async () => {
    if (name.trim().length < 2) return setError('Indiquez votre prénom.');
    setError(null);
    try {
      await update.mutateAsync({ fullName: name.trim(), whatsappReminders: reminders, ...(phone && !me.data?.profile.phone ? { phone } : {}) });
      const isPro = me.data?.profile.role === 'pro';
      if (isPro) router.replace('/(pro)');
      else if (!me.data?.profile.market) router.replace({ pathname: '/marche', params: { next } });
      else router.replace(resolveNext(next) as never);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Screen gap={16}>
      <TopBar noBack right="Dernière étape" />
      <View style={{ gap: 12 }}>
        <H1>Votre prénom</H1>
        <P>Le professionnel le voit sur la réservation. Rien d'autre n'est obligatoire.</P>
      </View>
      <View style={{ gap: 20 }}>
        <Field label="Prénom et nom" error={error}>
          <Input lg f={!!name} value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder="Inès Rahmani" autoFocus returnKeyType="done" onSubmitEditing={() => void submit()} />
        </Field>
        <View>
          <Tx size={13} color={C.muted} lh={18} style={{ marginBottom: 6 }}>
            {phone ? 'Numéro vérifié' : 'Adresse vérifiée'}
          </Tx>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: R.input, backgroundColor: C.fill, paddingHorizontal: 16, paddingVertical: 18 }}>
            <Tx size={17} lh={22}>
              {phone ? formatIntlDZ(phone) : email}
            </Tx>
            <Badge tone="ok" md>
              Vérifié
            </Badge>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Tx size={20} weight={600} lh={25}>
              Rappels WhatsApp
            </Tx>
            <P>2 h avant chaque rendez-vous</P>
          </View>
          <Toggle on={reminders} onChange={setReminders} label="Rappels WhatsApp" />
        </View>
        <Button onPress={() => void submit()} disabled={update.isPending} loading={update.isPending}>
          Terminer
        </Button>
      </View>
    </Screen>
  );
}
