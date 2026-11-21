/**
 * PRO-F 18 — logos des applications de partage (WhatsApp, Instagram, Snapchat, Facebook, TikTok).
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
  SNAPCHAT_COLOR,
  SNAPCHAT_PATH,
  WHATSAPP_COLOR,
  WHATSAPP_PATH,
} from '@salondz/constants';
import { t } from '@/i18n';

type LogoProps = { size?: number };

/** Taille convertie en rem comme dans `I` : sinon les logos dépassent les icônes lucide voisines. */
function Logo({
  size = 34,
  label,
  children,
}: LogoProps & { label: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      focusable="false"
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    >
      {children}
    </svg>
  );
}

export function WhatsAppLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("WhatsApp")}>
      <path d={WHATSAPP_PATH} fill={WHATSAPP_COLOR} />
    </Logo>
  );
}

export function InstagramLogo({ size }: LogoProps) {
  const id = useId();
  return (
    <Logo size={size} label={t("Instagram")}>
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

/** Le vrai logo de Snapchat : le fantôme blanc cerclé de noir, sur son carré jaune. */
export function SnapchatLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("Snapchat")}>
      <rect width="24" height="24" rx="5.4" fill={SNAPCHAT_COLOR} />
      <g transform="translate(3 3) scale(0.75)">
        <path d={SNAPCHAT_PATH} fill="#ffffff" stroke="#111214" strokeWidth="1.3" strokeLinejoin="round" paintOrder="stroke" />
      </g>
    </Logo>
  );
}

/** Le fantôme seul, pour un bouton déjà jaune. */
export function SnapchatGhost({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("Snapchat")}>
      <path d={SNAPCHAT_PATH} fill="#ffffff" stroke="#111214" strokeWidth="1" strokeLinejoin="round" paintOrder="stroke" />
    </Logo>
  );
}

/** Glyphes blancs, pour un bouton déjà à la couleur du réseau. */
export function InstagramGlyph({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("Instagram")}>
      <path d={INSTAGRAM_PATH} fill="currentColor" />
    </Logo>
  );
}

export function WhatsAppGlyph({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("WhatsApp")}>
      <path d={WHATSAPP_PATH} fill="currentColor" />
    </Logo>
  );
}

export function FacebookLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("Facebook")}>
      <path d={FACEBOOK_PATH} fill={FACEBOOK_COLOR} />
    </Logo>
  );
}

export function TikTokLogo({ size }: LogoProps) {
  return (
    <Logo size={size} label={t("TikTok")}>
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

/** Le « G » officiel de Google, quatre couleurs (bouton « Continuer avec Google »). */
export function GoogleLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Google" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** La pomme d'Apple (bouton « Continuer avec Apple »), à la couleur du texte du bouton. */
export function AppleLogo({ size = 20 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Apple" focusable="false" fill="currentColor">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.33-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  );
}
