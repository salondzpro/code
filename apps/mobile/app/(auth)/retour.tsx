/** AUTH 14 — Retour dans l'app, session conservée : « Bon retour, Inès ». */
import React from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, RefreshCw } from 'lucide-react-native';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, formatIntlDZ, readAuthFlow, resolveNext } from '@/lib/authFlow';
import { Avatar, Badge, Button, H1, I, ListCard, P, Row, Tx } from '@/ui';
import { Screen } from '@/ui/Screen';
import { C } from '@/theme/design';

export default function WelcomeBack() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { session, user, signOut } = useAuth();
  const me = useMe(!!session);
  if (!session) return <Redirect href="/connexion" />;

  const profile = me.data?.profile;
  const firstName = (profile?.fullName ?? '').split(' ')[0] || 'vous';
  const contact = user?.phone ? formatIntlDZ(`+${user.phone.replace(/^\+/, '')}`) : profile?.phone ? formatIntlDZ(profile.phone) : user?.email;
  const next = params.next ?? readAuthFlow().next ?? (profile?.role === 'pro' ? '/pro' : '/');

  const proceed = () => {
    if (!profile?.fullName) return router.replace({ pathname: '/profil-creer', params: { next } });
    if (profile.role !== 'pro' && !profile.market) return router.replace({ pathname: '/marche', params: { next } });
    router.replace(resolveNext(next) as never);
  };

  return (
    <Screen center gap={16}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Avatar src={profile?.avatarUrl ?? DESIGN_IMAGES.welcomeBack.src} name={firstName} size={96} />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <H1 center>Bon retour, {firstName}</H1>
          <P center>{contact}</P>
        </View>
        <Badge tone="ok" md>
          Session active · aucun code requis
        </Badge>
      </View>
      <P center>Votre session reste ouverte tant que vous ne vous déconnectez pas — sur l'application comme sur le navigateur.</P>
      <ListCard>
        <Row onPress={proceed} chevron={false} right={<I icon={ChevronRight} size={18} color={C.disabled} />}>
          <Tx size={16} weight={500} lh={21}>
            Continuer comme {firstName}
          </Tx>
        </Row>
        <Row
          onPress={async () => {
            await signOut();
            router.replace('/connexion');
          }}
          chevron={false}
          right={<I icon={RefreshCw} size={18} color={C.disabled} />}
        >
          <Tx size={16} lh={21}>
            Utiliser un autre numéro
          </Tx>
        </Row>
      </ListCard>
      <Button onPress={proceed}>Continuer</Button>
    </Screen>
  );
}
