/** PRO-F 16 — « Tout est prêt » : liste de contrôle, lien public, prévisualiser, publier. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ApiError, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { errorText } from '@/lib/errors';
import { publicHost } from '@/lib/salon';
import { Alert, Badge, Button, H1, I, ListCard, Row, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { StepSheet } from '@/ui/Steps';
import { C, R } from '@/theme/design';

export default function Publish() {
  const router = useRouter();
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <Splash />;
  const withPhotos = salon.services.filter((s) => s.isActive && (s.photos?.length ?? 0) > 0).length;
  const works = salon.photos.length + salon.services.reduce((a, s) => a + (s.photos?.length ?? 0), 0);
  const openDays = salon.openingHours.filter((h) => !h.isClosed).length;
  const items: { label: string; ok: boolean; hint?: string; to: string }[] = [
    { label: 'Établissement et adresse', ok: !!salon.name && !!salon.city, to: '/(pro)/(tabs)/profil-pro' },
    { label: 'Couverture et logo', ok: !!salon.coverUrl && !!salon.logoUrl, hint: !salon.coverUrl ? 'Ajoutez une photo de couverture' : undefined, to: '/(pro)/(tabs)/profil-pro' },
    { label: `${salon.services.filter((s) => s.isActive).length} prestation${salon.services.length > 1 ? 's' : ''}${withPhotos ? ' avec photos' : ''}`, ok: salon.services.some((s) => s.isActive), hint: 'Au moins une prestation active', to: '/onboarding/6' },
    { label: `${works} réalisation${works > 1 ? 's' : ''}`, ok: works > 0, hint: 'Recommandé — améliore votre visibilité', to: '/onboarding/8' },
    { label: 'Horaires et disponibilités', ok: openDays > 0, to: '/onboarding/9' },
    { label: 'Description du salon', ok: !!salon.description, hint: 'Recommandé — améliore votre visibilité', to: '/(pro)/(tabs)/profil-pro' },
  ];

  const publish = async () => {
    setError(null);
    try {
      await updateSalon.mutateAsync({ isPublished: true });
      router.replace('/lien');
    } catch (err) {
      setError(err instanceof ApiError && Array.isArray(err.details) ? (err.details as string[]).join(' · ') : errorText(err));
    }
  };

  return (
    <Screen gap={16} footer={<StepSheet label={salon.isPublished ? 'Page publiée · voir mon lien' : 'Publier ma page'} onPress={() => (salon.isPublished ? router.replace('/lien') : void publish())} busy={updateSalon.isPending} />}>
      <H1 style={{ marginTop: 8 }}>Tout est prêt</H1>
      <ListCard>
        {items.map((it) => (
          <Row key={it.label} py={16} chevron={false} onPress={() => router.push(it.to as never)} accessibilityLabel={it.label} right={it.ok ? <I icon={Check} size={22} color={C.okFg} /> : <Badge tone="pd" dot={false} md>À faire</Badge>}>
            <Tx size={19} lh={24}>
              {it.label}
            </Tx>
            {!it.ok && it.hint && (
              <Tx size={16} color={C.muted} lh={22}>
                {it.hint}
              </Tx>
            )}
          </Row>
        ))}
      </ListCard>
      <View style={{ borderRadius: R.card, backgroundColor: C.ink, padding: 20, gap: 4 }}>
        <Tx size={17} color="rgba(255,255,255,0.6)" lh={22}>
          Votre page publique
        </Tx>
        <Tx size={24} weight={700} color="#fff" ls={-0.4} lh={29}>
          {publicHost()}/s/{salon.slug}
        </Tx>
      </View>
      <Button variant="g" onPress={() => router.push(`/s/${salon.slug}` as never)}>
        Prévisualiser la page
      </Button>
      {error && <Alert>{error}</Alert>}
    </Screen>
  );
}
