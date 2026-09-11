import type React from 'react';
/**
 * Cadre d'écran (design .ph / .bd) : fond écran, marge 20 px, espacement 16 px,
 * feuille basse fixe optionnelle (footer) avec l'espace réservé correspondant.
 */
import { useCallback, useRef, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  onTouchStart,
  onTouchEnd,
  scrollRef,
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
  onTouchStart?: (e: GestureResponderEvent) => void;
  onTouchEnd?: (e: GestureResponderEvent) => void;
  scrollRef?: React.Ref<ScrollView>;
}) {
  // Chaque ecran s'ouvre en haut, sur sa premiere section. Un ecran qui pilote lui-meme sa position
  // (agenda centre sur l'heure) passe `scrollRef` et garde la main.
  const innerRef = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      if (scrollRef) return;
      innerRef.current?.scrollTo({ y: 0, animated: false });
    }, [scrollRef]),
  );
  const padBottom = bottom ?? (footer ? SHEET_PAD : 24);
  const content: ViewStyle = {
    paddingHorizontal: px,
    paddingTop: top,
    paddingBottom: padBottom,
    gap,
    flexGrow: 1,
    justifyContent: center ? 'center' : undefined,
  };
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: bg }, style]}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {scroll ? (
          <ScrollView
            ref={scrollRef ?? innerRef}
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.ink} />
              ) : undefined
            }
          >
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
