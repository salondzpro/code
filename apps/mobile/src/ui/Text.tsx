/** Typographie du design (.h1 .h2 .h3 .p .s .t3) — Inter, graisses par famille de police. */
import { Text as RNText, type TextProps } from 'react-native';
import { C, FONT } from '@/theme/design';

export type Weight = 400 | 500 | 600 | 700;
export const fontFor = (w: Weight): string => (w >= 700 ? FONT.bold : w >= 600 ? FONT.semibold : w >= 500 ? FONT.medium : FONT.regular);

export interface TxProps extends TextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  /** Interligne en px (défaut 1.4 × taille). */
  lh?: number;
  ls?: number;
  mono?: boolean;
  center?: boolean;
  right?: boolean;
  upper?: boolean;
}

export function Tx({ size = 15, weight = 400, color = C.text, lh, ls, mono, center, right, upper, style, ...props }: TxProps) {
  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily: fontFor(weight),
          fontSize: size,
          lineHeight: lh ?? Math.round(size * 1.4),
          color,
          letterSpacing: ls,
          fontVariant: mono ? ['tabular-nums'] : undefined,
          textAlign: center ? 'center' : right ? 'right' : undefined,
          textTransform: upper ? 'uppercase' : undefined,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}

export const H1 = (p: TxProps) => <Tx size={28} weight={700} ls={-0.7} lh={31} {...p} />;
export const H2 = (p: TxProps) => <Tx size={17} weight={600} ls={-0.3} lh={22} {...p} />;
export const H3 = (p: TxProps) => <Tx size={12} weight={600} color={C.subtle} ls={0.96} lh={16} upper {...p} />;
export const P = (p: TxProps) => <Tx size={15} color={C.muted} lh={22} {...p} />;
export const S = (p: TxProps) => <Tx size={13} color={C.muted} lh={18} {...p} />;
export const T3 = (p: TxProps) => <Tx size={12} color={C.subtle} lh={16} {...p} />;
