/**
 * Primitives UI natives — reproduction fidèle des classes du design « App Beaute Hi-Fi »
 * (mêmes cotes que apps/web/src/styles/index.css). Aucune couleur ni rayon en dur hors theme/design.
 */
import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Pressable, StyleSheet, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, Info, Search, X, type LucideIcon } from 'lucide-react-native';
import type { BookingStatus } from '@salondz/constants';
import { C, R, SHADOW } from '@/theme/design';
import { H2, P, S, T3, Tx, fontFor } from './Text';

export { H1, H2, H3, P, S, T3, Tx } from './Text';

/** Icône aux réglages du design : 22 px, trait 1.6. */
export function I({ icon: Icon, size = 22, color = C.text }: { icon: LucideIcon; size?: number; color?: string }) {
  return <Icon size={size} color={color} strokeWidth={size <= 16 ? 1.7 : 1.6} />;
}

// ---------- Boutons ----------
type Variant = 'ink' | 'g' | 'd';
export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: Variant;
  sm?: boolean;
  auto?: boolean;
  pill?: boolean;
  loading?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  bg?: string;
}

export function Button({ variant = 'ink', sm, auto, pill, loading, disabled, children, style, textColor, bg, ...props }: ButtonProps) {
  const off = !!disabled || !!loading;
  const background = bg ?? (off ? C.fill : variant === 'ink' ? C.ink : C.surface);
  const fg = textColor ?? (off ? C.subtle : variant === 'ink' ? C.onInk : variant === 'd' ? C.danger : C.text);
  const border = off ? 'transparent' : variant === 'g' ? C.line : variant === 'd' ? C.dangerLine : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: auto || pill ? 'flex-start' : 'stretch',
          backgroundColor: background,
          borderWidth: 1,
          borderColor: border,
          borderRadius: pill ? R.pill : sm ? 14 : R.btn,
          paddingVertical: pill ? 10 : sm ? 11 : 16,
          paddingHorizontal: pill ? 18 : sm ? 14 : 16,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : typeof children === 'string' ? (
        <Tx size={pill ? 15 : sm ? 14 : 16} weight={600} color={fg} ls={-0.2} center>
          {children}
        </Tx>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton({ ink, lg, children, style, ...props }: Omit<PressableProps, 'style'> & { ink?: boolean; lg?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const size = lg ? 44 : 40;
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: ink ? C.ink : C.surface, borderWidth: 1, borderColor: ink ? C.ink : C.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function BackButton({ to, close, label }: { to?: string; close?: boolean; label?: string }) {
  const router = useRouter();
  const go = () => {
    if (to) router.replace(to as never);
    else if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  };
  return (
    <IconButton lg accessibilityLabel={label ?? (close ? 'Fermer' : 'Retour')} onPress={go}>
      <I icon={close ? X : ChevronLeft} />
    </IconButton>
  );
}

/** En-tête d'écran : bouton rond à gauche, texte ou nœud à droite (« Étape 1 sur 3 »). */
export function TopBar({ backTo, close, right, noBack }: { backTo?: string; close?: boolean; right?: ReactNode; noBack?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      {noBack ? <View /> : <BackButton to={backTo} close={close} />}
      {typeof right === 'string' ? <Tx size={15} color={C.muted}>{right}</Tx> : (right ?? null)}
    </View>
  );
}

// ---------- Pastilles / badges / créneaux ----------
export function Pill({ on, lg, soft, children, style, ...props }: Omit<PressableProps, 'style' | 'children'> & { on?: boolean; lg?: boolean; soft?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const color = on ? C.onInk : lg || soft ? C.text : C.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      {...props}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          borderRadius: R.pill,
          paddingVertical: lg ? 13 : 9,
          paddingHorizontal: lg ? 18 : 13,
          backgroundColor: on ? C.ink : soft ? C.fill : C.surface,
          borderWidth: 1,
          borderColor: on ? C.ink : soft ? 'transparent' : C.line,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Tx size={lg ? 16 : 13.5} weight={500} color={color} lh={lg ? 20 : 17}>
          {children}
        </Tx>
      ) : (
        children
      )}
    </Pressable>
  );
}

export type BadgeTone = 'ok' | 'pd' | 'cn' | 'nu';
const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  ok: { bg: C.okBg, fg: C.okFg },
  pd: { bg: C.pendingBg, fg: C.pendingFg },
  cn: { bg: C.cancelBg, fg: C.cancelFg },
  nu: { bg: C.fill, fg: C.muted },
};
export function Badge({ tone, dot = true, md, children }: { tone: BadgeTone; dot?: boolean; md?: boolean; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: R.pill, backgroundColor: t.bg, paddingVertical: md ? 6 : 4, paddingHorizontal: md ? 12 : 10 }}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} />}
      <Tx size={md ? 13 : 11} weight={600} color={t.fg} lh={md ? 17 : 14}>
        {children}
      </Tx>
    </View>
  );
}

const STATUS: Record<BookingStatus, { tone: BadgeTone; label: string; dot: boolean }> = {
  confirmed: { tone: 'ok', label: 'Confirmé', dot: true },
  pending: { tone: 'pd', label: 'En attente', dot: true },
  cancelled: { tone: 'cn', label: 'Annulé', dot: true },
  completed: { tone: 'nu', label: 'Terminé', dot: false },
  no_show: { tone: 'nu', label: 'Absent', dot: false },
};
export function StatusBadge({ status, md }: { status: BookingStatus; md?: boolean }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} dot={s.dot} md={md}>
      {s.label}
    </Badge>
  );
}

export function Slot({ on, off, children, style, ...props }: Omit<PressableProps, 'style' | 'children'> & { on?: boolean; off?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!off }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        { borderWidth: 1, borderColor: on ? C.ink : off ? 'transparent' : C.line, backgroundColor: on ? C.ink : off ? C.fill : C.surface, borderRadius: R.slot, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Tx size={15} weight={500} color={on ? C.onInk : off ? C.disabled : C.text} mono>
          {children}
        </Tx>
      ) : (
        children
      )}
    </Pressable>
  );
}

// ---------- Champs ----------
export interface InputProps extends TextInputProps {
  err?: boolean;
  lg?: boolean;
  /** Bordure encre forcée (champ rempli, design .f). */
  f?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}
export function Input({ err, lg, f, style, onFocus, onBlur, multiline, ...props }: InputProps) {
  const [focus, setFocus] = useState(false);
  const active = focus || f;
  return (
    <TextInput
      placeholderTextColor={C.subtle}
      selectionColor={C.ink}
      {...props}
      multiline={multiline}
      onFocus={(e) => {
        setFocus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        onBlur?.(e);
      }}
      style={[
        {
          backgroundColor: err || active ? C.surface : C.fill,
          borderWidth: 1.5,
          borderColor: err ? C.danger : active ? C.ink : 'transparent',
          borderRadius: R.input,
          paddingVertical: lg ? 18 : 15,
          paddingHorizontal: lg ? 16 : 15,
          fontSize: lg ? 17 : 15,
          fontFamily: fontFor(400),
          color: C.text,
          minHeight: multiline ? 96 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
          minWidth: 0,
          flexShrink: 1,
        },
        WEB_NO_OUTLINE,
        style,
      ]}
    />
  );
}

/** Sur le web (react-native-web), la bordure encre signale déjà le focus : pas d'anneau navigateur. */
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null;

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <View>
      <Tx size={13} color={C.muted} lh={18} style={{ marginBottom: 6 }}>
        {label}
      </Tx>
      {children}
      {error ? (
        <Tx size={13} color={C.danger} lh={18} style={{ marginTop: 6 }} accessibilityRole="alert">
          {error}
        </Tx>
      ) : hint ? (
        <T3 style={{ marginTop: 6 }}>{hint}</T3>
      ) : null}
    </View>
  );
}

export function SearchBox({ value, onChange, placeholder, onSubmit, autoFocus, outlined }: { value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void; autoFocus?: boolean; outlined?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: outlined ? C.surface : C.fill, borderRadius: R.cardSm, paddingVertical: 15, paddingHorizontal: 16, borderWidth: outlined ? 1.5 : 0, borderColor: C.ink }}>
      <I icon={Search} size={22} color={C.subtle} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.subtle}
        accessibilityLabel={placeholder}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={[{ flex: 1, minWidth: 0, fontSize: 16, fontFamily: fontFor(400), color: C.text, padding: 0 }, WEB_NO_OUTLINE]}
      />
    </View>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => onChange(!on)} style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? C.green : C.line, padding: 3 }}>
      <View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', transform: [{ translateX: on ? 20 : 0 }] }, SHADOW.knob]} />
    </Pressable>
  );
}

export function Checkbox({ on, onChange, label }: { on: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onChange ? () => onChange(!on) : undefined} style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.surface, alignItems: 'center', justifyContent: 'center' }}>
      {on && <I icon={Check} size={16} color="#fff" />}
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: C.fill, borderRadius: 16, padding: 5, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[{ flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', backgroundColor: on ? C.surface : 'transparent' }, on && SHADOW.seg]}>
            <Tx size={16} weight={on ? 600 : 500} color={on ? C.text : C.muted} lh={20}>
              {o.label}
            </Tx>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Surfaces ----------
export function Card({ sm, sel, row, gap, pad, onPress, children, style, accessibilityLabel }: { sm?: boolean; sel?: boolean; row?: boolean; gap?: number; pad?: number; onPress?: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const base: ViewStyle = {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: sel ? C.ink : C.line,
    borderRadius: sm ? R.cardSm : R.card,
    padding: pad ?? (sm ? 14 : 16),
    gap: gap ?? 12,
    flexDirection: row ? 'row' : 'column',
    alignItems: row ? 'center' : undefined,
    overflow: 'hidden',
  };
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: !!sel }} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[base, style]}>{children}</View>;
}

/** Surface douce (design .sf). */
export function Soft({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.fill, borderRadius: R.cardSm, padding: 14 }, style]}>{children}</View>;
}

/** Encadré d'information gris avec l'icône ⓘ. */
export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <Soft style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ marginTop: 2 }}>
        <I icon={Info} size={18} color={C.muted} />
      </View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Tx size={15} color={C.muted} lh={22}>{children}</Tx> : children}</View>
    </Soft>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Tx size={12} weight={600} color={C.subtle} ls={0.96} lh={16} upper>
        {children}
      </Tx>
      {right}
    </View>
  );
}

/** Ligne de liste (design .li) : à utiliser dans <Rows> pour les séparateurs. */
export function Row({ to, onPress, children, right, chevron, py = 14, style, accessibilityLabel }: { to?: string; onPress?: () => void; children: ReactNode; right?: ReactNode; chevron?: boolean; py?: number; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const router = useRouter();
  const press = to ? () => router.push(to as never) : onPress;
  const inner = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {right}
      {(chevron ?? (!!to || !!onPress)) && <I icon={ChevronRight} size={18} color={C.disabled} />}
    </>
  );
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: py };
  if (press)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={press} style={({ pressed }) => [base, { opacity: pressed ? 0.7 : 1 }, style]}>
        {inner}
      </Pressable>
    );
  return <View style={[base, style]}>{inner}</View>;
}

/** Empile des lignes avec un séparateur ligne-douce entre elles (dernière sans bordure). */
export function Rows({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {items.map((c, i) => (
        <View key={i} style={i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.lineSoft } : undefined}>
          {c}
        </View>
      ))}
    </View>
  );
}

/** Carte-liste (design .crd avec gap 0 et padding vertical 4). */
export function ListCard({ children, style, px = 16 }: { children: ReactNode; style?: StyleProp<ViewStyle>; px?: number }) {
  return (
    <View style={[{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, paddingVertical: 4, paddingHorizontal: px }, style]}>
      <Rows>{children}</Rows>
    </View>
  );
}

export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden>
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Tx size={Math.round(size / 2.6)} weight={600} color={C.muted} lh={Math.round(size / 2.2)}>
          {name.trim().charAt(0).toUpperCase()}
        </Tx>
      )}
    </View>
  );
}

export function Img({ src, style, radius = R.img, children }: { src?: string | null; style?: StyleProp<ViewStyle>; radius?: number; children?: ReactNode }) {
  return (
    <View style={[{ backgroundColor: C.line, borderRadius: radius, overflow: 'hidden' }, style]}>
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      {children}
    </View>
  );
}

/** Dégradé sombre du bas (design .ovl) à poser en absolu sur une image. */
export function Overlay() {
  return <LinearGradient colors={['rgba(15,16,17,0)', 'rgba(15,16,17,0.28)', 'rgba(15,16,17,0.72)']} locations={[0.28, 0.58, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

/** Crédit photo (coin bas gauche des visuels du design). */
export function Credit({ children }: { children: string }) {
  return (
    <View style={{ position: 'absolute', left: 12, bottom: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Tx size={10} color="rgba(255,255,255,0.8)" lh={13}>
        {children}
      </Tx>
    </View>
  );
}

// ---------- Superpositions ----------
/** Feuille basse fixe (design .sheet) — à passer en `footer` de <Screen>. */
export function BottomSheet({ children, grab = true, style }: { children: ReactNode; grab?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20 + insets.bottom, gap: 14 }, SHADOW.sheet, style]}>
      {grab && <Grab />}
      {children}
    </View>
  );
}

export function Grab() {
  return <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginBottom: 4 }} />;
}

/** Feuille modale (voile + feuille) pour les confirmations et sélections. */
export function ModalSheet({ open, onClose, children, grab = true, scroll }: { open: boolean; onClose: () => void; children: ReactNode; grab?: boolean; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.dim }]} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <View style={[{ backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20 + insets.bottom, gap: 14, maxHeight: '88%' }, SHADOW.sheet]}>
          {grab && <Grab />}
          {scroll ? <Animated.ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">{children}</Animated.ScrollView> : children}
        </View>
      </View>
    </Modal>
  );
}

export function Toast({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="alert" style={[{ position: 'absolute', top: 16 + insets.top, left: 20, right: 20, backgroundColor: C.ink, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, SHADOW.toast]}>
      {Icon && <I icon={Icon} size={18} color="#fff" />}
      <Tx size={14} weight={500} color="#fff" lh={18} style={{ flex: 1 }}>
        {children}
      </Tx>
    </View>
  );
}

export function Skeleton({ h = 20, w, radius = 8, style }: { h?: number; w?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const op = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(op, { toValue: 1, duration: 750, useNativeDriver: true }), Animated.timing(op, { toValue: 0.6, duration: 750, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={[{ height: h, width: w ?? '100%', borderRadius: radius, backgroundColor: C.lineSoft, opacity: op }, style]} />;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 40 }}>
      <H2 center>{title}</H2>
      {description && <P center>{description}</P>}
      {action && <View style={{ marginTop: 12, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

export function ErrorText({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Une erreur est survenue.';
  return (
    <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: C.dangerLine, backgroundColor: C.cancelBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, gap: 6 }}>
      <Tx size={14} weight={500} color={C.danger} lh={19}>
        {msg}
      </Tx>
      {retry && (
        <Pressable onPress={retry} accessibilityRole="button">
          <Tx size={14} color={C.danger} lh={19} style={{ textDecorationLine: 'underline' }}>
            Réessayer
          </Tx>
        </Pressable>
      )}
    </View>
  );
}

/** Ligne d'alerte compacte (icône + texte rouge). */
export function Alert({ icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon && <I icon={icon} size={16} color={C.danger} />}
      <Tx size={14} color={C.danger} lh={19} style={{ flex: 1 }}>
        {children}
      </Tx>
    </View>
  );
}

/** Grille 2/3/4 colonnes (design .g2 .g3 .g4) : rangées de N cellules égales. */
export function Grid({ cols, gap, children, style }: { cols: 2 | 3 | 4; gap?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const g = gap ?? (cols === 4 ? 8 : 10);
  const items = Children.toArray(children).filter(Boolean);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={[{ gap: g }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: g }}>
          {Array.from({ length: cols }, (_, i) => (
            <View key={i} style={{ flex: 1 }}>
              {row[i] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Texte-bouton souligné (liens secondaires du design). */
export function TextLink({ children, onPress, color = C.muted, size = 14, center = true }: { children: ReactNode; onPress: () => void; color?: string; size?: number; center?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: center ? 'center' : 'flex-start' }}>
      <Tx size={size} color={color} center={center} style={{ textDecorationLine: 'underline' }}>
        {children}
      </Tx>
    </Pressable>
  );
}

export { S as Small, P as Para };
