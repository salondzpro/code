/** AUTH 06 / 07 — Canal de vérification (WhatsApp par défaut, SMS) puis envoi du code. */
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Mail, MessageCircle } from 'lucide-react-native';
import { useAuth, type OtpChannel } from '@/lib/auth';
import { EMAIL_FALLBACK, formatIntlDZ, useAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { errorText } from '@/lib/errors';
import { Alert, Badge, Button, Card, H1, H2, I, InfoBox, P, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

const LABEL: Record<OtpChannel, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'e-mail' };

function ChannelIcon({ icon, ok }: { icon: typeof Mail; ok?: boolean }) {
  return (
    <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? C.okBg : C.surface, borderWidth: ok ? 0 : 1, borderColor: C.line }}>
      <I icon={icon} size={20} color={ok ? C.okFg : C.text} />
    </View>
  );
}

export default function Channel() {
  const router = useRouter();
  const { sendPhoneOtp, sendEmailOtp } = useAuth();
  const flow = useAuthFlow();
  const isEmail = flow.channel === 'email';
  const [channel, setChannel] = useState<OtpChannel>(flow.channel);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!flow.identifier) return <Redirect href="/connexion" />;
  const shown = isEmail || channel === 'email' ? flow.identifier : formatIntlDZ(flow.identifier);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      if (channel === 'email') await sendEmailOtp(flow.identifier, flow.role);
      else await sendPhoneOtp(flow.identifier, channel, flow.role);
      writeAuthFlow({ channel, sentAt: Date.now() });
      router.push('/code');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  if (sending) {
    // AUTH 07 — Envoi du code
    return (
      <Screen center gap={16}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={C.ink} />
          <H2 center>Envoi du code {channel === 'email' ? 'par e-mail' : `sur ${LABEL[channel]}`}…</H2>
          <P center>{shown}</P>
        </View>
      </Screen>
    );
  }

  return (
    <Screen gap={16}>
      <TopBar backTo="/connexion" right="Étape 2 sur 3" />
      <H1>Comment recevoir le code ?</H1>
      <View style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Canal de vérification">
        {!isEmail && (
          <>
            <Card row gap={16} sel={channel === 'whatsapp'} onPress={() => setChannel('whatsapp')} accessibilityLabel="WhatsApp">
              <ChannelIcon icon={MessageCircle} ok />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={20} weight={600} lh={25}>
                  WhatsApp
                </Tx>
                <P>Recommandé · instantané et gratuit</P>
              </View>
              <Badge tone="ok" dot={false} md>
                Par défaut
              </Badge>
            </Card>
            <Card row gap={16} sel={channel === 'sms'} onPress={() => setChannel('sms')} accessibilityLabel="SMS">
              <ChannelIcon icon={MessageCircle} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Tx size={20} weight={600} lh={25}>
                  SMS
                </Tx>
                <P>Si WhatsApp n'est pas installé</P>
              </View>
            </Card>
          </>
        )}
        {(isEmail || EMAIL_FALLBACK) && (
          <Card row gap={16} sel={channel === 'email'} onPress={() => setChannel('email')} accessibilityLabel="E-mail">
            <ChannelIcon icon={Mail} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Tx size={20} weight={600} lh={25}>
                E-mail
              </Tx>
              <P>{isEmail ? flow.identifier : 'Si le téléphone ne reçoit pas de code'}</P>
            </View>
          </Card>
        )}
      </View>
      <InfoBox>
        <Tx size={15} color={C.muted} lh={22}>
          Le code arrive sur <Tx size={15} weight={600} lh={22}>{shown}</Tx>. Vous pouvez modifier le numéro.
        </Tx>
      </InfoBox>
      {error && <Alert>{error}</Alert>}
      <Button onPress={() => void send()}>{channel === 'email' ? 'Envoyer par e-mail' : `Envoyer sur ${LABEL[channel]}`}</Button>
    </Screen>
  );
}
