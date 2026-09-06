import React from 'react';
import { Tabs } from 'expo-router';
import { Calendar, LayoutGrid, User } from 'lucide-react-native';
import { TabBar } from '@/ui/TabBar';
import { C } from '@/theme/design';

/** Onglets client du design : Marketplace · Rendez-vous · Profil. */
export default function ClientTabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Marketplace', tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="rendez-vous" options={{ title: 'Rendez-vous', tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <User size={size} color={color} strokeWidth={1.6} /> }} />
    </Tabs>
  );
}
