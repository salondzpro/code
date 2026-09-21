/**
 * Invitation aux notifications, EXPLIQUÉE avant la fenêtre du système.
 *
 * Les notifications sont la raison d'être de l'application : elles remplacent les messages WhatsApp
 * (nouvelle demande, confirmation, rappel). Or la fenêtre du système ne se montre qu'une fois sur iOS ;
 * un refus donné sans avoir compris pourquoi est définitif. On dit donc d'abord ce que la personne va
 * recevoir, puis on déclenche la demande du système seulement si elle accepte.
 *
 * `active` : le bon moment. Pour un professionnel, son espace ; pour un client, dès qu'il a un rendez-vous
 * (jamais à la première ouverture, où la position est déjà demandée : deux demandes d'affilée, ce sont deux
 * refus). Un « Plus tard » n'est pas définitif : on redemande au bout de trois jours.
 */
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell } from 'lucide-react-native';
import { api } from '@/lib/api';
import { registerForPushNotifications, registerPushIfGranted } from '@/lib/push';
import { Button, H2, I, ModalSheet, P } from './index';

const KEY = 'salondz:pushAskedAt';
const RETRY_MS = 3 * 24 * 60 * 60 * 1000;

const COPY = {
  pro: {
    title: 'Recevez vos demandes en direct',
    body: 'Nouvelle demande, annulation, rappel : une notification sur ce téléphone, sans WhatsApp et sans ouvrir l’application.',
  },
  client: {
    title: 'Recevez vos rappels',
    body: 'Confirmation du salon, rappel la veille et 2 h avant : une notification sur ce téléphone, sans appel ni message.',
  },
} as const;

export function PushPrompt({ audience, active }: { audience: 'pro' | 'client'; active: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active || Platform.OS === 'web' || !Device.isDevice) return;
    let cancelled = false;
    void (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        // Déjà autorisé : on rafraîchit le jeton en silence, sans rien montrer.
        await registerPushIfGranted(api);
        return;
      }
      if (!canAskAgain) return; // refusé pour de bon : le système ne redemandera pas, on n'insiste pas
      const askedAt = Number(await AsyncStorage.getItem(KEY)) || 0;
      if (Date.now() - askedAt < RETRY_MS) return;
      if (!cancelled) setOpen(true);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active]);

  const later = () => {
    setOpen(false);
    void AsyncStorage.setItem(KEY, String(Date.now())).catch(() => undefined);
  };
  const accept = () => {
    later();
    registerForPushNotifications(api).catch((err) => console.warn('[push]', err));
  };

  const copy = COPY[audience];
  return (
    <ModalSheet open={open} onClose={later}>
      <I icon={Bell} size={28} />
      <H2>{copy.title}</H2>
      <P>{copy.body}</P>
      <Button onPress={accept}>Activer les notifications</Button>
      <Button variant="g" onPress={later}>
        Plus tard
      </Button>
    </ModalSheet>
  );
}
