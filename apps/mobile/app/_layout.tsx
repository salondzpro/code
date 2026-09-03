import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ApiProvider } from '@salondz/api-client';
import { api } from '@/lib/api';
import { queryClient, setupQueryClientListeners } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { usePushNotificationsListener } from '@/lib/push';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => setupQueryClientListeners(), []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider api={api}>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </ApiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { loading } = useAuth();
  usePushNotificationsListener();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(client)" />
      <Stack.Screen name="(pro)" />
      <Stack.Screen name="(auth)/connexion" options={{ presentation: 'modal', headerShown: true, title: 'Connexion' }} />
    </Stack>
  );
}
