/**
 * « Agir en tant que » — un administrateur qui pilote l'espace d'un professionnel.
 *
 * Le cas réel : le pro appelle, il ne trouve pas comment fermer une journée ou corriger un prix.
 * Lui dicter des clics au téléphone ne marche pas ; entrer dans son espace et le faire, si.
 *
 * Ce module ne fait que retenir DE QUEL salon il s'agit. Tout le pouvoir est côté serveur :
 * l'en-tête `X-Admin-Salon` n'a d'effet que derrière `requireAdmin`, et chaque écriture faite
 * ainsi laisse une ligne au journal. Retirer cette clé du stockage ne donne rien à personne.
 *
 * La valeur survit au rechargement (on reste dans le salon en naviguant), et un changement
 * prévient les abonnés : la bannière de l'espace pro se met à jour sans rechargement.
 */
import { useSyncExternalStore } from 'react';

const CLE = 'salondz:admin:salon';

export interface ActedSalon {
  id: string;
  name: string;
}

function lire(): ActedSalon | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const v = JSON.parse(brut) as ActedSalon;
    return v?.id ? v : null;
  } catch {
    return null;
  }
}

let courant: ActedSalon | null = lire();
const abonnes = new Set<() => void>();

function poser(v: ActedSalon | null) {
  courant = v;
  try {
    if (v) localStorage.setItem(CLE, JSON.stringify(v));
    else localStorage.removeItem(CLE);
  } catch {
    // Navigation privée, stockage plein : le mode vit alors le temps de la page. Tant pis, pas grave.
  }
  for (const f of abonnes) f();
}

/** Lu à chaque requête par le client d'API — d'où la forme synchrone. */
export const actingAsId = (): string | null => courant?.id ?? null;

export const startActingAs = (salon: ActedSalon): void => poser(salon);
export const stopActingAs = (): void => poser(null);

export function useActingAs(): ActedSalon | null {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => courant,
    () => null,
  );
}
