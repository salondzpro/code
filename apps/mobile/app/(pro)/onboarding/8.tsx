/** PRO-F 10 — Étape 8 : « Vos réalisations » — photos associées à une prestation (visibles sur sa fiche). */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useProSalon, useProServiceMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { pickImages, uploadSalonImage } from '@/lib/images';
import { stepPath } from '@/lib/proDraft';
import { Alert, Grid, H1, I, Img, ListCard, P, Tx } from '@/ui';
import { PickerSheet, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C } from '@/theme/design';

export default function Step8Works() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { setPhotos } = useProServiceMutations();
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);

  if (!salon) return <Splash />;
  const services = salon.services.filter((s) => s.isActive);
  const works = services.flatMap((s) => (s.photos ?? []).map((p) => ({ ...p, service: s })));
  const current = services.find((s) => s.id === target) ?? services[0];

  const add = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const imgs = await pickImages({ multiple: true, max: 6 });
      if (!imgs.length) return;
      const urls: string[] = [];
      for (const img of imgs) urls.push(await uploadSalonImage(salon.id, img));
      await setPhotos.mutateAsync({ id: current.id, photos: [...(current.photos ?? []).map((p) => ({ url: p.url })), ...urls.map((url) => ({ url }))] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (serviceId: string, url: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    await setPhotos.mutateAsync({ id: svc.id, photos: (svc.photos ?? []).filter((p) => p.url !== url).map((p) => ({ url: p.url })) });
  };

  return (
    <Screen gap={16} footer={<StepSheet onPress={() => router.push(stepPath(9) as never)} busy={busy} />}>
      <StepBar step={8} backTo={stepPath(6)} />
      <View style={{ gap: 8 }}>
        <H1>Vos réalisations</H1>
        <P>Associez chaque photo à une prestation : elle apparaîtra sur sa fiche.</P>
      </View>
      {services.length > 1 && (
        <ListCard>
          <ValueRow label="Prestation associée" value={current?.name ?? '—'} onPress={() => setSheet(true)} />
        </ListCard>
      )}
      <Grid cols={3}>
        {works.map((w) => (
          <View key={w.id} style={{ gap: 6 }}>
            <View style={{ aspectRatio: 1 }}>
              <Img src={w.url} radius={16} style={{ width: '100%', height: '100%' }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Retirer" onPress={() => void remove(w.service.id, w.url)} style={{ position: 'absolute', right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <I icon={X} size={14} color="#fff" />
              </Pressable>
            </View>
            <Tx size={14} color={C.muted} lh={18} center numberOfLines={1}>
              {w.service.name}
            </Tx>
          </View>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter des réalisations" onPress={() => void add()} disabled={busy || services.length === 0} style={{ aspectRatio: 1, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <I icon={Plus} size={26} color={C.subtle} />
          <Tx size={14} color={C.subtle} lh={18}>
            Ajouter
          </Tx>
        </Pressable>
      </Grid>
      {error && <Alert>{error}</Alert>}
      <PickerSheet open={sheet} onClose={() => setSheet(false)} title="Prestation associée" options={services.map((s) => ({ value: s.id, label: s.name }))} value={current?.id} onChange={setTarget} />
    </Screen>
  );
}
