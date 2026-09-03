import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@salondz/api-client';
import { colors, font, radius, spacing } from '@/theme/tokens';
import { Button } from './Button';

/** Message FR lisible pour n'importe quelle erreur (ApiError, Error, inconnu). */
export function errorMessage(err: unknown): string {
  if (!err) return '';
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Connectez-vous pour continuer.';
    if (err.status === 403) return err.message || 'Accès refusé.';
    if (err.status === 404) return err.message || 'Introuvable.';
    if (err.code === 'VALIDATION_ERROR') {
      const details = err.details as { path?: string; message?: string }[] | undefined;
      const first = details?.[0];
      return first?.message ? `Champ ${first.path?.replace('/', '') ?? ''} : ${first.message}` : 'Données invalides.';
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Une erreur est survenue.';
}

interface ErrorTextProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorText({ error, onRetry, compact }: ErrorTextProps) {
  const message = errorMessage(error);
  if (!message) return null;
  if (compact) return <Text style={styles.inline}>{message}</Text>;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? <Button title="Réessayer" variant="danger" size="sm" onPress={onRetry} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.sm },
  text: { color: colors.danger, fontSize: font.size.sm },
  inline: { color: colors.danger, fontSize: font.size.sm, marginVertical: spacing.xs },
});
