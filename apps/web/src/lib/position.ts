/**
 * POSITION DE LA PERSONNE, PRÉCISE ET EN DEUX TEMPS.
 *
 * Pourquoi ce module existe : les écrans appelaient `getCurrentPosition` avec
 * `enableHighAccuracy: false` et `maximumAge: 300000`. Les deux sont des erreurs, et elles se
 * cumulent.
 *   - sans haute précision, Android rend une position RÉSEAU, déduite des antennes : en Algérie
 *     elle tombe couramment à plusieurs kilomètres, parfois dans une autre commune ;
 *   - avec un cache de cinq minutes, il peut même rendre un relevé d'il y a cinq minutes, pris
 *     avant que la personne ne monte dans un bus.
 * Quelqu'un qui appuie sur « ma position » demande où il est MAINTENANT. On prend donc le GPS, et
 * on ne ressert rien de périmé.
 *
 * EN DEUX TEMPS, parce qu'un point GPS froid met dix à trente secondes à se fixer : on remonte la
 * PREMIÈRE mesure dès qu'elle arrive — souvent le réseau, à quelques centaines de mètres — pour que
 * l'écran bouge tout de suite, puis chaque mesure meilleure que la précédente, jusqu'à la précision
 * visée. L'appelant n'a rien à arbitrer : il reçoit des positions de plus en plus justes.
 */
export interface Mesure {
  lat: number;
  lng: number;
  /** Rayon d'incertitude en mètres, tel que l'appareil le déclare. */
  acc: number;
}

export interface OptionsPosition {
  /** En dessous, on considère que c'est bon et on relâche le capteur. */
  precisionM?: number;
  /** Au-delà, on s'arrête avec ce qu'on a (ou on échoue si l'on n'a rien). */
  delaiMs?: number;
}

const ABSENT = { code: 2, message: 'Position indisponible sur cet appareil', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
const EXPIRE = { code: 3, message: 'Position introuvable dans le temps imparti', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;

/**
 * Suit la position jusqu'à obtenir la précision visée, puis s'arrête tout seul.
 * Rend une fonction d'arrêt — à appeler si l'écran est quitté avant la fin, sinon le GPS reste
 * allumé.
 */
export function positionPrecise(
  onMesure: (m: Mesure) => void,
  onEchec: (err: GeolocationPositionError) => void,
  { precisionM = 60, delaiMs = 20_000 }: OptionsPosition = {},
): () => void {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onEchec(ABSENT);
    return () => undefined;
  }

  let arrete = false;
  let meilleure = Infinity;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let veille: number | null = null;

  const stop = () => {
    if (arrete) return;
    arrete = true;
    if (minuteur) clearTimeout(minuteur);
    if (veille !== null) navigator.geolocation.clearWatch(veille);
  };

  veille = navigator.geolocation.watchPosition(
    (p) => {
      if (arrete) return;
      const acc = p.coords.accuracy ?? 0;
      // Une mesure MOINS bonne que celle qu'on a déjà ne doit pas faire reculer l'écran : le point
      // sauterait d'un quartier à l'autre pendant que le GPS se fixe.
      if (meilleure < Infinity && acc > meilleure * 1.5) return;
      meilleure = Math.min(meilleure, acc || meilleure);
      onMesure({ lat: p.coords.latitude, lng: p.coords.longitude, acc });
      if (acc > 0 && acc <= precisionM) stop();
    },
    (err) => {
      // Un refus est définitif : on arrête et on le dit. Une mesure qui expire, non — le GPS peut
      // encore se fixer, et couper là ramènerait à la position réseau qu'on cherche justement à
      // éviter.
      if (err.code === err.PERMISSION_DENIED) {
        stop();
        onEchec(err);
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: delaiMs },
  );

  minuteur = setTimeout(() => {
    const rienRecu = meilleure === Infinity;
    stop();
    if (rienRecu) onEchec(EXPIRE);
  }, delaiMs);

  return stop;
}

/** Arrondi d'affichage : 4 décimales ≈ 11 m, la précision utile pour chercher un salon. */
export const arrondir = (n: number): number => Number(n.toFixed(4));
