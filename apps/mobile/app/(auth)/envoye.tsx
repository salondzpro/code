/**
 * « Vérifiez votre e-mail » : après l'inscription (lien de confirmation), une demande de lien de
 * connexion, ou une réinitialisation de mot de passe. Renvoi possible après un délai.
 *
 * Le lien s'ouvre dans le navigateur du téléphone (salondz.com), qui confirme le compte. On revient
 * ici : « J'ai confirmé mon adresse » ouvre la session d'un geste quand le mot de passe vient d'être
 * saisi à l'inscription (gardé en mémoire seulement), sinon on renvoie vers la connexion.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { authErrorText, describeAuthError, useAuth } from '@/lib/auth';
import { readAuthFlow, recalledCredentials, resolveNext, writeAuthFlow } from '@/lib/authFlow';
import { Alert, Button, H1, I, InfoBox, P, TextLink, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

const RESEND_SECONDS = 60;
type Mode = 'confirm' | 'link' | 'reset';

const TEXT: Record<Mode, { title: string; body: string; resend: string }> = {
  confirm: {
    title: 'Confirmez votre adresse',
    body: 'Nous venons d’envoyer un lien de confirmation. Ouvrez-le depuis ce téléphone pour activer votre compte, puis revenez ici.',
    resend: 'Renvoyer le lien de confirmation',
  },
  link: {
    title: 'Lien de connexion envoyé',
    body: 'Si un compte existe avec cette adresse, vous recevez un lien : il vous connecte dans le navigateur. Revenez ensuite ici et connectez-vous avec votre mot de passe.',
    resend: 'Renvoyer le lien de connexion',
  },
  reset: {
    title: 'E-mail envoyé',
    body: 'Si un compte existe avec cette adresse, vous recevez un lien pour choisir un nouveau mot de passe. Revenez ensuite ici vous connecter.',
    resend: 'Renvoyer l’e-mail',
  },
};

export default function EmailSent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { session, signInWithPassword, resendConfirmation, sendMagicLink, sendPasswordReset } = useAuth();
  const flow = readAuthFlow();
  const mode: Mode = params.mode === 'link' || params.mode === 'reset' ? params.mode : 'confirm';
  const email = flow.identifier;
  const [resendIn, setResendIn] = useState(() => Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - (flow.sentAt ?? 0)) / 1000)));
  const [busy, setBusy] = useState<'resend' | 'confirmed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  // La session existe (lien ouvert dans l'app, ou connexion faite) : on continue.
  if (session && mode !== 'reset') return <Redirect href={{ pathname: '/retour', params: { next: flow.next } }} />;
  if (!email) return <Redirect href="/connexion" />;
  const txt = TEXT[mode];
  const remembered = mode === 'confirm' ? recalledCredentials(email) : null;

  const resend = async () => {
    setBusy('resend');
    setError(null);
    try {
      if (mode === 'confirm') await resendConfirmation(email, flow.next);
      else if (mode === 'link') await sendMagicLink(email, flow.next);
      else await sendPasswordReset(email);
      writeAuthFlow({ sentAt: Date.now() });
      setResendIn(RESEND_SECONDS);
      setSent(true);
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(null);
    }
  };

  /** « J'ai confirmé » : on ouvre la session avec le mot de passe qu'on vient de saisir. */
  const confirmed = async () => {
    if (!remembered) return router.replace({ pathname: '/connexion', params: { next: flow.next } });
    setBusy('confirmed');
    setError(null);
    try {
      await signInWithPassword(remembered.email, remembered.password);
      router.replace({ pathname: '/retour', params: { next: flow.next } });
    } catch (err) {
      const d = describeAuthError(err);
      setError(d.kind === 'unconfirmed' ? 'Votre adresse n’est pas encore confirmée. Ouvrez le lien reçu par e-mail, puis réessayez.' : d.text);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen gap={13}>
      <TopBar backTo="/connexion" />
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.okBg }}>
          <I icon={MailCheck} size={34} color={C.okFg} />
        </View>
        <H1 center>{txt.title}</H1>
        <P center>{txt.body}</P>
        <Tx size={14} weight={600} center>
          {email}
        </Tx>
      </View>
      <InfoBox>Rien reçu ? Regardez dans les courriers indésirables. Le lien reste valable une heure.</InfoBox>
      {error && <Alert>{error}</Alert>}
      {mode === 'confirm' && (
        <Button onPress={() => void confirmed()} disabled={busy !== null} loading={busy === 'confirmed'}>
          J’ai confirmé mon adresse
        </Button>
      )}
      <Button variant="g" onPress={() => void resend()} disabled={busy !== null || resendIn > 0} loading={busy === 'resend'}>
        {resendIn > 0 ? `${txt.resend} (${resendIn} s)` : sent ? 'Renvoyé' : txt.resend}
      </Button>
      <TextLink onPress={() => router.replace('/connexion')}>Changer d’adresse ou se connecter autrement</TextLink>
    </Screen>
  );
}
