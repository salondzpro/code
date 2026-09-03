import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { emailOtpRequestSchema, emailOtpVerifySchema } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Screen, TextField, Title, Muted } from '@/components';
import { spacing } from '@/theme/tokens';

type Params = { role?: 'client' | 'pro'; redirect?: string };

/** Connexion par code email (OTP) en 2 étapes. Crée le compte si nécessaire. */
export default function Connexion() {
  const router = useRouter();
  const { role, redirect } = useLocalSearchParams<Params>();
  const { signInWithEmailOtp, verifyEmailOtp } = useAuth();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const sendCode = async () => {
    const parsed = emailOtpRequestSchema.safeParse({ email, role });
    if (!parsed.success) return setError(new Error('Adresse email invalide.'));
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailOtp(parsed.data.email, parsed.data.role);
      setStep('code');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const parsed = emailOtpVerifySchema.safeParse({ email, token: code });
    if (!parsed.success) return setError(new Error('Entrez le code à 6 chiffres reçu par email.'));
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(parsed.data.email, parsed.data.token);
      const target = redirect && redirect.startsWith('/') ? redirect : '/';
      router.replace(target as never);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Title>{role === 'pro' ? 'Espace professionnel' : 'Bienvenue'}</Title>
      <Muted>
        {step === 'email'
          ? 'Entrez votre email : nous vous envoyons un code de connexion. Aucun mot de passe à retenir.'
          : `Code envoyé à ${email}. Vérifiez aussi vos spams.`}
      </Muted>
      <View style={styles.form}>
        {step === 'email' ? (
          <>
            <TextField
              label="Email"
              placeholder="vous@exemple.dz"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus
              onSubmitEditing={sendCode}
            />
            <Button title="Recevoir mon code" onPress={sendCode} loading={busy} fullWidth />
          </>
        ) : (
          <>
            <TextField
              label="Code de connexion"
              placeholder="123456"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus
              onSubmitEditing={verify}
            />
            <Button title="Se connecter" onPress={verify} loading={busy} fullWidth />
            <Button title="Renvoyer le code" variant="ghost" onPress={sendCode} disabled={busy} style={{ marginTop: spacing.sm }} />
            <Button title="Changer d'email" variant="ghost" onPress={() => setStep('email')} disabled={busy} />
          </>
        )}
        <ErrorText error={error} />
      </View>
      <Text style={styles.legal}>En continuant, vous acceptez les conditions d'utilisation de SalonDZ.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.xl },
  legal: { marginTop: spacing.xl, fontSize: 12, color: '#6B6478', textAlign: 'center' },
});
