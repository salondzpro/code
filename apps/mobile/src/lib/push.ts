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

/**
 * Ré-enregistre le jeton sans rien demander si la permission est déjà accordée (jeton
 * renouvelé, nouvel appareil). Ne déclenche jamais la fenêtre de permission : celle-ci est
 * demandée au bon moment (première réservation confirmée, espace pro).
 */
export async function registerPushIfGranted(api: Api): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null;
  return registerForPushNotifications(api);
}

interface PushData {
  bookingId?: string;
  salonId?: string;
  type?: string;
}

/** Types de notification adressés au salon (les autres vont à la cliente). */
const PRO_TYPES = new Set(['booking_created', 'booking_cancelled', 'booking_rescheduled']);

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
      // Un compte qui possède un salon reçoit les notifs « salon » (nouvelle réservation, annulation
      // ou report par la cliente) → détail pro du rendez-vous ; sinon → détail client.
      const me = queryClient.getQueryData(queryKeys.me) as { salon: unknown } | undefined;
      const toPro = !!me?.salon && !!data.type && PRO_TYPES.has(data.type);
      if (data.bookingId) {
        router.push((toPro ? `/pro-rdv/${data.bookingId}` : `/rdv/${data.bookingId}`) as never);
      } else {
        router.push(
          (toPro ? '/(pro)/(tabs)/reservations' : '/(client)/(tabs)/rendez-vous') as never,
        );
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
