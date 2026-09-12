/**
 * PRO-F 18 — logos des applications de partage (WhatsApp, Instagram, Facebook, TikTok).
 * Vrais glyphes de marque en SVG inline, aux couleurs officielles ; tracés partagés avec le
 * mobile via @salondz/constants. Aucune image distante : rien à charger sur une 4G lente.
 */
import { useId } from 'react';
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

type LogoProps = { size?: number };

function Logo({
  size = 34,
  label,
  children,
}: LogoProps & { label: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function WhatsAppLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label="WhatsApp">
      <path d={WHATSAPP_PATH} fill={WHATSAPP_COLOR} />
    </Logo>
  );
}

export function InstagramLogo({ size }: LogoProps) {
  const id = useId();
  return (
    <Logo size={size} label="Instagram">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          {INSTAGRAM_GRADIENT.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <path d={INSTAGRAM_PATH} fill={`url(#${id})`} />
    </Logo>
  );
}

export function FacebookLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label="Facebook">
      <path d={FACEBOOK_PATH} fill={FACEBOOK_COLOR} />
    </Logo>
  );
}

export function TikTokLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label="TikTok">
      <path
        d={TIKTOK_PATH}
        fill={TIKTOK_CYAN}
        transform={`translate(${TIKTOK_CYAN_OFFSET.x} ${TIKTOK_CYAN_OFFSET.y})`}
      />
      <path
        d={TIKTOK_PATH}
        fill={TIKTOK_RED}
        transform={`translate(${TIKTOK_RED_OFFSET.x} ${TIKTOK_RED_OFFSET.y})`}
      />
      <path d={TIKTOK_PATH} fill="currentColor" />
    </Logo>
  );
}
