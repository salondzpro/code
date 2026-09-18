/**
 * Points de rupture lus en JavaScript, pour les rares décisions qu'une feuille de style ne
 * peut pas prendre : NE PAS monter la barre d'onglets quand le rail permanent la remplace,
 * NE PAS monter le rail quand il n'y a pas la place. Tout le reste de l'adaptation
 * tablette / ordinateur se fait en CSS (`styles/index.css`, section « Tablette, ordinateur,
 * grand écran »), qui reste la seule source des largeurs.
 *
 * La valeur est lue au PREMIER rendu (`useSyncExternalStore`) : pas d'effet, donc pas de
 * barre qui apparaît puis disparaît au chargement.
 *
 * Aucun de ces seuils ne descend sous 768 px : le rendu téléphone ne dépend de rien d'ici.
 */
import { useSyncExternalStore } from 'react';

function media(query: string) {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;
  return {
    subscribe: (onChange: () => void) => {
      mq?.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    },
    get: () => !!mq?.matches,
  };
}

/** À partir de 1 024 px : rail de navigation permanent, plus de barre d'onglets flottante. */
const DESKTOP = media('(min-width: 1024px)');

export const useDesktop = (): boolean =>
  useSyncExternalStore(DESKTOP.subscribe, DESKTOP.get, () => false);
