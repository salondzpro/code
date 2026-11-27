/**
 * Liens publics d'un salon, copie et QR — petits outils partagés par la navigation pro, l'accueil,
 * « Ma page » et la page « Lien / QR ». Sortis de `pages/pro/Link.tsx` le 27 nov. 2026 : importés
 * depuis la page, ils entraînaient l'atelier d'étiquettes et le générateur de QR dans le premier
 * chargement de tous les visiteurs. Le générateur de QR n'est chargé qu'à l'affichage d'un QR.
 */
import { useEffect, useState } from 'react';
import { shortSalonPath } from '@salondz/constants';
import { env } from './env';

/** Lien public d'un salon : TOUJOURS sur le domaine officiel (env.siteUrl), jamais sur l'adresse de navigation. */
export function usePublicUrl(slug: string): { url: string; short: string } {
  return {
    url: `${env.siteUrl}/s/${slug}`,
    short: `${env.siteUrl.replace(/^https?:\/\/(www\.)?/, '')}/s/${slug}`,
  };
}

/**
 * Lien des ÉTIQUETTES : la forme courte `salondz.com/<slug>` (le QR est plus aéré, le lien
 * imprimé plus lisible). Le lien PARTAGÉ garde `/s/`, seule adresse qui porte l'aperçu
 * WhatsApp / Facebook (réécriture vers `/share/s/:slug`).
 */
export function useLabelUrl(slug: string): { url: string; short: string } {
  const path = shortSalonPath(slug);
  return { url: `${env.siteUrl}${path}`, short: `${env.siteUrl.replace(/^https?:\/\/(www\.)?/, '')}${path}` };
}

export function useQr(url: string, size = 320): string | null {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: size, margin: 1, color: { dark: '#111214', light: '#ffffff' } }))
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
