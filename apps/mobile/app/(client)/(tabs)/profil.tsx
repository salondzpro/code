/** C-F 22 — Profil client : identité vérifiée, compteurs, raccourcis, « Devenir professionnel ». */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { useFavorites, useMe, useMyBookings } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { formatIntlDZ } from '@/lib/authFlow';
import { Avatar, Badge, Card, Grid, H1, I, ListCard, P, Row, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { Splash } from '@/ui/Splash';
import { C, NAV_PAD, R } from '@/theme/design';

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const me = useMe();
  const favs = useFavorites();
  const past = useMyBookings({ scope: 'past', limit: 50 });
  const upcoming = useMyBookings({ scope: 'upcoming', limit: 50 });
  if (me.isPending) return <Splash />;
  const p = me.data?.profile;
  const phone = p?.phone ?? (user?.phone ? `+${user.phone.replace(/^\+/, '')}` : null);
  const bookings = (past.data?.items.length ?? 0) + (upcoming.data?.items.length ?? 0);
  const salon = me.data?.salon;

  return (
    <Screen gap={16} bottom={NAV_PAD}>
      <H1 size={34} lh={38} ls={-0.8}>
        Profil
      </H1>
      <Card row gap={16}>
        <Avatar src={p?.avatarUrl} name={p?.fullName ?? 'Moi'} size={120} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={24} weight={700} ls={-0.4} lh={29}>
            {p?.fullName ?? 'Votre nom'}
          </Tx>
          <Tx size={17} color={C.muted} lh={23}>
            {phone ? formatIntlDZ(phone) : user?.email}
          </Tx>
          <View style={{ marginTop: 8 }}>
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
          <Card key={x.l} gap={4} pad={12} style={{ paddingVertical: 20 }}>
            <Tx size={28} weight={700} ls={-0.6} lh={33}>
              {x.v}
            </Tx>
            <Tx size={14} color={C.muted} lh={19} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {x.l}
            </Tx>
          </Card>
        ))}
      </Grid>
      <ListCard>
        <Row to="/favoris">
          <Tx size={19} lh={24}>
            Mes salons favoris
          </Tx>
        </Row>
        <Row onPress={() => router.push({ pathname: '/(client)/(tabs)/rendez-vous', params: { scope: 'past' } })}>
          <Tx size={19} lh={24}>
            Historique
          </Tx>
        </Row>
        <Row to="/reglages">
          <Tx size={19} lh={24}>
            Moyens de contact
          </Tx>
        </Row>
        <Row to="/reglages">
          <Tx size={19} lh={24}>
            Réglages
          </Tx>
        </Row>
      </ListCard>
      <Pressable accessibilityRole="link" onPress={() => router.push(salon ? '/(pro)' : '/pro-bienvenue')} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.fill, borderRadius: R.cardSm, padding: 16 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <I icon={MessageCircle} size={26} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Tx size={20} weight={700} ls={-0.4} lh={25}>
            {salon ? `Gérer ${salon.name}` : 'Devenir professionnel'}
          </Tx>
          <Tx size={16} color={C.muted} lh={22}>
            {salon ? 'Agenda, demandes, page publique' : 'Recevoir des réservations sur votre page'}
          </Tx>
        </View>
        <I icon={ChevronRight} size={20} color={C.disabled} />
      </Pressable>
      <P> </P>
    </Screen>
  );
}
