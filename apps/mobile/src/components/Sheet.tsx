import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Feuille modale bas d'écran (formulaires rapides). */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrapper}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '90%', paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: font.size.lg, fontWeight: font.weight.bold, color: colors.text },
  content: { padding: spacing.lg },
});
