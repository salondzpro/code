/**
 * PRO-F 17 — Votre page de réservation : QR code, lien, Partager / Copier, réglages rapides.
 * PRO-F 18 — feuille « Partagez votre page » (WhatsApp, Instagram, Facebook, TikTok, Messages, QR, Plus).
 *   Les quatre réseaux portent leur vrai logo de marque (voir components/BrandIcons) et non les icônes
 *   génériques du design : demandé explicitement, à conserver lors d'une resynchronisation du design.
 * PRO-F 21 — QR code à imprimer.
 */
import { ICONE } from '@/lib/actionIcons';
import { useNavigate } from 'react-router';
import {
  Check,
  Copy,
  Download,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  Share2,
} from 'lucide-react';
import { LabelStudio } from '@/components/LabelStudio';
import { DEFAULT_LABEL_SETTINGS } from '@salondz/constants';
import { useCopy, useLabelUrl, usePublicUrl, useQr } from '@/lib/publicLinks';
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  WhatsAppLogo,
} from '@/components/BrandIcons';
import { useLabelSettings, useLabelSocials, useLabelStyle, useProSalon, useSaveLabelSocials, useSaveLabelStyle } from '@salondz/api-client';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  I,
  IconButton,
  ListRow,
  SectionLabel,
  Toast,
  TopBar, Dim } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { openExternal } from '@/lib/openExternal';
import { t } from '@/i18n';

function share(name: string, url: string) {
  const text = `Prenez rendez-vous chez ${name} en ligne, 24 h/24 : ${url}`;
  if (navigator.share) return navigator.share({ title: name, text, url }).catch(() => undefined);
  return navigator.clipboard?.writeText(url);
}

export function ShareSheet({
  name,
  url,
  short,
  onClose,
  logo,
}: {
  name: string;
  url: string;
  short: string;
  onClose: () => void;
  logo?: string | null;
}) {
  const [copied, copy] = useCopy();
  const text = encodeURIComponent(`Prenez rendez-vous chez ${name} en ligne, 24 h/24 : ${url}`);
  const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [
    {
      label: t("WhatsApp"),
      icon: <WhatsAppLogo />,
      onClick: () => window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener'),
    },
    {
      label: t("Instagram"),
      icon: <InstagramLogo />,
      onClick: () => copy(url),
    },
    {
      label: t("Facebook"),
      icon: <FacebookLogo />,
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          '_blank',
          'noopener',
        ),
    },
    {
      label: t("TikTok"),
      icon: <TikTokLogo />,
      onClick: () => copy(url),
    },
    {
      label: t("Messages"),
      icon: <I icon={MessageSquareText} size={34} />,
      onClick: () => window.open(`sms:?body=${text}`),
    },
    { label: t("Plus"), icon: <I icon={Share2} size={34} />, onClick: () => void share(name, url) },
  ];
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="h1 !text-[1.429rem]">{t("Partagez votre page")}</div>
        <div className="flex items-center gap-3 rounded-[var(--radius-card-sm)] bg-fill px-4 py-4 text-[1rem]">
          <I icon={Lock} size={20} className="text-muted" />
          <span className="flex-1 truncate">{short}</span>
          <button type="button" className="font-semibold" onClick={() => copy(url)}>
            {copied ? t('Copié') : t('Copier')}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              className="flex flex-col items-center gap-2"
              onClick={it.onClick}
            >
              <span className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface">
                {it.icon}
              </span>
              <span className="text-[1rem] text-muted">{it.label}</span>
            </button>
          ))}
        </div>
        <span className="sr-only">{logo ? 'logo' : ''}</span>
      </BottomSheet>
    </>
  );
}

export function ProQr() {
  const salon = useProSalon().data?.salon ?? null;
  const settings = useLabelSettings(!!salon);
  const socials = useLabelSocials(!!salon);
  const saveSocials = useSaveLabelSocials();
  const look = useLabelStyle(!!salon);
  const saveLook = useSaveLabelStyle();
  const { url, short } = useLabelUrl(salon?.slug ?? '');
  if (!salon) return <PageLoading />;
  const s = settings.data ?? DEFAULT_LABEL_SETTINGS;
  return (
    <Screen bottom={24} gap={14} className="narrow">
      <TopBar backTo="/pro" title={t('Étiquettes à imprimer')} />
      <LabelStudio
        input={{
          name: salon.name,
          url,
          short,
          logoUrl: salon.logoUrl ?? salon.coverUrl,
          categoryIds: salon.categoryIds,
          audience: salon.genderTarget,
        }}
        allowed={s.enabled}
        defaultId={s.defaultId}
        filename={`salondz-${salon.slug}`}
        socials={socials.data}
        onSaveSocials={(v) => saveSocials.mutateAsync(v)}
        style={look.data}
        onSaveStyle={(v) => saveLook.mutateAsync(v)}
      />
      <Button variant="g" onClick={() => void share(salon.name, url)}>
        <I icon={MoreHorizontal} size={18} /> {t('Partager le lien')}
      </Button>
    </Screen>
  );
}
