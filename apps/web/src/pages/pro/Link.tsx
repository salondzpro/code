/**
 * PRO-F 17 — Votre page de réservation : QR code, lien, Partager / Copier, réglages rapides.
 * PRO-F 18 — feuille « Partagez votre page » (WhatsApp, Instagram, Facebook, TikTok, Messages, QR, Plus).
 *   Les quatre réseaux portent leur vrai logo de marque (voir components/BrandIcons) et non les icônes
 *   génériques du design : demandé explicitement, à conserver lors d'une resynchronisation du design.
 * PRO-F 21 — QR code à imprimer.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  QrCode,
  Share2,
} from 'lucide-react';
import { renderQrPoster } from '@/lib/qrPoster';
import { env } from '@/lib/env';
import {
  FacebookLogo,
  InstagramLogo,
  TikTokLogo,
  WhatsAppLogo,
} from '@/components/BrandIcons';
import { useProSalon } from '@salondz/api-client';
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
import { Splash } from '@/pages/auth/Splash';
import { t } from '@/i18n';

/** Lien public d'un salon : TOUJOURS sur le domaine officiel (env.siteUrl), jamais sur l'adresse de navigation. */
export function usePublicUrl(slug: string): { url: string; short: string } {
  return {
    url: `${env.siteUrl}/s/${slug}`,
    short: `${env.siteUrl.replace(/^https?:\/\/(www\.)?/, '')}/s/${slug}`,
  };
}

export function useQr(url: string, size = 320): string | null {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: size, margin: 1, color: { dark: '#111214', light: '#ffffff' } })
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [url, size]);
  return data;
}

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };
  return [copied, copy];
}

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
  const navigate = useNavigate();
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
    { label: t("QR Code"), icon: <I icon={QrCode} size={34} />, onClick: () => navigate('/pro/qr') },
    { label: t("Plus"), icon: <I icon={Share2} size={34} />, onClick: () => void share(name, url) },
  ];
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet>
        <div className="h1 !text-[1.429rem]">{t("Partagez votre page")}</div>
        <div className="flex items-center gap-3 rounded-[var(--radius-card-sm)] bg-fill px-4 py-4 text-[1rem]">
          <I icon={Lock} size={20} className="text-muted" />
          <span className="flex-1 truncate">{short}</span>
          <button type="button" className="font-semibold" onClick={() => copy(url)}>
            {copied ? 'Copié' : 'Copier'}
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
        <Button onClick={() => copy(url)}>{copied ? 'Lien copié' : 'Copier le lien'}</Button>
        <span className="sr-only">{logo ? 'logo' : ''}</span>
      </BottomSheet>
    </>
  );
}

export function ProLink() {
  const navigate = useNavigate();
  const salon = useProSalon().data?.salon ?? null;
  const [sheet, setSheet] = useState(false);
  const [copied, copy] = useCopy();
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  const qr = useQr(url, 400);
  if (!salon) return <Splash />;
  const lead =
    salon.bookingLeadTimeMinutes >= 60
      ? `${Math.round(salon.bookingLeadTimeMinutes / 60)} h`
      : `${salon.bookingLeadTimeMinutes} min`;

  return (
    <Screen bottom={24} gap={16}>
      <TopBar backTo="/pro" />
      <h1 className="h1">
        {t("Votre page de")}
        <br />
        {t("réservation")}
      </h1>
      <div className="crd items-center !gap-3 !py-4">
        <button
          type="button"
          className="flex h-[15rem] w-[15rem] items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-fill"
          onClick={() => navigate('/pro/qr')}
          aria-label={t("Agrandir le QR code")}
        >
          {qr ? (
            <img src={qr} alt={t("QR code de votre page")} className="h-[13rem] w-[13rem]" />
          ) : (
            <span className="text-[0.857rem] text-subtle">{t("QR code")}</span>
          )}
        </button>
        <div className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card-sm)] bg-fill px-5 py-4 text-[1rem]">
          <span className="truncate">{short}</span>
          <IconButton
            aria-label={t("Copier le lien")}
            onClick={() => copy(url)}
            className="!h-8 !w-8 !border-0 !bg-transparent"
          >
            <I icon={copied ? Check : Copy} size={18} />
          </IconButton>
        </div>
      </div>
      <div className="g2">
        <Button onClick={() => setSheet(true)}>{t("Partager")}</Button>
        <Button variant="g" onClick={() => copy(url)}>
          {t("Copier")}
        </Button>
      </div>
      {/* Ce que le lien donne aujourd'hui : des faits, chacun menant à l'écran qui le règle
          (publication sur Compte, délai sur Créneaux et règles, validation sur Rendez-vous). */}
      <SectionLabel>{t("Ce que voient vos clients")}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <ListRow
          to="/pro/compte"
          right={
            <span className={`text-[1rem] font-semibold ${salon.isPublished ? 'text-ok' : 'text-danger'}`}>
              {salon.isPublished ? t("Activée") : t("Désactivée")}
            </span>
          }
        >
          <span className="text-[1rem] text-muted">{t("Réservation en ligne")}</span>
        </ListRow>
        <ListRow to="/pro/profil/regles" right={<span className="text-[1rem] font-semibold">{t('{n} avant', { n: lead })}</span>}>
          <span className="text-[1rem] text-muted">{t("Délai minimum")}</span>
        </ListRow>
        <ListRow to="/pro/reglages/rendez-vous" right={<span className="text-[1rem] font-semibold">{salon.autoConfirm ? t("Non") : t("Oui")}</span>}>
          <span className="text-[1rem] text-muted">{t("Validation manuelle")}</span>
        </ListRow>
      </div>
      {!salon.isPublished && (
        <Badge tone="pd" md>
          {t("Page non publiée · activez la réservation en ligne")}
        </Badge>
      )}
      {copied && <Toast icon={Check}>{t("Lien copié")}</Toast>}
      {sheet && (
        <ShareSheet
          name={salon.name}
          url={url}
          short={short}
          logo={salon.logoUrl}
          onClose={() => setSheet(false)}
        />
      )}
      <span className="sr-only">{SHEET_PAD}</span>
    </Screen>
  );
}

/** PRO-F 21 — QR code en vitrine : l'aperçu est l'affiche Salon DZ elle-même, « Enregistrer » la télécharge en PNG. */
export function ProQr() {
  const salon = useProSalon().data?.salon ?? null;
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  const [poster, setPoster] = useState<string | null>(null);
  useEffect(() => {
    if (!salon) return;
    let alive = true;
    setPoster(null);
    renderQrPoster({ name: salon.name, url, short, logoUrl: salon.logoUrl ?? salon.coverUrl })
      .then((d) => alive && setPoster(d))
      .catch(() => alive && setPoster(null));
    return () => {
      alive = false;
    };
  }, [salon?.name, salon?.logoUrl, salon?.coverUrl, url, short, salon]);
  if (!salon) return <Splash />;
  return (
    <Screen bottom={24} gap={16}>
      <TopBar backTo="/pro/lien" right="QR code" />
      {poster ? (
        <img
          src={poster}
          alt={`Affiche QR de ${salon.name}`}
          className="w-full rounded-[var(--radius-card)] border border-line"
        />
      ) : (
        <div className="sk aspect-[3/4] w-full !rounded-[var(--radius-card)]" />
      )}
      <p className="p text-center">
        {t("À imprimer en vitrine : le scan ouvre votre page de réservation.")}
      </p>
      <div className="g2">
        <a
          href={poster ?? '#'}
          download={`affiche-qr-${salon.slug}.png`}
          className={`btn g${poster ? '' : ' opacity-50 pointer-events-none'}`}
          aria-disabled={!poster}
        >
          <I icon={Download} size={18} /> {t("Enregistrer")}
        </a>
        <Button onClick={() => void share(salon.name, url)}>
          <I icon={MoreHorizontal} size={18} /> {t("Partager")}
        </Button>
      </div>
    </Screen>
  );
}
