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
import { AppleLogo, GooglePlayLogo } from './BrandIcons';
import { useEffect, useState } from 'react';
import { BellRing, CalendarSync } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { mobileOS, storeUrl } from '@/lib/appLinks';
import { PRO_ONLY } from '@/lib/flavor';
import { ICONE } from '@/lib/actionIcons';
import { BottomSheet, Button, Dim, SettingRow } from './ui';
import { t } from '@/i18n';

const natif = (): boolean => Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
export const APP_LINK = 'https://salondz.com/app';

function Contenu({ onStore }: { onStore?: () => void }) {
  const os = mobileOS();
  const { session } = useAuth();
  const email = session?.user.email;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (os) return;
    // Le générateur de QR (≈ 80 ko) n'est chargé que sur ordinateur, quand le QR s'affiche (27 nov. 2026).
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(APP_LINK, { margin: 1, width: 320, color: { dark: '#202020', light: '#ffffff' } }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [os]);
  return (
    <>
      <div className="flex items-center gap-3">
        <img src="/logo/app-client.png" alt="" className="app-bn-ic" />
        <b className="min-w-0 flex-1 text-[1.071rem] font-semibold leading-snug">{t('Votre rendez-vous vous suit dans l’application')}</b>
      </div>
      <div className="lst">
        <SettingRow className="fid-c-visits" icon={BellRing} title={t('Un rappel avant votre rendez-vous')} />
        <SettingRow className="fid-c-points" icon={CalendarSync} title={t('Reporter ou annuler en un geste')} />
        <SettingRow className="fid-c-gift" icon={ICONE.fidelite} title={t('Vos cadeaux fidélité')} />
      </div>
      {os ? (
        <a href={storeUrl(os)} target="_blank" rel="noreferrer" className="btn store-btn" onClick={onStore}>
          {os === 'ios' ? <AppleLogo size={20} /> : <GooglePlayLogo size={20} />}
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

