import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/tokens';

export default function ClientTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Explorer', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="reservations"
        options={{ title: 'Réservations', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: 'Compte', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
