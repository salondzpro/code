/**
 * « Continuer avec Apple » et « Continuer avec Google » (21 nov. 2026) — UN composant pour tous les
 * endroits où l'on se connecte : écrans d'accès client et pro (`pages/auth/Acces.tsx`) et étape
 * « 3. Identification » de la réservation (`BookingWhen`). Chaque bouton n'apparaît que si son
 * fournisseur est activé sur Supabase. Apple en premier (bouton noir), Google ensuite.
 * WhatsApp (23 nov. 2026) : en dernier, SEULEMENT si le serveur peut livrer un code (modèle approuvé
 * par Meta, `useWhatsAppDispo`, 24 nov. 2026) — code à 6 chiffres reçu sur WhatsApp (`AccesWhatsApp`).
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { AppleLogo, GoogleLogo, WhatsAppLogo } from './BrandIcons';
import { AuthError } from './AuthShell';
import { connexionOAuth, useFournisseurs, type Fournisseur } from '@/lib/oauth';
import { useWhatsAppDispo } from '@/lib/whatsappDispo';
import { writeAuthFlow } from '@/lib/authFlow';
import { t } from '@/i18n';

export function OAuthButtons({ role, next }: { role: 'client' | 'pro'; next: string }) {
  const actifs = useFournisseurs(['apple', 'google']);
  // WhatsApp seulement quand le serveur peut VRAIMENT livrer un code (modèle approuvé par Meta).
  const whatsapp = useWhatsAppDispo().data?.available === true;
  const [busy, setBusy] = useState<Fournisseur | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = (f: Fournisseur) => {
    setErr(null);
    setBusy(f);
    writeAuthFlow({ role, next, identifier: '', channel: 'email' });
    connexionOAuth(f, role, next)
      .catch(() =>
        setErr(f === 'apple' ? t('Connexion avec Apple impossible pour le moment. Réessayez.') : t('Connexion avec Google impossible pour le moment. Réessayez.')),
      )
      .finally(() => setBusy(null));
  };
  return (
    <>
      {actifs.includes('apple') && (
        <button type="button" className="pl-btn pl-btn-ink pl-google pl-apple" disabled={busy !== null} onClick={() => go('apple')}>
          <AppleLogo size={20} />
          {t('Continuer avec Apple')}
        </button>
      )}
      {actifs.includes('google') && (
        <button type="button" className="pl-btn pl-btn-out pl-google" disabled={busy !== null} onClick={() => go('google')}>
          <GoogleLogo size={20} />
          {t('Continuer avec Google')}
        </button>
      )}
      {whatsapp && (
        <Link to={`${role === 'pro' ? '/pro/acces' : '/acces'}/whatsapp?next=${encodeURIComponent(next)}`} className="pl-btn pl-btn-out pl-google">
          <WhatsAppLogo size={20} />
          {t('Continuer avec WhatsApp')}
        </Link>
      )}
      {err && <AuthError texte={err} />}
    </>
  );
}
