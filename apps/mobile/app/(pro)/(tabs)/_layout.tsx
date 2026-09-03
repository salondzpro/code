import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProPendingBookings } from '@salondz/api-client';
import { colors } from '@/theme/tokens';

export default function ProTabsLayout() {
  const pending = useProPendingBookings();
  const count = pending.data?.items.length ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="agenda" options={{ title: 'Agenda', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
      <Tabs.Screen
        name="demandes"
        options={{
          title: 'Demandes',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent },
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="salon" options={{ title: 'Mon salon', tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
