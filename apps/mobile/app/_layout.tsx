import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { ApiProvider } from '@salondz/api-client';
import { api } from '@/lib/api';
import { queryClient, setupQueryClientListeners } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { usePushNotificationsListener } from '@/lib/push';
import { hydratePrefs } from '@/lib/prefs';
import { Splash } from '@/ui/Splash';
import { C } from '@/theme/design';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Police du design (Inter 400/500/600/700) ; repli système tant qu'elle n'est pas chargée.
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => setupQueryClientListeners(), []);
  useEffect(() => {
    void hydratePrefs();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider api={api}>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator fontsLoaded={fontsLoaded} />
            </AuthProvider>
          </ApiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { loading } = useAuth();
  usePushNotificationsListener();

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;
  if (loading) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(client)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(pro)" options={{ animation: 'fade' }} />
    </Stack>
  );
}
