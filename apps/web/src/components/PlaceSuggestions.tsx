/**
 * Liste de suggestions d'un champ de lieu. Une seule, pour la place de marché, l'écran
 * Localisation et l'adresse du salon : trois listes recopiées divergeaient à chaque retouche, et
 * c'est ainsi que celle de la marketplace ne proposait que les quartiers déjà pourvus d'un salon.
 *
 * Elle affiche d'abord ce qui vient de la mémoire de l'application (wilayas, communes), puis les
 * adresses fines quand le réseau répond — et le dit tant qu'elle attend, au lieu de laisser croire
 * qu'il n'y a rien.
 */
import { Building2, Check, MapPin, Navigation } from 'lucide-react';
import { I } from './ui';
import type { EtatGeocodage, Lieu } from '@/lib/places';
import { t } from '@/i18n';

const ICONE = { wilaya: Building2, commune: MapPin, adresse: Navigation } as const;

export function PlaceSuggestions({
  lieux,
  adresses,
  geocodage,
  onPick,
  estChoisi,
  avant,
  apres,
  vide,
  className = '',
}: {
  lieux: Lieu[];
  adresses: Lieu[];
  geocodage: EtatGeocodage;
  onPick: (lieu: Lieu) => void;
  /** Coche de l'élément déjà retenu, quand l'écran garde une sélection avant de valider. */
  estChoisi?: (lieu: Lieu) => boolean;
  /** Lignes propres à l'écran, posées avant (ex. les quartiers où il y a des salons). */
  avant?: React.ReactNode;
  /** Lignes posées après (ex. « Autour de moi »). */
  apres?: React.ReactNode;
  /** Message quand rien ne correspond, hors attente. */
  vide?: string;
  className?: string;
}) {
  const tout = [...lieux, ...adresses];
  const attente = geocodage === 'cherche';

  return (
    <div className={`crd !gap-0 !py-1 ${className}`} aria-live="polite">
      {avant}
      {tout.map((l) => (
        <button key={l.cle} type="button" className="li w-full text-start" onClick={() => onPick(l)}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
              <I icon={ICONE[l.kind]} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[1rem] font-semibold">{l.label}</span>
              <span className="block truncate text-[0.857rem] text-muted">{l.detail}</span>
            </span>
          </span>
          {estChoisi?.(l) && <I icon={Check} size={20} className="flex-none" />}
        </button>
      ))}
      {/* Les adresses arrivent d'un service tiers, donc après les communes : on le dit. */}
      {attente && <p className="p px-1 py-3">{t("Recherche d’adresses…")}</p>}
      {!attente && tout.length === 0 && (
        <p className="p px-1 py-3">
          {geocodage === 'injoignable'
            ? t("Les adresses ne répondent pas pour l’instant. Cherchez une ville ou une wilaya.")
            : (vide ?? t("Aucun lieu trouvé. Essayez une ville ou une wilaya."))}
        </p>
      )}
      {apres}
    </div>
  );
}
