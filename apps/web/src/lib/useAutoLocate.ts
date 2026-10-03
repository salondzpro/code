/**
 * DÉTECTION AUTOMATIQUE DE LA POSITION, À LA PREMIÈRE OUVERTURE.
 *
 * Sans cela, l'application démarre sur Alger — c'est la valeur par défaut des préférences — et
 * quelqu'un à Oran ou à Akbou voit une place de marché qui ne le concerne pas, jusqu'à ce qu'il
 * trouve tout seul le réglage de lieu. On ne fait pas chercher à quelqu'un ce que son téléphone
 * sait déjà.
 *
 * TROIS GARDE-FOUS, parce qu'une application qui redemande la position est vite désinstallée :
 *   - on ne tente RIEN si un lieu a déjà été choisi : une décision de la personne l'emporte
 *     toujours sur le capteur ;
 *   - on ne tente qu'UNE FOIS par installation, et un refus est définitif — on ne repose jamais la
 *     question, le réglage de lieu reste à portée ;
 *   - un relevé qui expire ne compte pas comme un refus : on réessaiera à la prochaine ouverture,
 *     sans nouvelle demande d'autorisation puisqu'elle est déjà accordée.
 *
 * Même code sur le site et dans l'application : la coque remplace `navigator.geolocation` par le
 * greffon natif (`lib/native.ts`), et ce module n'a pas à le savoir.
 */
import { useEffect } from 'react';
import { reverseGeocode } from '@salondz/constants';
import { aDejaUnLieu, writeLocationPrefs } from './clientPrefs';
import { arrondir, positionPrecise } from './position';

const TENTE = 'salondz:location:auto';

export function useAutoLocate(): void {
  useEffect(() => {
    if (aDejaUnLieu() || localStorage.getItem(TENTE)) return;

    let pose = false;
    const ctrl = new AbortController();
    const arret = positionPrecise(
      (m) => {
        localStorage.setItem(TENTE, 'fait');
        const lat = arrondir(m.lat);
        const lng = arrondir(m.lng);
        // Une deuxième mesure, plus précise, ne doit pas réécrire le libellé déjà obtenu : la
        // position se corrige, le nom du quartier ne change pas.
        writeLocationPrefs({ lat, lng, city: null, ...(pose ? {} : { label: 'Ma position' }) });
        if (pose) return;
        pose = true;
        // Le libellé est posé MÊME HORS D'ALGÉRIE (« Roubaix, France ») : voir où l'application
        // pense qu'on se trouve explique d'un coup pourquoi la liste est vide, là où « Ma
        // position » laissait croire à une panne. La distance aux salons fait le reste.
        void reverseGeocode(lat, lng, ctrl.signal).then((r) => {
          if (r?.label) writeLocationPrefs({ label: r.label });
        });
      },
      (err) => {
        // Refus : définitif, on n'insiste jamais. Expiration : on retentera, silencieusement.
        if (err.code === err.PERMISSION_DENIED) localStorage.setItem(TENTE, 'refuse');
      },
    );

    return () => {
      ctrl.abort();
      arret();
    };
  }, []);
}
