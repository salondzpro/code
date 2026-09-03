import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, font, radius, spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const bgByVariant: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.primarySoft,
  ghost: 'transparent',
  danger: colors.dangerSoft,
};
const fgByVariant: Record<Variant, string> = {
  primary: colors.textOnPrimary,
  secondary: colors.primaryDark,
  ghost: colors.primary,
  danger: colors.danger,
};
const heightBySize: Record<Size, number> = { sm: 36, md: 46, lg: 54 };

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, style, fullWidth }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bgByVariant[variant], height: heightBySize[size], opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fgByVariant[variant]} />
      ) : (
        <Text style={[styles.label, { color: fgByVariant[variant], fontSize: size === 'sm' ? font.size.sm : font.size.md }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { alignSelf: 'stretch' },
  label: { fontWeight: font.weight.semibold },
});
