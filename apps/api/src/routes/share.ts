/**
 * Aperçu de partage des pages salon (WhatsApp, Instagram, Facebook, Messenger…).
 *
 * Le site est statique : `salondz.com/s/:slug` renvoie le même index.html pour tout le monde, sans titre
 * ni image propres au salon — un lien collé sur WhatsApp affichait « Salon DZ » tout court. Le site
 * réécrit donc `/s/*` vers cette route (proxy Render) : on renvoie LE MÊME index.html, enrichi des balises
 * Open Graph du salon. Les humains obtiennent l'application inchangée (les scripts sont relatifs, servis
 * par le site) ; les robots lisent le nom, la photo et l'adresse. Aucun HTML ne vient de l'utilisateur
 * sans échappement.
 */
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../lib/supabase';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** index.html du site, gardé une minute : un déploiement du site est visible au prochain rafraîchissement. */
let shell: { html: string; at: number } | null = null;
async function loadShell(): Promise<string | null> {
  if (shell && Date.now() - shell.at < 60_000) return shell.html;
  try {
    const res = await fetch(`${config.webUrl}/index.html`, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return shell?.html ?? null;
    const html = await res.text();
    shell = { html, at: Date.now() };
    return html;
  } catch {
    return shell?.html ?? null;
  }
}

/**
 * L'en-tête de référencement du site est entre `<!--seo-->` et `<!--/seo-->` (`apps/web/index.html`,
 * pages publiques écrites par `apps/web/scripts/seo-pages.mjs`) : on le remplace en entier, sinon la
 * page salon garderait l'adresse canonique de l'accueil et Google la prendrait pour un double.
 */
function remplacerBloc(html: string, tags: string): string {
  const bloc = /<!--seo-->[\s\S]*?<!--\/seo-->/;
  if (bloc.test(html)) return html.replace(bloc, () => tags);
  return html.replace(/<title>[^<]*<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', () => `    ${tags}\n  </head>`);
}

type SalonSeo = {
  name: string;
  description: string | null;
  city: string | null;
  zone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating_avg: number | string | null;
  rating_count: number | null;
};

/** Données structurées schema.org du salon (Google : nom, adresse, position, note). */
function donneesSalon(s: SalonSeo, url: string, image: string): string {
  const d: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    '@id': `${url}#salon`,
    name: s.name,
    url,
    image,
    address: {
      '@type': 'PostalAddress',
      ...(s.address ? { streetAddress: s.address } : {}),
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.zone ? { addressRegion: s.zone } : {}),
      addressCountry: 'DZ',
    },
  };
  if (s.description?.trim()) d.description = s.description.trim().slice(0, 300);
  if (s.lat != null && s.lng != null) d.geo = { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng };
  if (s.rating_count) d.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(s.rating_avg).toFixed(1), reviewCount: s.rating_count, bestRating: 5 };
  return JSON.stringify(d).replace(/</g, '\\u003c');
}

const shareRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Plan du site pour les moteurs : pages fixes et salons publiés (mis en cache une heure). */
  app.get('/sitemap.xml', async (_req, reply) => {
    const res = await db.from('salons').select('slug, updated_at').eq('is_visible', true).order('updated_at', { ascending: false }).limit(5000);
    if (res.error) throw res.error;
    const fixed = ['/', '/professionnels', '/salons', '/aide', '/cgu', '/confidentialite', '/mentions-legales'];
    const urls = [
      ...fixed.map((p) => `  <url><loc>${esc(config.webUrl + p)}</loc></url>`),
      ...(res.data ?? []).map((s) => `  <url><loc>${esc(`${config.webUrl}/s/${s.slug}`)}</loc><lastmod>${String(s.updated_at).slice(0, 10)}</lastmod></url>`),
    ];
    reply.removeHeader('content-security-policy');
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  });

  /**
   * Le site réécrit TOUT `/s/*` vers ici, y compris les pages profondes d'un salon
   * (`/s/:slug/avis`, `/s/:slug/prestations`, `/s/:slug/reserver/…`). Sans la variante générique,
   * ces adresses tombaient sur « Route introuvable » en JSON dès qu'on les ouvrait directement :
   * un lien partagé vers les avis, un favori, ou simplement un rafraîchissement pendant une
   * réservation. La navigation À L'INTÉRIEUR de l'application ne passant pas par le serveur, le
   * défaut restait invisible.
   *
   * Les deux servent la même coque et les mêmes balises : elles décrivent le salon, ce qui reste
   * vrai pour ses sous-pages.
   */
  for (const chemin of ['/share/s/:slug', '/share/s/:slug/*'] as const)
  app.get(chemin, { schema: { params: z.object({ slug: z.string().min(1).max(80) }) } }, async (req, reply) => {
    const html = await loadShell();
    // Le site statique ne répond pas : on renvoie le visiteur au site lui-même (sans balises).
    if (!html) return reply.redirect(`${config.webUrl}/?salon=${encodeURIComponent(req.params.slug)}`, 302);

    const res = await db
      .from('salons')
      .select('slug, name, description, city, zone, address, lat, lng, cover_url, logo_url, is_visible, rating_avg, rating_count')
      .eq('slug', req.params.slug)
      .maybeSingle();
    const s = res.data;
    // Cette page est une page web, pas une réponse JSON : la CSP « rien du tout » de l'API ne s'applique pas.
    reply.removeHeader('content-security-policy');
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300');
    // visible = publié ET non masqué par la plateforme ; sinon, rien à indexer à cette adresse.
    if (!s || !s.is_visible) return remplacerBloc(html, '<title>Salon DZ</title>\n    <meta name="robots" content="noindex">');

    const url = `${config.webUrl}/s/${s.slug}`;
    // Quartier et commune portent souvent le même nom (« Daïra Akbou, Daïra Akbou ») : une seule fois.
    const where = [...new Map([s.zone, s.city].filter((x): x is string => !!x?.trim()).map((x) => [x.trim().toLowerCase(), x.trim()])).values()].join(', ');
    const rating = s.rating_count ? ` · ${Number(s.rating_avg).toFixed(1).replace('.', ',')} ★ (${s.rating_count})` : '';
    const title = `${s.name} · Salon DZ`;
    const description = (s.description?.trim() || `${where ? `${where} · ` : ''}Réservez en ligne, 24 h/24${rating}.`).slice(0, 200);
    // Image de partage : la photo du salon, sinon l'image 1200 × 630 de Salon DZ (les réseaux refusent le SVG).
    const image = s.cover_url || s.logo_url || `${config.webUrl}/og/salondz.png`;
    const tags = [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(description)}">`,
      `<link rel="canonical" href="${esc(url)}">`,
      `<meta property="og:type" content="business.business">`,
      `<meta property="og:site_name" content="Salon DZ">`,
      `<meta property="og:locale" content="fr_DZ">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${esc(url)}">`,
      `<meta property="og:image" content="${esc(image)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(description)}">`,
      `<meta name="twitter:image" content="${esc(image)}">`,
      `<script type="application/ld+json">${donneesSalon(s, url, image)}</script>`,
    ].join('\n    ');
    return remplacerBloc(html, tags);
  });
};

export default shareRoutes;
