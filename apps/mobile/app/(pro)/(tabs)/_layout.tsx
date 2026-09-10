import React from 'react';
import { Tabs } from 'expo-router';
import { CalendarDays, House, Inbox, Store } from 'lucide-react-native';
import { TabBar } from '@/ui/TabBar';
import { C } from '@/theme/design';

/**
 * Onglets pro réduits à l'essentiel du quotidien : Accueil · Agenda · Réservations (demandes à valider) · Profil.
 * La gestion (Mon salon, Catalogue, Équipe, Clients, Rendez-vous, Compte) passe par Profil.
 */
export default function ProTabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <House size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="reservations" options={{ title: 'Réservations', tabBarIcon: ({ color, size }) => <Inbox size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="profil-pro" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Store size={size} color={color} strokeWidth={1.6} /> }} />
    </Tabs>
  );
}
