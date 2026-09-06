/** AUTH 04 / 05 — Numéro de téléphone (+213 + 9 chiffres), erreur « numéro incomplet ». */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ChevronDown } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { EMAIL_FALLBACK, groupLocalDigits, readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Alert, Button, H1, I, Input, P, TextLink, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, R } from '@/theme/design';

export default function Phone() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; next?: string; redirect?: string }>();
  const flow = readAuthFlow();
  const role = params.role === 'pro' ? 'pro' : flow.role;
  const next = params.next ?? params.redirect ?? (flow.next || (role === 'pro' ? '/pro' : '/'));
  const [digits, setDigits] = useState(() => (flow.identifier.startsWith('+213') ? flow.identifier.slice(4) : ''));
  const [email, setEmail] = useState('');
  const [useEmail, setUseEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/retour" />;

  const submit = () => {
    if (useEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Adresse e-mail invalide.');
      writeAuthFlow({ role, next, identifier: email.trim().toLowerCase(), channel: 'email' });
      router.push('/canal');
      return;
    }
    const local = digits.replace(/\D/g, '');
    if (local.length !== 9 || !/^[5-7]/.test(local)) return setError('Numéro incomplet — 9 chiffres attendus après +213.');
    setError(null);
    writeAuthFlow({ role, next, identifier: `+213${local}`, channel: 'whatsapp' });
    router.push('/canal');
  };

  return (
    <Screen gap={16}>
      <TopBar backTo="/bienvenue" right="Étape 1 sur 3" />
      <View style={{ gap: 12 }}>
        <H1>Votre numéro</H1>
        <P>Nous envoyons un code à 6 chiffres sur WhatsApp pour vérifier votre numéro.</P>
      </View>
      {useEmail ? (
        <Input
          lg
          err={!!error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="vous@exemple.dz"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          accessibilityLabel="Adresse e-mail"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.fill, borderRadius: R.input, paddingHorizontal: 16 }} accessibilityLabel="Indicatif +213">
            <Tx size={17} weight={500} lh={22}>
              +213
            </Tx>
            <I icon={ChevronDown} size={16} color={C.subtle} />
          </View>
          <Input
            lg
            err={!!error}
            style={{ flex: 1 }}
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
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
      )}
      {error ? <Alert icon={AlertCircle}>{error}</Alert> : <Tx size={14} color={C.muted} lh={20}>{useEmail ? 'Le code arrivera par e-mail.' : 'Format algérien · +213 XX XX XX XX'}</Tx>}
      <Button onPress={submit}>Recevoir le code</Button>
      {EMAIL_FALLBACK && <TextLink onPress={() => setUseEmail((v) => !v)}>{useEmail ? 'Utiliser un numéro de téléphone' : 'Recevoir le code par e-mail'}</TextLink>}
    </Screen>
  );
}
