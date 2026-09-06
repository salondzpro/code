/**
 * AUTH 08 → 12 — Saisie du code à 6 chiffres : code envoyé, incorrect (tentatives restantes),
 * expiré (renvoyer + compte à rebours), erreur réseau (réessayer), puis « Numéro vérifié ».
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AlertCircle, Check, MessageCircle, WifiOff } from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { clearAuthFlow, formatIntlDZ, useAuthFlow, writeAuthFlow } from '@/lib/authFlow';
import { errorText, isNetworkError } from '@/lib/errors';
import { Alert, Button, Card, H1, I, P, S, TextLink, Toggle, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C, R } from '@/theme/design';

const RESEND_SECONDS = 30;
const MAX_ATTEMPTS = 3;
type Status = 'idle' | 'verifying' | 'wrong' | 'expired' | 'network' | 'verified';

export default function Code() {
  const router = useRouter();
  const { verifyPhoneOtp, verifyEmailOtp, sendPhoneOtp, sendEmailOtp } = useAuth();
  const flow = useAuthFlow();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [attempts, setAttempts] = useState(0);
  const [stay, setStay] = useState(true);
  const [resendIn, setResendIn] = useState(() => Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - (flow.sentAt ?? 0)) / 1000)));
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  if (!flow.identifier) return <Redirect href="/connexion" />;
  const isEmail = flow.channel === 'email';
  const shown = isEmail ? flow.identifier : formatIntlDZ(flow.identifier);
  const complete = code.length === 6;
  const expired = status === 'expired' || attempts >= MAX_ATTEMPTS;
  const digits = Array.from({ length: 6 }, (_, i) => code[i] ?? '');

  const verify = async () => {
    if (!complete) return;
    setStatus('verifying');
    try {
      if (isEmail) await verifyEmailOtp(flow.identifier, code);
      else await verifyPhoneOtp(flow.identifier, code);
      setStatus('verified');
    } catch (err) {
      if (isNetworkError(err)) return setStatus('network');
      if (/expired|expiré/i.test(errorText(err))) return setStatus('expired');
      setAttempts((a) => a + 1);
      setStatus('wrong');
    }
  };

  const resend = async () => {
    try {
      if (isEmail) await sendEmailOtp(flow.identifier, flow.role);
      else await sendPhoneOtp(flow.identifier, flow.channel === 'sms' ? 'sms' : 'whatsapp', flow.role);
      writeAuthFlow({ sentAt: Date.now() });
      setResendIn(RESEND_SECONDS);
      setCode('');
      setAttempts(0);
      setStatus('idle');
      input.current?.focus();
    } catch (err) {
      setStatus(isNetworkError(err) ? 'network' : 'idle');
    }
  };

  if (status === 'verified') {
    // AUTH 12 — Vérification réussie
    return (
      <Screen center gap={16}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={Check} size={40} color={C.okFg} />
        </View>
        <View style={{ gap: 12 }}>
          <H1>Numéro vérifié</H1>
          <P>
            <Tx size={15} weight={600} lh={22}>{shown}</Tx> est confirmé. Vous restez connecté sur cet appareil : aucun nouveau code ne vous sera envoyé.
          </P>
        </View>
        <Button
          onPress={() => {
            const next = flow.next;
            clearAuthFlow();
            router.replace({ pathname: '/profil-creer', params: { next } });
          }}
        >
          Continuer
        </Button>
      </Screen>
    );
  }

  const fresh = status === 'idle' && attempts === 0;
  const remaining = MAX_ATTEMPTS - attempts;
  const resendLabel = isEmail ? 'Renvoyer par e-mail' : flow.channel === 'sms' ? 'Renvoyer par SMS' : 'Renvoyer sur WhatsApp';
  const countdown = `0:${String(resendIn).padStart(2, '0')}`;

  return (
    <Screen gap={16}>
      <TopBar backTo="/canal" right="Étape 3 sur 3" />
      <H1>{fresh ? 'Code envoyé' : 'Saisir le code'}</H1>

      {fresh && (
        <View style={{ borderRadius: R.card, backgroundColor: C.okBg, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <I icon={MessageCircle} size={20} color={C.okFg} />
            </View>
            <View>
              <Tx size={17} weight={600} lh={22}>
                {isEmail ? 'E-mail · Beauty' : flow.channel === 'sms' ? 'SMS · Beauty' : 'WhatsApp · Beauty'}
              </Tx>
              <S>maintenant</S>
            </View>
          </View>
          <Tx size={15} lh={22}>
            Votre code de vérification arrive sur <Tx size={15} weight={600} lh={22}>{shown}</Tx>. Il expire dans 5 minutes.
          </Tx>
        </View>
      )}

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Code à 6 chiffres" style={{ flexDirection: 'row', gap: 10 }}>
        {digits.map((d, i) => (
          <View key={i} style={{ flex: 1, height: 68, borderRadius: R.input, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: d || status === 'wrong' ? C.surface : C.fill, borderColor: status === 'wrong' ? C.danger : d ? C.ink : 'transparent', opacity: expired ? 0.5 : 1 }}>
            <Tx size={22} weight={500} lh={28} mono>
              {d}
            </Tx>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, '').slice(0, 6));
          if (status === 'wrong' || status === 'network') setStatus('idle');
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
        editable={!expired}
        accessibilityLabel="Code de vérification"
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {fresh && <Tx size={14} color={C.muted} lh={20}>Coller automatiquement depuis {isEmail ? 'votre messagerie' : 'WhatsApp'}</Tx>}

      {status === 'wrong' && !expired && (
        <Alert icon={AlertCircle}>
          Code incorrect — {remaining} tentative{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}.
        </Alert>
      )}
      {expired && <Alert icon={AlertCircle}>{attempts >= MAX_ATTEMPTS ? 'Trop de tentatives. Demandez un nouveau code.' : 'Code expiré. Demandez-en un nouveau.'}</Alert>}
      {status === 'network' && <Alert icon={WifiOff}>Connexion perdue. Vérification impossible.</Alert>}

      {!expired && status !== 'network' && (
        <Card row>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Tx size={16} lh={21}>
              Rester connecté
            </Tx>
            <Tx size={14} color={C.muted} lh={20}>
              Session illimitée · aucun code à la prochaine visite
            </Tx>
          </View>
          <Toggle on={stay} onChange={setStay} label="Rester connecté" />
        </Card>
      )}

      {status === 'network' ? (
        <Button onPress={() => void verify()}>Réessayer</Button>
      ) : expired ? (
        <>
          <Button onPress={() => void resend()} disabled={resendIn > 0}>
            {resendLabel}
          </Button>
          {resendIn > 0 && (
            <Tx size={14} color={C.muted} lh={20} center>
              Nouveau code disponible dans {countdown}
            </Tx>
          )}
        </>
      ) : (
        <>
          <Button onPress={() => void verify()} disabled={!complete || status === 'verifying'} loading={status === 'verifying'}>
            Vérifier
          </Button>
          {status === 'wrong' && <TextLink size={15} onPress={() => (resendIn > 0 ? undefined : void resend())}>{resendIn > 0 ? `Renvoyer le code (${countdown})` : 'Renvoyer le code'}</TextLink>}
        </>
      )}
    </Screen>
  );
}
