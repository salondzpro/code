/**
 * Trois boutons de partage, aux couleurs de chaque réseau : accueil et fenêtre d'un créneau libre.
 * Seul le bouton touché tourne : les autres ne bougent pas, et un second toucher est ignoré.
 */
import { InstagramGlyph, SnapchatGhost, WhatsAppGlyph } from './BrandIcons';

export type SocialChannel = 'instagram' | 'snapchat' | 'whatsapp';

const CHANNELS: { id: SocialChannel; cls: string; label: string; Logo: (p: { size?: number }) => React.ReactElement }[] = [
  { id: 'instagram', cls: 'ig', label: 'Instagram', Logo: InstagramGlyph },
  { id: 'snapchat', cls: 'snap', label: 'Snapchat', Logo: SnapchatGhost },
  { id: 'whatsapp', cls: 'wa', label: 'WhatsApp', Logo: WhatsAppGlyph },
];

export function SocialShare({
  busy,
  disabled,
  onShare,
}: {
  busy: SocialChannel | null;
  disabled?: boolean;
  onShare: (channel: SocialChannel) => void;
}) {
  return (
    <div className="sc-r">
      {CHANNELS.map(({ id, cls, label, Logo }) => (
        <button
          key={id}
          type="button"
          className={`sc-b ${cls}`}
          disabled={disabled}
          aria-busy={busy === id || undefined}
          onClick={() => {
            if (!busy) onShare(id);
          }}
        >
          {busy === id ? <span className="btn-spin" aria-hidden /> : <Logo size={22} />}
          {label}
        </button>
      ))}
    </div>
  );
}
