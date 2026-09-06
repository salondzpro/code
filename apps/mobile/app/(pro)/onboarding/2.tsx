/** PRO-F 04 — Étape 2 : nom public et lien de réservation (unique et définitif). */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@salondz/api-client';
import { readProDraft, stepPath, writeProDraft } from '@/lib/proDraft';
import { publicHost } from '@/lib/salon';
import { Badge, Field, H1, Input, P, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C, R } from '@/theme/design';

export default function Step2Name() {
  const router = useRouter();
  const { api } = useApi();
  const [name, setName] = useState(readProDraft().name ?? '');
  const [check, setCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const v = name.trim();
    if (v.length < 2) return setCheck(null);
    setChecking(true);
    const t = setTimeout(() => {
      api.pro
        .slugCheck(v)
        .then((r) => setCheck(r))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 350);
    return () => clearTimeout(t);
  }, [name, api]);

  return (
    <Screen
      gap={16}
      footer={
        <StepSheet
          disabled={name.trim().length < 2}
          onPress={() => {
            writeProDraft({ name: name.trim() });
            router.push(stepPath(3) as never);
          }}
        />
      }
    >
      <StepBar step={2} backTo={stepPath(1)} />
      <H1>Nom de votre salon</H1>
      <Field label="Nom public">
        <Input lg f={!!name} value={name} onChangeText={setName} maxLength={80} placeholder="Sarah Beauty Studio" autoFocus accessibilityLabel="Nom public" />
      </Field>
      <View>
        <Tx size={13} color={C.muted} lh={18} style={{ marginBottom: 6 }}>
          Votre lien de réservation
        </Tx>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: R.cardSm, backgroundColor: C.fill, paddingHorizontal: 16, paddingVertical: 18 }}>
          <Tx size={19} lh={24} numberOfLines={1} style={{ flex: 1 }}>
            {publicHost()}/s/{check?.slug || (name.trim() ? '…' : 'votre-salon')}
          </Tx>
          {check && (
            <Badge tone={check.available ? 'ok' : 'cn'} md>
              {checking ? 'Vérification…' : check.available ? 'Disponible' : 'Déjà pris'}
            </Badge>
          )}
        </View>
      </View>
      <P>Ce lien est unique et définitif. C'est lui que vous partagerez sur WhatsApp et Instagram.</P>
    </Screen>
  );
}
