import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMarkNotificationsRead, useMe, useNotifications, useUpdateProfile } from '@salondz/api-client';
import { updateProfileSchema } from '@salondz/validation';
import { formatDateShortDZ, formatTimeDZ } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { Button, EmptyState, ErrorText, Loading, Screen, Section, TextField, Title, errorMessage } from '@/components';
import { colors, font, radius, spacing } from '@/theme/tokens';

export default function Compte() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const me = useMe(!!session);
  const notifications = useNotifications(!!session);
  const markRead = useMarkNotificationsRead();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setFullName(me.data.profile.fullName ?? '');
      setPhone(me.data.profile.phone ?? '');
    }
  }, [me.data]);

  if (!session) {
    return (
      <Screen>
        <Title>Mon compte</Title>
        <EmptyState
          icon="person-outline"
          title="Vous n'êtes pas connecté"
          description="Connectez-vous pour réserver plus vite et suivre vos rendez-vous."
          actionLabel="Se connecter"
          onAction={() => router.push({ pathname: '/connexion', params: { redirect: '/(client)/(tabs)/compte' } } as never)}
        />
        <Button title="Je suis un professionnel" variant="secondary" onPress={() => router.push({ pathname: '/connexion', params: { role: 'pro', redirect: '/(pro)' } } as never)} />
      </Screen>
    );
  }

  if (me.isLoading) return <Loading />;
  if (me.isError) return <Screen><ErrorText error={me.error} onRetry={() => void me.refetch()} /></Screen>;

  const save = () => {
    const parsed = updateProfileSchema.safeParse({ fullName: fullName.trim() || undefined, phone: phone.trim() || null });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? 'Données invalides');
    setFormError(null);
    updateProfile.mutate(parsed.data, {
      onSuccess: () => Alert.alert('Profil enregistré'),
      onError: (e) => setFormError(errorMessage(e)),
    });
  };

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <Screen scroll refreshing={me.isRefetching} onRefresh={() => void me.refetch()}>
      <Title>Mon compte</Title>
      <Text style={styles.email}>{session.user.email}</Text>

      <Section title="Mes informations">
        <TextField label="Nom complet" value={fullName} onChangeText={setFullName} placeholder="Ex : Amine Benali" />
        <TextField label="Téléphone" value={phone} onChangeText={setPhone} placeholder="05 51 23 45 67" keyboardType="phone-pad" hint="Le salon peut vous appeler en cas d'imprévu." />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Button title="Enregistrer" onPress={save} loading={updateProfile.isPending} />
      </Section>

      <Section
        title={`Notifications${unread ? ` (${unread})` : ''}`}
        right={unread ? <Button title="Tout lire" variant="ghost" size="sm" onPress={() => markRead.mutate(undefined)} /> : undefined}
      >
        {notifications.isLoading ? (
          <Loading inline />
        ) : (notifications.data?.items.length ?? 0) === 0 ? (
          <Text style={styles.muted}>Aucune notification pour le moment.</Text>
        ) : (
          notifications.data!.items.slice(0, 10).map((n) => (
            <View key={n.id} style={[styles.notif, !n.readAt && styles.notifUnread]}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifBody}>{n.body}</Text>
              <Text style={styles.notifDate}>
                {formatDateShortDZ(n.createdAt)} · {formatTimeDZ(n.createdAt)}
              </Text>
            </View>
          ))
        )}
      </Section>

      <Section title="Mes salons">
        <Pressable style={styles.row} onPress={() => router.push('/(client)/favoris' as never)}>
          <Ionicons name="heart-outline" size={20} color={colors.primary} />
          <Text style={styles.rowText}>Mes favoris</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Section>

      <Section title="Espace professionnel">
        <Pressable
          style={styles.row}
          onPress={() => router.push((me.data?.salon ? '/(pro)/(tabs)/agenda' : '/(pro)/onboarding') as never)}
        >
          <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
          <Text style={styles.rowText}>{me.data?.salon ? `Gérer ${me.data.salon.name}` : 'Vous êtes coiffeur / barbier ? Créez votre salon'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Section>

      <Button title="Se déconnecter" variant="danger" onPress={() => void signOut()} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.textMuted, marginTop: -spacing.sm },
  error: { color: colors.danger, fontSize: font.size.sm, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: font.size.sm },
  notif: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm },
  notifUnread: { backgroundColor: colors.primarySoft },
  notifTitle: { fontWeight: font.weight.semibold, color: colors.text },
  notifBody: { color: colors.text, fontSize: font.size.sm, marginTop: 2 },
  notifDate: { color: colors.textMuted, fontSize: font.size.xs, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  rowText: { flex: 1, color: colors.text, fontSize: font.size.md },
});
