/**
 * LE champ « Numéro de téléphone » des inscriptions (17 nov. 2026) : indicatif +213 fixe, saisie avec
 * ou sans le 0 du début (et même collée en entier, « +213… »), chiffres groupés pendant la frappe.
 * Le contrôle du format vit dans `phoneDZ` / `normalizeDZPhone` (`@salondz/validation`, `@salondz/constants`),
 * les mêmes que côté serveur.
 *
 * CONNEXION PAR WHATSAPP (23 nov. 2026) : avec `onPays`, l'indicatif devient une liste Algérie +213 /
 * France +33 (mobiles de la diaspora, `phoneLogin` côté serveur). Ailleurs, il reste fixé à +213.
 */
import { ChevronDown } from 'lucide-react';
import { groupLocalDigits, phoneDigits } from '@/lib/authFlow';
import { I, Input } from '@/components/ui';
import { t } from '@/i18n';

export type PaysTel = 'dz' | 'fr';
const INDICATIF: Record<PaysTel, string> = { dz: '+213', fr: '+33' };

/** Les 9 chiffres utiles d'un numéro français (sans 0, sans +33), même collé en entier. */
function chiffresFR(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0033')) d = d.slice(4);
  else if (d.startsWith('33') && d.length > 9) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

/** Numéro complet E.164 pour la connexion par WhatsApp, ou `null` s'il n'est pas un mobile du pays. */
export function numeroConnexion(pays: PaysTel, digits: string): string | null {
  if (pays === 'fr') return /^[67]\d{8}$/.test(digits) ? `+33${digits}` : null;
  return /^[567]\d{8}$/.test(digits) ? `+213${digits}` : null;
}

/** Affichage lisible d'un numéro E.164 algérien (0555 12 34 56) ou français (06 12 34 56 78). */
export function afficherNumero(e164: string): string {
  if (e164.startsWith('+33')) return `0${e164.slice(3)}`.replace(/(\d{2})(?=\d)/g, '$1 ');
  return e164.replace(/^\+213/, '0').replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

export function PhoneDZField({
  id,
  digits,
  onDigits,
  error,
  aide,
  pays = 'dz',
  onPays,
}: {
  id: string;
  /** Les 9 chiffres utiles (sans 0 ni indicatif). */
  digits: string;
  onDigits: (digits: string) => void;
  error?: string | null;
  /** Phrase sous le champ ; `null` : aucune (connexion par WhatsApp, où le code part bien). */
  aide?: string | null;
  /** Pays de l'indicatif (connexion par WhatsApp seulement). */
  pays?: PaysTel;
  onPays?: (pays: PaysTel) => void;
}) {
  return (
    <div>
      <label className="lbl" htmlFor={id}>
        {t('Numéro de téléphone')}
      </label>
      <div className="flex gap-2.5">
        <div className="pa-indicatif relative" dir="ltr" aria-label={t('Indicatif {code}', { code: INDICATIF[pays] })}>
          {onPays && <span aria-hidden>{pays === 'fr' ? '🇫🇷' : '🇩🇿'}</span>}
          {INDICATIF[pays]} <I icon={ChevronDown} size={15} className="text-subtle" />
          {onPays && (
            <select
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={t('Pays')}
              value={pays}
              onChange={(e) => {
                onPays(e.target.value as PaysTel);
                onDigits('');
              }}
            >
              <option value="dz">{t('Algérie')} (+213)</option>
              <option value="fr">{t('France')} (+33)</option>
            </select>
          )}
        </div>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={pays === 'fr' ? '6 12 34 56 78' : '6 61 24 87 90'}
          value={groupLocalDigits(digits)}
          onChange={(e) => onDigits(pays === 'fr' ? chiffresFR(e.target.value) : phoneDigits(e.target.value))}
          err={!!error}
          aria-required
        />
      </div>
      {(error || aide !== null) && (
        <p className={`mt-1 text-[0.857rem] ${error ? 'text-danger' : 'text-subtle'}`}>
          {error ?? (aide === undefined ? t('Format algérien · aucun SMS envoyé.') : aide)}
        </p>
      )}
    </div>
  );
}

/** Les 9 chiffres → numéro +213…, ou `null` s'il n'est pas au format algérien. */
export { normalizeDZPhone as numeroDZ } from '@salondz/constants';
