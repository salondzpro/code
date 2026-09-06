import React from 'react';
import { Tabs } from 'expo-router';
import { Calendar, Home, Menu, User, Users } from 'lucide-react-native';
import { TabBar } from '@/ui/TabBar';
import { C } from '@/theme/design';

/** Onglets pro du design : Accueil · Agenda · Clients · Équipe · Prestations · Profil. */
export default function ProTabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="equipe" options={{ title: 'Équipe', tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="prestations" options={{ title: 'Prestations', tabBarIcon: ({ color, size }) => <Menu size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="profil-pro" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.6} /> }} />
    </Tabs>
  );
}
