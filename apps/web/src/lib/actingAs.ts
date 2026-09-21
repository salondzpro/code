/**
 * « Agir en tant que » — un administrateur qui pilote l'espace d'un professionnel.
 *
 * Le cas réel : le pro appelle, il ne trouve pas comment fermer une journée ou corriger un prix.
 * Lui dicter des clics au téléphone ne marche pas ; entrer dans son espace et le faire, si.
 *
 * Ce module retient le JETON DE CONTRÔLE que le serveur a délivré (deux heures, lié à cet
 * administrateur et à ce salon — voir `apps/api/src/lib/control.ts`). Tout le pouvoir est côté
 * serveur : le jeton n'a d'effet que derrière `requireAdmin`, il est vérifié à chaque requête, et
 * chaque écriture faite ainsi laisse une ligne au journal. Fabriquer une valeur ici ne donne rien
 * à personne, et un jeton expiré est refusé même s'il traîne encore dans le stockage.
 *
 * La valeur survit au rechargement (on reste dans le salon en naviguant), et un changement
 * prévient les abonnés : la bannière de l'espace pro se met à jour sans rechargement.
 */
import { useSyncExternalStore } from 'react';

const CLE = 'salondz:admin:control';

export interface ActedSalon {
  id: string;
  name: string;
  /** Le jeton délivré par `POST /v1/admin/salons/:id/control`. */
  token: string;
  /** ISO — l'échéance annoncée par le serveur. */
  expiresAt: string;
}

const vivant = (v: ActedSalon | null): v is ActedSalon =>
  !!v?.id && !!v.token && new Date(v.expiresAt).getTime() > Date.now();

function lire(): ActedSalon | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const v = JSON.parse(brut) as ActedSalon;
    if (vivant(v)) return v;
    // Périmé : on n'attend pas qu'il serve pour le retirer.
    localStorage.removeItem(CLE);
    return null;
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

/** Lu à chaque requête par le client d'API — d'où la forme synchrone. Un jeton périmé ne part plus. */
export const actingAsToken = (): string | null => (vivant(courant) ? courant.token : null);

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
