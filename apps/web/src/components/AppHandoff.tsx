/**
 * PASSATION VERS L'APPLICATION APRÈS UNE RÉSERVATION (18 nov. 2026, demande du propriétaire : « ne pas
 * perdre la cliente venue du lien en bio, faire connaître l'application, comme un expert d'Uber »).
 *
 * Principes repris d'Uber : on vend la SUITE du rendez-vous qu'elle vient de prendre, pas « une appli » ;
 * un seul bouton, vers le bon store ; rien à refaire ensuite (l'adresse e-mail du compte est rappelée,
 * elle retrouve son rendez-vous en se connectant) ; sur ordinateur, un QR code vers `salondz.com/app`
 * (qui choisit le store, ou ouvre l'application si elle est déjà là).
 *   - `AppHandoffCard` : la carte, en bas de la confirmation ;
 *   - `AppHandoffSheet` : la même, en fenêtre, une seule fois par réservation, 1,8 s après la coche.
 * Jamais dans l'application elle-même, ni dans la variante pro.
 */
import { useEffect, useState } from 'react';
import { BellRing, CalendarSync } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '@/lib/auth';
import { mobileOS, storeUrl } from '@/lib/appLinks';
import { PRO_ONLY } from '@/lib/flavor';
import { ICONE } from '@/lib/actionIcons';
import { BottomSheet, Button, Dim, SettingRow } from './ui';
import { t } from '@/i18n';

const natif = (): boolean => Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
export const APP_LINK = 'https://salondz.com/app';

/** Logo officiel Apple. */
const AppleLogo = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16.37 12.73c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.66ZM14.1 6c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.76-.95 2.8 1.01.08 2.04-.51 2.67-1.27Z" />
  </svg>
);
/** Logo officiel Google Play. */
const PlayLogo = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
    <path d="M3.6 1.8 13.4 12 3.6 22.2c-.35-.2-.6-.6-.6-1.1V2.9c0-.5.25-.9.6-1.1Z" fill="#00d7fe" />
    <path d="M16.9 8.5 13.4 12 3.6 1.8c.3-.2.75-.2 1.15.02L16.9 8.5Z" fill="#00f076" />
    <path d="m16.9 15.5-12.15 6.68c-.4.22-.85.22-1.15.02L13.4 12l3.5 3.5Z" fill="#ff3a44" />
    <path d="m20.4 10.4-3.5-1.9L13.4 12l3.5 3.5 3.5-1.9c.95-.53.95-1.67 0-2.2Z" fill="#ffd500" />
  </svg>
);

function Contenu({ onStore }: { onStore?: () => void }) {
  const os = mobileOS();
  const { session } = useAuth();
  const email = session?.user.email;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (os) return;
    void QRCode.toDataURL(APP_LINK, { margin: 1, width: 320, color: { dark: '#202020', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
  }, [os]);
  return (
    <>
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="app-bn-ic" />
        <b className="min-w-0 flex-1 text-[1.071rem] font-semibold leading-snug">{t('Votre rendez-vous vous suit dans l’application')}</b>
      </div>
      <div className="lst">
        <SettingRow className="fid-c-visits" icon={BellRing} title={t('Un rappel avant votre rendez-vous')} />
        <SettingRow className="fid-c-points" icon={CalendarSync} title={t('Reporter ou annuler en un geste')} />
        <SettingRow className="fid-c-gift" icon={ICONE.fidelite} title={t('Vos cadeaux fidélité')} />
      </div>
      {os ? (
        <a href={storeUrl(os)} target="_blank" rel="noreferrer" className="btn store-btn" onClick={onStore}>
          {os === 'ios' ? <AppleLogo /> : <PlayLogo />}
          {os === 'ios' ? t('Télécharger sur l’App Store') : t('Disponible sur Google Play')}
        </a>
      ) : (
        qr && (
          <div className="flex items-center gap-3.5">
            <img src={qr} alt={t('QR code de l’application')} className="h-[7.5rem] w-[7.5rem] flex-none rounded-[var(--radius-card-sm)] shadow-[0_0_0_1px_var(--color-line)]" />
            <b className="text-[1rem] font-semibold">{t('Scannez avec votre téléphone')}</b>
          </div>
        )
      )}
      {email && <p className="text-center text-[0.857rem] text-muted">{t('Connectez-vous avec {email}', { email })}</p>}
    </>
  );
}

export function AppHandoffCard() {
  if (natif() || PRO_ONLY) return null;
  return (
    <div className="crd !gap-3">
      <Contenu />
    </div>
  );
}

/** La fenêtre, une seule fois par réservation (téléphone seulement, sur le site). */
export function AppHandoffSheet({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (natif() || PRO_ONLY || !mobileOS()) return;
    const cle = `salondz:handoff:${bookingId}`;
    try {
      if (sessionStorage.getItem(cle)) return;
      sessionStorage.setItem(cle, '1');
    } catch {
      return;
    }
    const id = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(id);
  }, [bookingId]);
  if (!open) return null;
  return (
    <>
      <Dim onClose={() => setOpen(false)} />
      <BottomSheet modal>
        <Contenu onStore={() => setOpen(false)} />
        <Button icon={ICONE.plusTard} variant="g" onClick={() => setOpen(false)}>
          {t('Plus tard')}
        </Button>
      </BottomSheet>
    </>
  );
}

