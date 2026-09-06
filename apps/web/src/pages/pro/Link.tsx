/**
 * PRO-F 17 — Votre page de réservation : QR code, lien, Partager / Copier, réglages rapides.
 * PRO-F 18 — feuille « Partagez votre page » (WhatsApp, Instagram, Facebook, TikTok, Messages, QR, Plus).
 * PRO-F 21 — QR code à imprimer.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import { Check, Copy, Lock, MessageCircle, MoreHorizontal, QrCode, Share2 } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { Avatar, Badge, BottomSheet, Button, I, IconButton, Toast, Toggle, TopBar } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { Splash } from '@/pages/auth/Splash';

export function usePublicUrl(slug: string): { url: string; short: string } {
  const origin = window.location.origin;
  return { url: `${origin}/s/${slug}`, short: `${window.location.host.replace(/^www\./, '')}/s/${slug}` };
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

export function ShareSheet({ name, url, short, onClose, logo }: { name: string; url: string; short: string; onClose: () => void; logo?: string | null }) {
  const [copied, copy] = useCopy();
  const navigate = useNavigate();
  const text = encodeURIComponent(`Prenez rendez-vous chez ${name} en ligne, 24 h/24 : ${url}`);
  const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [
    { label: 'WhatsApp', icon: <I icon={MessageCircle} size={26} />, onClick: () => window.open(`https://wa.me/?text=${text}`, '_blank') },
    { label: 'Instagram', icon: <span className="text-[22px] font-bold">◎</span>, onClick: () => copy(url) },
    { label: 'Facebook', icon: <span className="text-[24px] font-bold">f</span>, onClick: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank') },
    { label: 'TikTok', icon: <span className="text-[22px] font-bold">♪</span>, onClick: () => copy(url) },
    { label: 'Messages', icon: <span className="text-[22px]">✆</span>, onClick: () => window.open(`sms:?body=${text}`) },
    { label: 'QR Code', icon: <I icon={QrCode} size={26} />, onClick: () => navigate('/pro/qr') },
    { label: 'Plus', icon: <I icon={Share2} size={26} />, onClick: () => void share(name, url) },
  ];
  return (
    <>
      <div className="dim" onClick={onClose} />
      <BottomSheet>
        <div className="h1 !text-[26px]">Partagez votre page</div>
        <div className="flex items-center gap-3 rounded-[16px] bg-fill px-4 py-4 text-[19px]">
          <I icon={Lock} size={20} className="text-muted" />
          <span className="flex-1 truncate">{short}</span>
          <button type="button" className="font-semibold" onClick={() => copy(url)}>
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.map((it) => (
            <button key={it.label} type="button" className="flex flex-col items-center gap-2" onClick={it.onClick}>
              <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[22px] border border-line bg-surface">{it.icon}</span>
              <span className="text-[15px] text-muted">{it.label}</span>
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
  const { updateSalon } = useProSalonMutations();
  const [sheet, setSheet] = useState(false);
  const [copied, copy] = useCopy();
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  const qr = useQr(url, 400);
  if (!salon) return <Splash />;
  const lead = salon.bookingLeadTimeMinutes >= 60 ? `${Math.round(salon.bookingLeadTimeMinutes / 60)} h` : `${salon.bookingLeadTimeMinutes} min`;

  return (
    <Screen bottom={24} gap={16}>
      <TopBar backTo="/pro" />
      <h1 className="h1">
        Votre page de
        <br />
        réservation
      </h1>
      <div className="crd items-center !gap-4 !py-6">
        <button type="button" className="flex h-[340px] w-[340px] items-center justify-center overflow-hidden rounded-[24px] bg-fill" onClick={() => navigate('/pro/qr')} aria-label="Agrandir le QR code">
          {qr ? <img src={qr} alt="QR code de votre page" className="h-[300px] w-[300px]" /> : <span className="text-[17px] text-subtle">QR code</span>}
        </button>
        <div className="flex w-full items-center justify-between gap-3 rounded-[16px] bg-fill px-5 py-4 text-[19px]">
          <span className="truncate">{short}</span>
          <IconButton aria-label="Copier le lien" onClick={() => copy(url)} className="!h-8 !w-8 !border-0 !bg-transparent">
            <I icon={copied ? Check : Copy} size={18} />
          </IconButton>
        </div>
      </div>
      <div className="g2">
        <Button onClick={() => setSheet(true)}>Partager</Button>
        <Button variant="g" onClick={() => copy(url)}>
          Copier
        </Button>
      </div>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-4">
          <span className="text-[19px] text-muted">Réservation en ligne</span>
          <Toggle on={salon.isPublished} onChange={(v) => updateSalon.mutate({ isPublished: v })} label="Réservation en ligne" />
        </div>
        <button type="button" className="li w-full !py-4 text-left" onClick={() => navigate('/pro/profil/regles')}>
          <span className="text-[19px] text-muted">Délai minimum</span>
          <span className="text-[22px] font-bold">{lead}</span>
        </button>
        <div className="li !py-4">
          <span className="text-[19px] text-muted">Validation manuelle</span>
          <Toggle on={!salon.autoConfirm} onChange={(v) => updateSalon.mutate({ autoConfirm: !v })} label="Validation manuelle" />
        </div>
      </div>
      {!salon.isPublished && (
        <Badge tone="pd" md>
          Page non publiée · activez la réservation en ligne
        </Badge>
      )}
      {copied && (
        <Toast icon={Check}>
          Lien copié
        </Toast>
      )}
      {sheet && <ShareSheet name={salon.name} url={url} short={short} logo={salon.logoUrl} onClose={() => setSheet(false)} />}
      <span className="sr-only">{SHEET_PAD}</span>
    </Screen>
  );
}

/** PRO-F 21 — QR code en vitrine. */
export function ProQr() {
  const salon = useProSalon().data?.salon ?? null;
  const { url, short } = usePublicUrl(salon?.slug ?? '');
  const qr = useQr(url, 800);
  if (!salon) return <Splash />;
  return (
    <Screen bottom={24} gap={16}>
      <TopBar backTo="/pro/lien" right="QR code" />
      <div className="crd items-center !gap-3 !py-8">
        <Avatar src={salon.logoUrl ?? salon.coverUrl} name={salon.name} size={64} />
        <div className="text-[24px] font-bold tracking-[-0.4px]">{salon.name}</div>
        <div className="text-[17px] text-muted">{short}</div>
        {qr ? <img src={qr} alt="QR code" className="mt-2 h-[280px] w-[280px] rounded-[16px]" /> : <div className="sk mt-2 h-[280px] w-[280px]" />}
      </div>
      <p className="p text-center">À imprimer en vitrine ou à coller sur le miroir. Le scan ouvre directement votre page de réservation.</p>
      <div className="g2">
        <a href={qr ?? '#'} download={`qr-${salon.slug}.png`} className="btn g">
          Enregistrer
        </a>
        <Button onClick={() => void share(salon.name, url)}>
          <I icon={MoreHorizontal} size={18} /> Partager
        </Button>
      </div>
    </Screen>
  );
}
