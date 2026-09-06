/** C-F 20 — Noter la prestation : étoiles, « Ce qui vous a plu », commentaire, publication sous prénom + initiale. */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useBooking, useCreateReview, useMe } from '@salondz/api-client';
import { formatDA } from '@salondz/constants';
import { dayMonth } from '@/lib/salon';
import { Avatar, BottomSheet, Button, Card, ErrorText, Field, H1, Input, P, Pill, SectionLabel, Toggle, TopBar, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

const TAGS = ['Ponctualité', 'Hygiène', 'Accueil', 'Résultat', 'Rapport qualité-prix'];

export default function Rate() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const me = useMe();
  const review = useCreateReview();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [publish, setPublish] = useState(true);

  if (booking.isPending) return <Splash />;
  if (booking.isError)
    return (
      <Screen center>
        <ErrorText error={booking.error} retry={() => void booking.refetch()} />
      </Screen>
    );
  const b = booking.data;
  const name = me.data?.profile.fullName ?? '';
  const initials = name ? `${name.split(' ')[0]} ${(name.split(' ')[1] ?? '').charAt(0)}${name.split(' ')[1] ? '.' : ''}`.trim() : 'vous';
  const backToPast = () => router.replace({ pathname: '/(client)/(tabs)/rendez-vous', params: { scope: 'past' } });

  const send = async () => {
    const text = [tags.length ? tags.join(' · ') : '', comment.trim()].filter(Boolean).join(' — ');
    await review.mutateAsync({ bookingId: b.id, rating, comment: text || undefined });
    backToPast();
  };

  return (
    <Screen
      gap={16}
      footer={
        <BottomSheet>
          <Button disabled={!rating || review.isPending} loading={review.isPending} onPress={() => void send()}>
            Envoyer mon avis
          </Button>
        </BottomSheet>
      }
    >
      <TopBar
        backTo="/(client)/(tabs)/rendez-vous"
        right={
          <Pressable accessibilityRole="button" onPress={backToPast}>
            <Tx size={17} color={C.muted} lh={22}>
              Passer
            </Tx>
          </Pressable>
        }
      />
      <H1>Comment s'est passée{'\n'}votre visite ?</H1>
      <Card row gap={14}>
        <Avatar src={b.salon.coverUrl} name={b.salon.name} size={88} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={22} weight={700} ls={-0.4} lh={27}>
            {b.salon.name}
          </Tx>
          <Tx size={17} color={C.muted} lh={23}>
            {dayMonth(b.startsAt)} · {b.serviceName} · {formatDA(b.priceDa)}
          </Tx>
        </View>
      </Card>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', gap: 16 }} accessibilityRole="radiogroup" accessibilityLabel="Note">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: rating === n }} accessibilityLabel={`${n} sur 5`} onPress={() => setRating(n)}>
              <Star size={44} strokeWidth={1.6} color={n <= rating ? C.ink : C.disabled} fill={n <= rating ? C.ink : 'none'} />
            </Pressable>
          ))}
        </View>
        <Tx size={18} color={C.muted} lh={23}>
          {rating ? `${rating} sur 5` : 'Touchez une étoile'}
        </Tx>
      </View>
      <SectionLabel>Ce qui vous a plu</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {TAGS.map((t) => (
          <Pill key={t} lg on={tags.includes(t)} onPress={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}>
            {t}
          </Pill>
        ))}
      </View>
      <Field label="Commentaire (optionnel)">
        <Input multiline value={comment} onChangeText={setComment} maxLength={600} placeholder="Très bon travail, salon impeccable. Un peu d'attente à l'arrivée." />
      </Field>
      <Card row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={18} lh={23}>
            Publier sous « {initials} »
          </Tx>
          <P>Votre numéro reste privé</P>
        </View>
        <Toggle on={publish} onChange={setPublish} label="Publier sous mon prénom" />
      </Card>
      <ErrorText error={review.error} />
    </Screen>
  );
}
