/**
 * Inscription par e-mail et mot de passe. L'adresse est vérifiée par le lien reçu (comme les outils
 * du métier) ; le profil (nom, téléphone) se complète après, une fois connecté.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { describeAuthError, EMAIL_RE, PASSWORD_MIN, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, rememberCredentials, writeAuthFlow } from '@/lib/authFlow';
import { Alert, Button, Field, H1, Input, P, T3, TextLink, TopBar } from '@/ui';
import { PasswordInput } from '@/ui/PasswordInput';
import { Screen } from '@/ui/Screen';

export default function SignUp() {
  const { session, signUpWithPassword } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; next?: string }>();
  const flow = readAuthFlow();
  const role = params.role === 'pro' ? 'pro' : flow.role;
  const next = params.next ?? (flow.next || (role === 'pro' ? '/pro' : '/'));
  const [email, setEmail] = useState(flow.identifier);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(null);

  if (session) return <Redirect href={{ pathname: '/retour', params: { next } }} />;

  const submit = async () => {
    const id = email.trim().toLowerCase();
    if (!EMAIL_RE.test(id)) return setError({ kind: 'email', text: 'Adresse e-mail invalide.' });
    if (password.length < PASSWORD_MIN) return setError({ kind: 'password', text: `Mot de passe trop court : ${PASSWORD_MIN} caractères au minimum.` });
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role, next, identifier: id, sentAt: Date.now() });
      await signUpWithPassword(id, password, role, next);
      // Gardé en mémoire seulement : « J'ai confirmé mon adresse » ouvrira la session d'un geste.
      rememberCredentials(id, password);
      router.replace({ pathname: '/envoye', params: { mode: 'confirm' } });
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen gap={13}>
      <TopBar backTo={role === 'pro' ? '/pro-bienvenue' : '/connexion'} />
      <View style={{ gap: 10 }}>
        <H1>{role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}</H1>
        <P>{role === 'pro' ? 'Votre agenda, vos réservations et votre page en ligne, en quelques minutes.' : 'Réservez en ligne dans les salons de votre choix, sans appel.'}</P>
      </View>

      <Field label="E-mail" hint="Un lien de confirmation vous sera envoyé.">
        <Input
          lg
          err={error?.kind === 'email' || error?.kind === 'exists'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="vous@exemple.dz"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          accessibilityLabel="Adresse e-mail"
          returnKeyType="next"
        />
      </Field>
      <Field label="Mot de passe" hint={`${PASSWORD_MIN} caractères au minimum.`}>
        <PasswordInput
          err={error?.kind === 'password'}
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="Choisissez un mot de passe"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          accessibilityLabel="Mot de passe"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
      </Field>

      {error && (
        <View style={{ gap: 10 }}>
          <Alert icon={AlertCircle}>{error.text}</Alert>
          {error.kind === 'exists' && (
            <View style={{ gap: 8 }}>
              <Button sm onPress={() => router.push({ pathname: '/connexion', params: { role, next } })}>
                Se connecter
              </Button>
              <Button sm variant="g" onPress={() => router.push({ pathname: '/oubli', params: { email: email.trim() } })}>
                Mot de passe oublié
              </Button>
            </View>
          )}
        </View>
      )}

      <Button onPress={() => void submit()} disabled={busy} loading={busy}>
        Créer mon compte
      </Button>
      <T3 style={{ textAlign: 'center' }}>En créant un compte vous acceptez que Salon DZ vous envoie les confirmations et rappels de vos rendez-vous.</T3>
      <TextLink onPress={() => router.push({ pathname: '/connexion', params: { role, next } })}>Déjà inscrit ? Se connecter</TextLink>
    </Screen>
  );
}
