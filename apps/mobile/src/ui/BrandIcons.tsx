/**
 * PRO-F 18 — logos des applications de partage (WhatsApp, Instagram, Facebook, TikTok).
 * Vrais glyphes de marque en SVG, aux couleurs officielles ; tracés partagés avec le web via
 * @salondz/constants. Rien à télécharger : les logos sont embarqués dans l'application.
 */
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  FACEBOOK_COLOR,
  FACEBOOK_PATH,
  INSTAGRAM_GRADIENT,
  INSTAGRAM_PATH,
  TIKTOK_CYAN,
  TIKTOK_CYAN_OFFSET,
  TIKTOK_PATH,
  TIKTOK_RED,
  TIKTOK_RED_OFFSET,
  WHATSAPP_COLOR,
  WHATSAPP_PATH,
} from '@salondz/constants';
import { C } from '@/theme/design';

type LogoProps = { size?: number };

const DEFAULT_SIZE = 27;

export function WhatsAppLogo({ size = DEFAULT_SIZE }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={WHATSAPP_PATH} fill={WHATSAPP_COLOR} />
    </Svg>
  );
}

export function InstagramLogo({ size = DEFAULT_SIZE }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="sdzInstagram" x1="0" y1="1" x2="1" y2="0">
          {INSTAGRAM_GRADIENT.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path d={INSTAGRAM_PATH} fill="url(#sdzInstagram)" />
    </Svg>
  );
}

export function FacebookLogo({ size = DEFAULT_SIZE }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FACEBOOK_PATH} fill={FACEBOOK_COLOR} />
    </Svg>
  );
}

export function TikTokLogo({ size = DEFAULT_SIZE }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={TIKTOK_PATH}
        fill={TIKTOK_CYAN}
        transform={`translate(${TIKTOK_CYAN_OFFSET.x} ${TIKTOK_CYAN_OFFSET.y})`}
      />
      <Path
        d={TIKTOK_PATH}
        fill={TIKTOK_RED}
        transform={`translate(${TIKTOK_RED_OFFSET.x} ${TIKTOK_RED_OFFSET.y})`}
      />
      <Path d={TIKTOK_PATH} fill={C.ink} />
    </Svg>
  );
}
