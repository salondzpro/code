import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, font, radius, spacing } from '@/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  containerStyle?: ViewStyle;
}

export function TextField({ label, error, hint, containerStyle, style, ...props }: TextFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, props.multiline && styles.multiline, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  multiline: { height: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.size.xs, marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: font.size.xs, marginTop: spacing.xs },
});
