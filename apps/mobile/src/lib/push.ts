import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@salondz/api-client';
import type { Api } from './api';

// Affichage des notifications quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'bookings';

function getProjectId(): string | null {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | null)?.projectId ??
    null;
  if (!id || id === 'REPLACE_WITH_EAS_PROJECT_ID') return null;
  return id;
}

/**
 * Demande la permission, récupère le jeton Expo Push et l'enregistre côté API.
 * Retourne le jeton, ou null (simulateur, refus, projectId EAS absent).
 */
export async function registerForPushNotifications(api: Api): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Réservations',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[push] extra.eas.projectId manquant dans app.json — lancez `eas init`.');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.me.registerPushToken({
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceName: Device.modelName ?? undefined,
  });
  return token;
}

interface PushData {
  bookingId?: string;
  salonId?: string;
  type?: string;
}

/** Réagit aux notifications : rafraîchit les données, navigue au tap. */
export function usePushNotificationsListener() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myBookingsAll });
      void queryClient.invalidateQueries({ queryKey: queryKeys.pro.all });
    };

    const navigate = (data: PushData | undefined) => {
      if (!data) return;
      const proTypes = new Set(['booking_created', 'booking_cancelled']);
      // Les notifs "pro" (nouvelle demande / annulation client) mènent à l'espace pro,
      // les autres (confirmation, rappel…) à l'historique client.
      if (data.type && proTypes.has(data.type) && data.salonId) {
        router.push('/(pro)/(tabs)/demandes');
      } else {
        router.push('/(client)/(tabs)/reservations');
      }
    };

    const received = Notifications.addNotificationReceivedListener(refresh);
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      refresh();
      navigate(response.notification.request.content.data as PushData | undefined);
    });

    // Démarrage à froid depuis une notification
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigate(response.notification.request.content.data as PushData | undefined);
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient, router]);
}
