/**
 * Référencement Google (20 nov. 2026) : le site est une application d'une seule page, donc chaque
 * adresse recevait le MÊME en-tête (« Salon DZ », sans adresse canonique). On écrit ici, après la
 * construction, une copie de `index.html` par page publique, avec son titre, sa description, son
 * adresse canonique et ses données structurées (schema.org). Render sert chaque copie par une
 * réécriture exacte (`scripts/render-web.mjs`) ; toute autre adresse reçoit `app.html`, sans adresse
 * canonique, pour ne jamais déclarer une page de l'application « double » de l'accueil.
 *
 * Le bloc remplacé est celui entre `<!--seo-->` et `<!--/seo-->` d'`index.html` ; les pages salon le
 * remplacent de la même façon côté API (`apps/api/src/routes/share.ts`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://salondz.com';
const IMAGE = `${SITE}/icon-512.png`;
const CLIENT = {
  '@type': 'MobileApplication',
  name: 'Salon DZ',
  operatingSystem: 'Android, iOS',
  applicationCategory: 'LifestyleApplication',
  url: `${SITE}/`,
  installUrl: ['https://play.google.com/store/apps/details?id=dz.salondz.app', 'https://apps.apple.com/app/id6817317513'],
};
const PRO = {
  '@type': 'MobileApplication',
  name: 'Salon DZ Pro',
  alternateName: ['SalonDZ Pro', 'Salon DZ PRO'],
  operatingSystem: 'Android, iOS, Web',
  applicationCategory: 'BusinessApplication',
  url: `${SITE}/professionnels`,
  description: "Agenda, réservation en ligne 24 h/24 et rappels automatiques pour les coiffeurs, barbiers et instituts de beauté en Algérie.",
  installUrl: ['https://play.google.com/store/apps/details?id=pro.salondz.app', 'https://apps.apple.com/app/id6821947874'],
};
const ORG = {
  '@type': 'Organization',
  '@id': `${SITE}/#organisation`,
  name: 'Salon DZ',
  alternateName: ['SalonDZ', 'salondz.com'],
  url: `${SITE}/`,
  logo: IMAGE,
  areaServed: { '@type': 'Country', name: 'Algérie' },
};

const PAGES = [
  {
    fichier: 'index.html',
    chemin: '/',
    titre: 'Salon DZ — Réservez coiffeur, barbier et institut en Algérie',
    description: 'Réservez en ligne votre coiffeur, barbier ou institut de beauté en Algérie, 24 h/24, sans appeler. Salons à Alger, Oran, Constantine et partout en Algérie.',
    donnees: [ORG, { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Salon DZ', url: `${SITE}/`, inLanguage: ['fr', 'ar', 'en'], publisher: { '@id': `${SITE}/#organisation` } }, CLIENT, PRO],
  },
  {
    fichier: 'professionnels.html',
    chemin: '/professionnels',
    titre: 'Salon DZ Pro — Agenda et réservation en ligne pour salons en Algérie',
    description: 'Salon DZ Pro : votre agenda, vos réservations en ligne 24 h/24, vos rappels et votre lien de réservation. Pour coiffeurs, barbiers et instituts en Algérie.',
    donnees: [ORG, PRO],
  },
  {
    fichier: 'salons.html',
    chemin: '/salons',
    titre: 'Salons de coiffure, barbiers et instituts en Algérie · Salon DZ',
    description: 'Trouvez un coiffeur, un barbier ou un institut de beauté près de chez vous en Algérie et réservez en ligne en quelques secondes.',
    donnees: [ORG],
  },
  { fichier: 'aide.html', chemin: '/aide', titre: 'Aide · Salon DZ', description: 'Questions fréquentes sur la réservation et l’espace professionnel Salon DZ.' },
  { fichier: 'cgu.html', chemin: '/cgu', titre: 'Conditions d’utilisation · Salon DZ', description: 'Conditions générales d’utilisation de Salon DZ.' },
  { fichier: 'confidentialite.html', chemin: '/confidentialite', titre: 'Confidentialité · Salon DZ', description: 'Politique de confidentialité de Salon DZ.' },
  { fichier: 'mentions-legales.html', chemin: '/mentions-legales', titre: 'Mentions légales · Salon DZ', description: 'Mentions légales de Salon DZ.' },
];

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BLOC = /<!--seo-->[\s\S]*?<!--\/seo-->/;

function bloc({ chemin, titre, description, donnees }) {
  const url = chemin ? `${SITE}${chemin}` : null;
  const l = [
    `<title>${esc(titre)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    url && `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Salon DZ" />`,
    `<meta property="og:locale" content="fr_DZ" />`,
    url && `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(titre)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${IMAGE}" />`,
    `<meta name="twitter:card" content="summary" />`,
    donnees && `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': donnees }).replace(/</g, '\u003c')}</script>`,
  ].filter(Boolean);
  return `<!--seo-->\n    ${l.join('\n    ')}\n    <!--/seo-->`;
}

export function pagesPubliques(dist) {
  const base = readFileSync(join(dist, 'index.html'), 'utf8');
  if (!BLOC.test(base)) throw new Error('index.html : bloc <!--seo--> introuvable');
  for (const p of PAGES) writeFileSync(join(dist, p.fichier), base.replace(BLOC, bloc(p)));
  // Coquille des pages de l'application (connexion, agenda…) : ni adresse canonique ni données.
  writeFileSync(join(dist, 'app.html'), base.replace(BLOC, bloc({ titre: 'Salon DZ', description: PAGES[0].description })));
  console.log(`[seo] ${PAGES.length} pages publiques + app.html`);
}

/** Réécritures exactes, pour `scripts/render-web.mjs`. */
export const REECRITURES_SEO = [
  ...PAGES.filter((p) => p.chemin !== '/').map((p) => ({ source: p.chemin, fichier: `/${p.fichier}` })),
  { source: '/home', fichier: '/index.html' },
];
