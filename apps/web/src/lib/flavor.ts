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

/** Là où l'on atterrit quand on est connecté : l'accueil pro dans la variante pro, sinon la place de marché. */
export const HOME = PRO_ONLY ? '/pro' : '/';
