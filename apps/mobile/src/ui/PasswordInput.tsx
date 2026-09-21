/** Champ de mot de passe avec l'œil « afficher / masquer » (même geste que sur le site). */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { I, Input, type InputProps } from './index';
import { C } from '@/theme/design';

export function PasswordInput({ style, ...props }: Omit<InputProps, 'secureTextEntry'>) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <Input
        lg
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        style={[{ paddingRight: 52 }, style]}
        {...props}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onPress={() => setShow((v) => !v)}
        hitSlop={8}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' }}
      >
        <I icon={show ? EyeOff : Eye} size={20} color={C.muted} />
      </Pressable>
    </View>
  );
}
