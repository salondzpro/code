/**
 * VARIANTE de l'application, décidée à la COMPILATION.
 *
 * `VITE_APP_FLAVOR=pro` produit l'application « Salon DZ Pro » : uniquement l'espace
 * professionnel, publiée séparément sur le Play Store sous `pro.salondz.app`.
 *
 * Pourquoi un drapeau de compilation et non un réglage : dans la variante pro, les écrans clients
 * ne doivent pas seulement être cachés, ils ne doivent pas EXISTER. Un drapeau de compilation les
 * retire du bundle — on ne peut pas atteindre par l'adresse un écran qui n'a pas été livré. Un
 * réglage à l'exécution laisserait le code en place, donc atteignable.
 *
 * Le site salondz.com et l'application grand public ne définissent pas cette variable : pour eux,
 * `PRO_ONLY` vaut `false` et rien ne change.
 */
export const PRO_ONLY = import.meta.env.VITE_APP_FLAVOR === 'pro';

/**
 * Coque native (application mobile) ? Lu sur l'objet que Capacitor injecte AVANT la page : connu dès
 * le chargement des modules, donc utilisable pour construire le routeur.
 */
export const NATIF = (() => {
  if (typeof window === 'undefined') return false;
  const w = window as {
    Capacitor?: { isNativePlatform?: () => boolean };
    androidBridge?: unknown;
    webkit?: { messageHandlers?: { bridge?: unknown } };
  };
  // Le pont natif (Android : `androidBridge`, iPhone : `webkit.messageHandlers.bridge`) existe avant
  // tout script de la page — c'est lui que `@capacitor/core` regarde aussi.
  return Boolean(w.Capacitor?.isNativePlatform?.() || w.androidBridge || w.webkit?.messageHandlers?.bridge);
})();

/**
 * LA PLACE DE MARCHÉ (14 nov. 2026, demande du propriétaire). Sur le SITE, salondz.com affiche la page
 * de présentation (`pages/Home.tsx`) et la place de marché vit sur `/salons`. Dans l'APPLICATION, rien
 * ne change : elle s'ouvre sur la place de marché, à la racine. Tout lien vers la place de marché passe
 * par cette constante, jamais par « / » écrit à la main.
 */
export const MARCHE = PRO_ONLY ? '/pro' : NATIF ? '/' : '/salons';

/** Là où l'on atterrit quand on est connecté : l'accueil pro dans la variante pro, sinon la place de marché. */
export const HOME = PRO_ONLY ? '/pro' : MARCHE;
