/**
 * Écran de validation animé (cercle vert qui s'ouvre, coche, titre qui monte) après une action réussie
 * (ex. : rendez-vous ajouté par le pro), puis suite automatique — ou d'un tap pour ne pas attendre.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { H1, I, P } from './index';
import { C } from '@/theme/design';

export function SuccessSplash({
  title,
  subtitle,
  onDone,
  duration = 1500,
}: {
  title: string;
  subtitle?: string;
  onDone: () => void;
  /** Durée d'affichage avant la suite automatique (ms). */
  duration?: number;
}) {
  const done = useRef(onDone);
  done.current = onDone;
  const fired = useRef(false);
  const scale = useRef(new Animated.Value(0.3)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;
  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    done.current();
  };
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 450, delay: 200, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(fire, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);
  return (
    <Modal visible animationType="fade" onRequestClose={fire}>
      <Pressable
        onPress={fire}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          paddingHorizontal: 24,
          backgroundColor: C.surface,
        }}
      >
        <Animated.View
          style={{
            width: 132,
            height: 132,
            borderRadius: 66,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: C.okBg,
            transform: [{ scale }],
            opacity: fade,
          }}
        >
          <I icon={Check} size={58} color={C.okFg} />
        </Animated.View>
        <Animated.View
          style={{ alignItems: 'center', gap: 6, opacity: fade, transform: [{ translateY: rise }] }}
        >
          <H1 center>{title}</H1>
          {subtitle ? <P center>{subtitle}</P> : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
