import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  /** Contenu défilant (ScrollView) — sinon View plein écran (pour les FlatList). */
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  backgroundColor?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  style,
  refreshing,
  onRefresh,
  backgroundColor = colors.bg,
}: ScreenProps) {
  const inner = [padded && styles.padded, style];
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, ...inner]}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, ...inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
});
