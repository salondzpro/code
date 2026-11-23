/**
 * LE champ « Numéro de téléphone » des inscriptions (17 nov. 2026) : indicatif +213 fixe, saisie avec
 * ou sans le 0 du début (et même collée en entier, « +213… »), chiffres groupés pendant la frappe.
 * Le contrôle du format vit dans `phoneDZ` / `normalizeDZPhone` (`@salondz/validation`, `@salondz/constants`),
 * les mêmes que côté serveur.
 */
import { ChevronDown } from 'lucide-react';
import { groupLocalDigits, phoneDigits } from '@/lib/authFlow';
import { I, Input } from '@/components/ui';
import { t } from '@/i18n';

export function PhoneDZField({
  id,
  digits,
  onDigits,
  error,
  aide,
}: {
  id: string;
  /** Les 9 chiffres utiles (sans 0 ni indicatif). */
  digits: string;
  onDigits: (digits: string) => void;
  error?: string | null;
  /** Phrase sous le champ ; `null` : aucune (connexion par WhatsApp, où le code part bien). */
  aide?: string | null;
}) {
  return (
    <div>
      <label className="lbl" htmlFor={id}>
        {t('Numéro de téléphone')}
      </label>
      <div className="flex gap-2.5">
        <div className="pa-indicatif" dir="ltr" aria-label={t('Indicatif +213')}>
          +213 <I icon={ChevronDown} size={15} className="text-subtle" />
        </div>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="6 61 24 87 90"
          value={groupLocalDigits(digits)}
          onChange={(e) => onDigits(phoneDigits(e.target.value))}
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
