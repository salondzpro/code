/** C-F 22 — Profil client : identité vérifiée, compteurs, raccourcis, « Devenir professionnel ». */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, MessageCircle } from 'lucide-react-native';
import { useFavorites, useMe, useMyBookings, useUpdateProfile } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ } from '@/lib/authFlow';
import { Alert, Avatar, Badge, Card, Grid, H1, I, ListCard, P, Row, Tx } from '@/ui';
import { BrandFooter } from '@/ui/BrandFooter';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD, R } from '@/theme/design';
import { pickAndUploadAvatar } from '@/lib/upload';
import { errorText } from '@/lib/errors';

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useMe();
  const favs = useFavorites();
  const past = useMyBookings({ scope: 'past', limit: 50 });
  const upcoming = useMyBookings({ scope: 'upcoming', limit: 50 });
  const updateProfile = useUpdateProfile();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changeAvatar = async () => {
    if (!user) return;
    setError(null);
    try {
      setAvatarBusy(true);
      const url = await pickAndUploadAvatar(user.id);
      if (url) await updateProfile.mutateAsync({ avatarUrl: url });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setAvatarBusy(false);
    }
  };
  if (me.isPending) return <Splash />;
  const p = me.data?.profile;
  const phone = p?.phone ?? (user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null);
  const bookings = (past.data?.items.length ?? 0) + (upcoming.data?.items.length ?? 0);
  const salon = me.data?.salon;

  return (
    <Screen gap={13} bottom={NAV_PAD}>
      <H1 size={23} lh={26} ls={-0.8}>
        Profil
      </H1>
      <Card row gap={13}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer la photo de profil"
          disabled={avatarBusy}
          onPress={() => void changeAvatar()}
        >
          <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={97.5} />
          <View
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: C.ink,
              borderWidth: 2,
              borderColor: C.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <I icon={Camera} size={12} color={C.onInk} />
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={16} weight={700} ls={-0.4} lh={20.5}>
            {p?.fullName ?? 'Votre nom'}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {phone ? formatIntlDZ(phone) : user?.email}
          </Tx>
          <View style={{ marginTop: 6 }}>
            <Badge tone="ok" md>
              {phone ? 'Numéro vérifié' : 'Adresse vérifiée'}
            </Badge>
          </View>
        </View>
      </Card>
      <Grid cols={3}>
        {[
          { v: String(bookings), l: 'réservations' },
          { v: String(favs.data?.items.length ?? 0), l: 'favoris' },
          { v: '—', l: 'note donnée' },
        ].map((x) => (
          <Card key={x.l} gap={3} pad={12} style={{ paddingVertical: 16 }}>
            <Tx size={19.5} weight={700} ls={-0.6} lh={23.5}>
              {x.v}
            </Tx>
            <Tx
              size={11.5}
              color={C.muted}
              lh={15.5}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {x.l}
            </Tx>
          </Card>
        ))}
      </Grid>
      <ListCard>
        <Row to="/favoris">
          <Tx size={12} lh={16}>
            Mes salons favoris
          </Tx>
        </Row>
        <Row
          onPress={() =>
            router.push({ pathname: '/(client)/(tabs)/rendez-vous', params: { scope: 'past' } })
          }
        >
          <Tx size={12} lh={16}>
            Historique
          </Tx>
        </Row>
        <Row to="/reglages">
          <Tx size={12} lh={16}>
            Moyens de contact
          </Tx>
        </Row>
        <Row to="/reglages">
          <Tx size={12} lh={16}>
            Réglages
          </Tx>
        </Row>
      </ListCard>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(salon ? '/(pro)' : '/pro-bienvenue')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: C.fill,
          borderRadius: R.cardSm,
          padding: 13,
        }}
      >
        <View
          style={{
            width: 55,
            height: 55,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <I icon={MessageCircle} size={21} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={13} weight={700} ls={-0.4} lh={17}>
            {salon ? `Gérer ${salon.name}` : 'Devenir professionnel'}
          </Tx>
          <Tx size={10.5} color={C.muted} lh={15.5}>
            {salon ? 'Agenda, demandes, page publique' : 'Recevoir des réservations sur votre page'}
          </Tx>
        </View>
        <I icon={ChevronRight} size={16} color={C.disabled} />
      </Pressable>
      {error && <Alert>{error}</Alert>}
      <BrandFooter />
    </Screen>
  );
}
