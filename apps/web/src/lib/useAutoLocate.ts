/**
 * POSITION À LA PREMIÈRE OUVERTURE (refonte du 20 nov. 2026, demande du propriétaire) : la première
 * chose qu'une cliente voit sur la place de marché est une fenêtre qui DIT que l'on affiche Alger par
 * défaut et lui propose sa position (`components/LocationGate.tsx`) — puis seulement la question du
 * téléphone. Avant, la question du système partait d'office, sans explication.
 *
 * États (`salondz:location:auto`) :
 *   - absent      → jamais demandé : la fenêtre s'affiche (si aucun lieu n'a été choisi) ;
 *   - `demande`   → accepté dans la fenêtre, pas encore mesuré : on mesure à chaque ouverture,
 *                   sans nouvelle demande d'autorisation (déjà donnée) ;
 *   - `fait`      → position posée ;
 *   - `refuse`    → refus du système : définitif, on ne repose jamais la question ;
 *   - `alger`     → « Rester sur Alger » : définitif aussi, le réglage de lieu reste à portée.
 *
 * Même code sur le site et dans l'application : la coque remplace `navigator.geolocation` par le
 * greffon natif (`lib/native.ts`).
 */
import { useEffect } from 'react';
import { reverseGeocode } from '@salondz/constants';
import { aDejaUnLieu, writeLocationPrefs } from './clientPrefs';
import { arrondir, positionPrecise } from './position';

const TENTE = 'salondz:location:auto';

const lire = (): string | null => {
  try {
    return localStorage.getItem(TENTE);
  } catch {
    return null;
  }
};
const ecrire = (v: string) => {
  try {
    localStorage.setItem(TENTE, v);
  } catch {
    /* stockage indisponible : la fenêtre reviendra, rien de grave */
  }
};

/** La fenêtre « Par défaut : Alger » doit-elle s'afficher ? */
export function positionADemander(): boolean {
  return !aDejaUnLieu() && !lire();
}

/** « Rester sur Alger » : on ne redemande plus. */
export function resterSurAlger(): void {
  ecrire('alger');
}

/**
 * Mesure la position et la pose comme lieu de recherche. Rend une fonction d'arrêt.
 * `onFin` reçoit `true` si une position a été posée, `false` sinon (refus, échec).
 */
export function localiser(onFin?: (ok: boolean) => void): () => void {
  if (lire() !== 'fait') ecrire('demande');
  let pose = false;
  const ctrl = new AbortController();
  const arret = positionPrecise(
    (m) => {
      ecrire('fait');
      const lat = arrondir(m.lat);
      const lng = arrondir(m.lng);
      // Une deuxième mesure, plus précise, ne réécrit pas le libellé déjà obtenu.
      writeLocationPrefs({ lat, lng, city: null, ...(pose ? {} : { label: 'Ma position' }) });
      if (pose) return;
      pose = true;
      onFin?.(true);
      // Le libellé est posé MÊME HORS D'ALGÉRIE (« Roubaix, France ») : il explique une liste vide.
      void reverseGeocode(lat, lng, ctrl.signal).then((r) => {
        if (r?.label) writeLocationPrefs({ label: r.label });
      });
    },
    (err) => {
      // Refus : définitif, on n'insiste jamais. Expiration : on retentera à la prochaine ouverture.
      if (err.code === err.PERMISSION_DENIED) ecrire('refuse');
      if (!pose) onFin?.(false);
    },
  );
  return () => {
    ctrl.abort();
    arret();
  };
}

/** À chaque ouverture : reprend une mesure ACCEPTÉE mais pas encore aboutie. Ne demande jamais rien. */
export function useAutoLocate(): void {
  useEffect(() => {
    if (aDejaUnLieu() || lire() !== 'demande') return;
    return localiser();
  }, []);
}
