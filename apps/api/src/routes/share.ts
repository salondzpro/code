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

const shareRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Plan du site pour les moteurs : pages fixes et salons publiés (mis en cache une heure). */
  app.get('/sitemap.xml', async (_req, reply) => {
    const res = await db.from('salons').select('slug, updated_at').eq('is_published', true).order('updated_at', { ascending: false }).limit(5000);
    if (res.error) throw res.error;
    const fixed = ['/', '/aide', '/cgu', '/confidentialite', '/mentions-legales'];
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
      .select('slug, name, description, city, zone, cover_url, logo_url, is_published, rating_avg, rating_count')
      .eq('slug', req.params.slug)
      .maybeSingle();
    const s = res.data;
    // Cette page est une page web, pas une réponse JSON : la CSP « rien du tout » de l'API ne s'applique pas.
    reply.removeHeader('content-security-policy');
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300');
    if (!s || !s.is_published) return html;

    const url = `${config.webUrl}/s/${s.slug}`;
    const where = [s.zone, s.city].filter(Boolean).join(', ');
    const rating = s.rating_count ? ` · ${Number(s.rating_avg).toFixed(1).replace('.', ',')} ★ (${s.rating_count})` : '';
    const title = `${s.name} · Salon DZ`;
    const description = (s.description?.trim() || `${where ? `${where} · ` : ''}Réservez en ligne, 24 h/24${rating}.`).slice(0, 200);
    const image = s.cover_url || s.logo_url || `${config.webUrl}/icon-maskable.svg`;
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
    ].join('\n    ');
    return html.replace(/<title>[^<]*<\/title>/, '').replace(/<meta name="description"[^>]*>/, '').replace('</head>', `    ${tags}\n  </head>`);
  });
};

export default shareRoutes;
