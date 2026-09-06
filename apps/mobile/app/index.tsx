import React from 'react';
import { Redirect } from 'expo-router';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { Splash } from '@/ui/Splash';
import { Screen } from '@/ui/Screen';
import { ErrorText } from '@/ui';

/**
 * Aiguillage au lancement (design AUTH 01 → 02) : sans session → introduction ;
 * profil incomplet → prénom (AUTH 13) ; client sans marché → AUTH 15 ; pro → espace pro ; sinon marketplace.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const me = useMe(!!session);

  if (loading || (session && me.isPending)) return <Splash />;
  if (!session) return <Redirect href="/intro" />;
  if (me.isError)
    return (
      <Screen center>
        <ErrorText error={me.error} retry={() => void me.refetch()} />
      </Screen>
    );
  const p = me.data!.profile;
  if (!p.fullName) return <Redirect href="/profil-creer" />;
  if (p.role === 'pro') return <Redirect href="/(pro)" />;
  if (!p.market) return <Redirect href="/marche" />;
  return <Redirect href="/(client)/(tabs)" />;
}
