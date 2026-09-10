/** Espace pro — briques des pages de gestion : pastille d'icône, ligne « icône · titre · sous-titre », tuile de rubrique. */
import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card, I, Tx } from './index';
import { C } from '@/theme/design';

export function Ic({ icon, ink, danger }: { icon: LucideIcon; ink?: boolean; danger?: boolean }) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: ink ? C.ink : danger ? C.cancelBg : C.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <I icon={icon} size={14.5} color={ink ? C.onInk : danger ? C.danger : C.text} />
    </View>
  );
}

export function RowText({
  icon,
  title,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <Ic icon={icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tx size={13} weight={600} lh={17}>
          {title}
        </Tx>
        {!!sub && (
          <Tx size={11.5} color={C.muted} lh={15} numberOfLines={1}>
            {sub}
          </Tx>
        )}
      </View>
    </View>
  );
}

export function Tile({
  onPress,
  icon,
  title,
  sub,
}: {
  onPress: () => void;
  icon: LucideIcon;
  title: string;
  sub: string;
}) {
  return (
    <Card gap={10} pad={13} onPress={onPress} accessibilityLabel={title}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: C.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <I icon={icon} size={16} color={C.onInk} />
      </View>
      <View>
        <Tx size={13.5} weight={700} ls={-0.3} lh={17.5}>
          {title}
        </Tx>
        <Tx size={10.5} color={C.muted} lh={14}>
          {sub}
        </Tx>
      </View>
    </Card>
  );
}
