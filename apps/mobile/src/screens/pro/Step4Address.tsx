/**
 * PRO-F 06 — Étape 4 : « Où vous trouver ? » — adresse, ville, quartier, domicile. Crée le salon.
 * En mode `settings` (Profil → Adresse et zone) : modifie le salon existant, avec le téléphone du salon.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react-native';
import { queryKeys, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { WILAYAS, categoriesForMarket, formatDZPhone, wilayaName } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { uploadSalonImage } from '@/lib/images';
import { clearProDraft, draftFiles, readProDraft, stepPath, writeProDraft } from '@/lib/proDraft';
import { Alert, H1, I, Input, ListCard, Row, Toggle, Tx } from '@/ui';
import { GridBg } from '@/ui/GridBg';
import { PickerSheet, ValueRow } from '@/ui/Pickers';
import { Screen } from '@/ui/Screen';
import { StepBar, StepSheet } from '@/ui/Steps';
import { C, R, SHADOW } from '@/theme/design';

const inlineInput = { backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, textAlign: 'right' as const, fontSize: 19, width: '55%' as const };

export function Step4Address({ settings }: { settings?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const salon = useProSalon().data?.salon ?? null;
  const { createSalon, updateSalon, setPhotos } = useProSalonMutations();
  const draft = readProDraft();
  const [address, setAddress] = useState((settings ? salon?.address : draft.address) ?? '');
  const [wilaya, setWilaya] = useState((settings ? salon?.wilayaCode : draft.wilayaCode) ?? 16);
  const [zone, setZone] = useState((settings ? (salon?.zone ?? salon?.city) : draft.zone) ?? '');
  const [home, setHome] = useState((settings ? salon?.homeService : draft.homeService) ?? false);
  const [phone, setPhone] = useState(settings && salon?.phone ? formatDZPhone(salon.phone) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wilayaSheet, setWilayaSheet] = useState(false);

  if (!settings && (!draft.market || !draft.name)) return <Redirect href={stepPath(1) as never} />;
  if (!session) return <Redirect href={{ pathname: '/connexion', params: { role: 'pro' } } as never} />;

  const submit = async () => {
    if (zone.trim().length < 2) return setError('Indiquez votre quartier.');
    setError(null);
    setBusy(true);
    try {
      if (settings) {
        let normalizedPhone: string | undefined;
        if (phone.trim()) {
          const parsed = phoneDZ.safeParse(phone);
          if (!parsed.success) return setError('Numéro algérien invalide.');
          normalizedPhone = parsed.data;
        }
        await updateSalon.mutateAsync({ wilayaCode: wilaya, city: zone.trim(), zone: zone.trim(), address: address.trim() || undefined, homeService: home, phone: normalizedPhone });
        router.replace('/(pro)/(tabs)/profil-pro');
        return;
      }
      writeProDraft({ address: address.trim(), wilayaCode: wilaya, zone: zone.trim(), homeService: home });
      const market = draft.market!;
      const created = await createSalon.mutateAsync({
        name: draft.name!,
        wilayaCode: wilaya,
        city: zone.trim(),
        zone: zone.trim(),
        address: address.trim() || undefined,
        genderTarget: market,
        categoryIds: [categoriesForMarket(market)[0]!.id],
      });
      const files = draftFiles.get();
      const [coverUrl, logoUrl] = await Promise.all([files.cover ? uploadSalonImage(created.id, files.cover) : null, files.logo ? uploadSalonImage(created.id, files.logo) : null]);
      if (coverUrl) await setPhotos.mutateAsync([{ url: coverUrl }]);
      await updateSalon.mutateAsync({ logoUrl: logoUrl ?? undefined, homeService: home });
      clearProDraft();
      await qc.invalidateQueries({ queryKey: queryKeys.pro.all });
      router.replace(stepPath(5) as never);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen gap={16} footer={<StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onPress={() => void submit()} busy={busy} />}>
      <StepBar step={4} backTo={settings ? '/(pro)/(tabs)/profil-pro' : stepPath(3)} right={settings ? 'Adresse' : undefined} />
      <H1>Où vous trouver ?</H1>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: R.cardSm, borderWidth: 1.5, borderColor: C.ink, paddingVertical: 15, paddingHorizontal: 16 }}>
        <I icon={Search} size={20} color={C.subtle} />
        <Input value={address} onChangeText={setAddress} placeholder="12 rue des Frères Bouadou, Hydra" accessibilityLabel="Adresse" maxLength={200} style={{ flex: 1, backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0, fontSize: 16 }} />
      </View>
      <View style={{ height: 220, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: C.fill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <GridBg step={110} stepY={80} />
        <View style={[{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }, SHADOW.fab]}>
          <I icon={MapPin} size={26} color="#fff" />
        </View>
        <View style={[{ position: 'absolute', left: 24, bottom: 16, maxWidth: '80%', backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 8 }, SHADOW.card]}>
          <Tx size={16} weight={600} lh={20} numberOfLines={1}>
            {address.trim() ? `${address.trim()}${zone ? `, ${zone}` : ''}` : zone || wilayaName(wilaya)}
          </Tx>
        </View>
      </View>
      <ListCard>
        <ValueRow label="Ville" value={wilayaName(wilaya)} onPress={() => setWilayaSheet(true)} />
        <Row py={16} chevron={false} right={<Input value={zone} onChangeText={setZone} placeholder="Hydra" accessibilityLabel="Quartier" maxLength={80} style={inlineInput} />}>
          <Tx size={19} lh={24}>
            Quartier
          </Tx>
        </Row>
        {settings && (
          <Row py={16} chevron={false} right={<Input keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="05 51 23 45 67" accessibilityLabel="Téléphone du salon" style={inlineInput} />}>
            <Tx size={19} lh={24}>
              Téléphone
            </Tx>
          </Row>
        )}
        <Row py={16} chevron={false} right={<Toggle on={home} onChange={setHome} label="Se déplacer à domicile" />}>
          <Tx size={19} lh={24}>
            Se déplacer à domicile
          </Tx>
          <Tx size={15} color={C.muted} lh={20}>
            Prestations hors salon
          </Tx>
        </Row>
      </ListCard>
      {error && <Alert>{error}</Alert>}
      <PickerSheet open={wilayaSheet} onClose={() => setWilayaSheet(false)} title="Ville" options={WILAYAS.map((w) => ({ value: w.code, label: w.name }))} value={wilaya} onChange={setWilaya} />
    </Screen>
  );
}
