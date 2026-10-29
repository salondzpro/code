/**
 * Lien COURT d'un salon, imprimé sur les étiquettes : `salondz.com/<slug>` au lieu de
 * `salondz.com/s/<slug>` (29 oct. 2026). Le site redirige `/<slug>` vers `/s/<slug>` côté
 * navigateur ; `/s/` reste l'adresse de référence (aperçu de partage WhatsApp/Facebook, liens
 * universels, sitemap) et tout lien existant continue de marcher.
 *
 * Un nom de salon qui tombe sur une page du site (`pro`, `aide`, `connexion`…) garde la forme
 * `/s/` : son étiquette ne doit jamais ouvrir autre chose que sa page. **Une nouvelle adresse de
 * premier niveau sur le site doit être ajoutée ici AVANT d'être publiée** — une étiquette imprimée
 * ne se corrige pas.
 */
export const RESERVED_ROOT_SEGMENTS: readonly string[] = [
  // Pages du site (apps/web/src/app/router.tsx)
  'admin', 'aide', 'bienvenue', 'carte', 'categorie', 'cgu', 'compte', 'confidentialite', 'connexion',
  'favoris', 'home', 'inscription', 'intro', 'localisation', 'marche', 'mentions-legales', 'notifications',
  'pro', 'profil', 'reglages', 'rendez-vous', 's', 'supprimer',
  // Réécritures et fichiers servis par le site ou l'API
  'moi', 'sitemap', 'share', 'api', 'assets', 'fonts', 'demo', 'well-known', 'robots', 'index', 'sw',
  'manifest', 'favicon', 'icon', 'hors-ligne', 'static', 'v1', 'internal',
  // Réservés pour des pages à venir
  'salon', 'salons', 'recherche', 'search', 'reserver', 'reservation', 'reservations', 'login', 'signup',
  'contact', 'blog', 'offres', 'tarifs', 'pricing', 'a-propos', 'about', 'legal', 'help', 'support',
  'app', 'application', 'telecharger', 'download', 'presse', 'partenaires', 'emploi', 'jobs', 'pros',
  'professionnels', 'clients', 'avis', 'cadeau', 'cadeaux', 'carte-cadeau', 'parrainage', 'promo',
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Le slug peut-il être servi à la racine du site ? */
export function isRootSlug(slug: string): boolean {
  return SLUG.test(slug) && !RESERVED_ROOT_SEGMENTS.includes(slug);
}

/** Chemin le plus court qui mène à la page du salon. */
export function shortSalonPath(slug: string): string {
  return isRootSlug(slug) ? `/${slug}` : `/s/${slug}`;
}
