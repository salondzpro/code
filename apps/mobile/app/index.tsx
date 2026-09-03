import React from 'react';
import { Redirect } from 'expo-router';
import { useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components';

/** Aiguillage au lancement : pro avec salon → agenda, sinon espace client. */
export default function Index() {
  const { session, loading } = useAuth();
  const me = useMe(!!session);

  if (loading || (session && me.isLoading)) return <Loading />;
  if (session && me.data?.salon) return <Redirect href="/(pro)/(tabs)/agenda" />;
  return <Redirect href="/(client)/(tabs)" />;
}
