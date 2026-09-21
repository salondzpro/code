/**
 * Mot de passe oublié : envoi du lien. Le lien s'ouvre dans le navigateur du téléphone, où l'on
 * choisit le nouveau mot de passe ; on revient ensuite dans l'application se connecter.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { authErrorText, EMAIL_RE, useAuth } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Alert, Button, Field, H1, Input, P, TopBar } from '@/ui';
import { Screen } from '@/ui/Screen';

export default function ForgotPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.email ?? readAuthFlow().identifier);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError('Adresse e-mail invalide.');
    setBusy(true);
    setError(null);
    try {
      writeAuthFlow({ identifier: id, sentAt: Date.now() });
      await sendPasswordReset(id);
      router.replace({ pathname: '/envoye', params: { mode: 'reset' } });
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen gap={13}>
      <TopBar backTo="/connexion" />
      <View style={{ gap: 10 }}>
        <H1>Mot de passe oublié</H1>
        <P>Indiquez votre adresse : vous recevrez un lien pour en choisir un nouveau.</P>
      </View>
      <Field label="E-mail">
        <Input
          lg
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          accessibilityLabel="Adresse e-mail"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          autoFocus
        />
      </Field>
      {error && <Alert icon={AlertCircle}>{error}</Alert>}
      <Button onPress={() => void submit()} disabled={busy} loading={busy}>
        Envoyer le lien
      </Button>
    </Screen>
  );
}
