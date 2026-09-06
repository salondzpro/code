/**
 * Cadre d'écran (design .ph / .bd) : fond écran, marge 20 px, espacement 16 px,
 * feuille basse fixe optionnelle (footer) avec l'espace réservé correspondant.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { C, SHEET_PAD } from '@/theme/design';

export function Screen({
  children,
  footer,
  gap = 16,
  bottom,
  top = 16,
  px = 20,
  scroll = true,
  edges = ['top', 'left', 'right'],
  bg = C.bg,
  refreshing,
  onRefresh,
  style,
  center,
}: {
  children: ReactNode;
  footer?: ReactNode;
  gap?: number;
  bottom?: number;
  top?: number;
  px?: number;
  scroll?: boolean;
  edges?: Edge[];
  bg?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Centre verticalement le contenu (écrans de connexion). */
  center?: boolean;
}) {
  const padBottom = bottom ?? (footer ? SHEET_PAD : 24);
  const content: ViewStyle = { paddingHorizontal: px, paddingTop: top, paddingBottom: padBottom, gap, flexGrow: 1, justifyContent: center ? 'center' : undefined };
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: bg }, style]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} /> : undefined}>
            {children}
          </ScrollView>
        ) : (
          <View style={[content, { flex: 1 }]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
