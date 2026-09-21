/**
 * Connexion par e-mail et mot de passe (comme le site), avec un lien de connexion par e-mail en
 * secours et la réinitialisation du mot de passe. Les actions qui comptent sont de VRAIS boutons,
 * pas des liens discrets ; chaque erreur est dite en français et propose la suite (créer un compte,
 * renvoyer le lien, réinitialiser).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, MailOpen, UserPlus } from 'lucide-react-native';
import { describeAuthError, EMAIL_RE, useAuth, type AuthErrorKind } from '@/lib/auth';
import { readAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { Alert, Button, Field, H1, I, Input, P, TextLink, TopBar, Tx } from '@/ui';
import { PasswordInput } from '@/ui/PasswordInput';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

export default function Login() {
  const { session, signInWithPassword, sendMagicLink, resendConfirmation } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string; next?: string; redirect?: string }>();
  const flow = readAuthFlow();
  const role = params.role === 'pro' ? 'pro' : flow.role;
  const next = params.next ?? params.redirect ?? (flow.next || (role === 'pro' ? '/pro' : '/'));
  const [email, setEmail] = useState(flow.identifier);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | 'resend' | null>(null);
  const [error, setError] = useState<{ kind: AuthErrorKind | 'form'; text: string } | null>(null);

  if (session) return <Redirect href={{ pathname: '/retour', params: { next } }} />;

  const id = () => email.trim().toLowerCase();
  const fail = (err: unknown) => setError(describeAuthError(err));

  const submit = async () => {
    if (!EMAIL_RE.test(id())) return setError({ kind: 'form', text: 'Adresse e-mail invalide.' });
    if (!password) return setError({ kind: 'form', text: 'Saisissez votre mot de passe.' });
    setError(null);
    setBusy('password');
    try {
      writeAuthFlow({ role, next, identifier: id() });
      await signInWithPassword(id(), password);
      router.replace({ pathname: '/retour', params: { next } });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const link = async () => {
    if (!EMAIL_RE.test(id())) return setError({ kind: 'form', text: 'Indiquez votre adresse e-mail pour recevoir le lien.' });
    setError(null);
    setBusy('link');
    try {
      writeAuthFlow({ role, next, identifier: id(), sentAt: Date.now() });
      await sendMagicLink(id(), next);
      router.push({ pathname: '/envoye', params: { mode: 'link' } });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setBusy('resend');
    try {
      writeAuthFlow({ role, next, identifier: id(), sentAt: Date.now() });
      await resendConfirmation(id(), next);
      router.push({ pathname: '/envoye', params: { mode: 'confirm' } });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const off = busy !== null;

  return (
    <Screen gap={13}>
      <TopBar backTo={role === 'pro' ? '/pro-bienvenue' : '/bienvenue'} />
      <View style={{ gap: 10 }}>
        <H1>{role === 'pro' ? 'Espace professionnel' : 'Connexion'}</H1>
        <P>{role === 'pro' ? 'Retrouvez votre agenda et vos réservations.' : 'Retrouvez vos rendez-vous et réservez en quelques secondes.'}</P>
      </View>

      <Field label="E-mail">
        <Input
          lg
          err={error?.kind === 'email' || error?.kind === 'no_account'}
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
      <Field label="Mot de passe">
        <PasswordInput
          err={error?.kind === 'credentials'}
          autoComplete="current-password"
          textContentType="password"
          placeholder="Votre mot de passe"
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
          {/* La suite logique de l'erreur, à portée de pouce. */}
          {error.kind === 'no_account' && (
            <Button sm onPress={() => router.push({ pathname: '/inscription', params: { role, next } })}>
              <I icon={UserPlus} size={16} color={C.onInk} />
              <Tx size={14} weight={600} color={C.onInk}>
                Créer un compte avec cette adresse
              </Tx>
            </Button>
          )}
          {error.kind === 'unconfirmed' && (
            <Button sm variant="g" onPress={() => void resend()} disabled={off} loading={busy === 'resend'}>
              Renvoyer le lien de confirmation
            </Button>
          )}
          {error.kind === 'credentials' && (
            <Button sm variant="g" onPress={() => router.push({ pathname: '/oubli', params: { email: email.trim() } })}>
              Réinitialiser mon mot de passe
            </Button>
          )}
        </View>
      )}

      <Button onPress={() => void submit()} disabled={off} loading={busy === 'password'}>
        Se connecter
      </Button>
      <TextLink onPress={() => router.push({ pathname: '/oubli', params: email ? { email: email.trim() } : {} })}>Mot de passe oublié ?</TextLink>

      <Button variant="g" onPress={() => void link()} disabled={off} loading={busy === 'link'}>
        <I icon={MailOpen} size={18} />
        <Tx size={16} weight={600} ls={-0.2}>
          Recevoir un lien de connexion par e-mail
        </Tx>
      </Button>

      <View style={{ gap: 10, marginTop: 6 }}>
        <P center>Pas encore de compte ?</P>
        <Button variant="g" onPress={() => router.push({ pathname: '/inscription', params: { role, next } })}>
          {role === 'pro' ? 'Créer mon espace pro' : 'Créer un compte'}
        </Button>
      </View>
    </Screen>
  );
}
