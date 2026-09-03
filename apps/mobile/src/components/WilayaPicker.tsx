import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEATURED_WILAYA_CODES, WILAYAS, wilayaName } from '@salondz/constants';
import { colors, font, radius, spacing } from '@/theme/tokens';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

interface WilayaPickerProps {
  value: number | undefined;
  onChange: (code: number | undefined) => void;
  /** Autorise "Toutes les wilayas" (recherche). */
  allowAll?: boolean;
  label?: string;
}

export function WilayaPicker({ value, onChange, allowAll = false, label }: WilayaPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const items = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f ? WILAYAS.filter((w) => w.name.toLowerCase().includes(f) || String(w.code) === f) : WILAYAS;
    // Wilayas principales d'abord
    return [...list].sort((a, b) => {
      const fa = FEATURED_WILAYA_CODES.indexOf(a.code);
      const fb = FEATURED_WILAYA_CODES.indexOf(b.code);
      if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
      return a.code - b.code;
    });
  }, [filter]);

  const select = (code: number | undefined) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.trigger} accessibilityRole="button">
        <Ionicons name="location-outline" size={18} color={colors.primary} />
        <Text style={styles.triggerText}>{value ? `${String(value).padStart(2, '0')} · ${wilayaName(value)}` : allowAll ? 'Toutes les wilayas' : 'Choisir une wilaya'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Sheet visible={open} title="Wilaya" onClose={() => setOpen(false)}>
        <TextField placeholder="Rechercher (ex : Alger, 16)" value={filter} onChangeText={setFilter} autoFocus />
        <FlatList
          data={allowAll ? [{ code: 0, name: 'Toutes les wilayas', nameAr: '' }, ...items] : items}
          keyExtractor={(w) => String(w.code)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable onPress={() => select(item.code === 0 ? undefined : item.code)} style={styles.row}>
              <Text style={[styles.rowText, (item.code || undefined) === value && styles.rowSelected]}>
                {item.code ? `${String(item.code).padStart(2, '0')} · ${item.name}` : item.name}
              </Text>
              {(item.code || undefined) === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: font.size.sm, fontWeight: font.weight.medium, color: colors.text, marginBottom: spacing.xs },
  trigger: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg },
  triggerText: { flex: 1, fontSize: font.size.md, color: colors.text },
  row: { paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: font.size.md, color: colors.text },
  rowSelected: { color: colors.primary, fontWeight: font.weight.semibold },
});
