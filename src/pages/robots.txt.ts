/**
 * /robots.txt — generato in build, non scritto a mano in /public.
 *
 * Il motivo è uno solo: l'indirizzo della sitemap deve essere ASSOLUTO, e
 * l'unico posto in cui vive il dominio è `site` in astro.config.mjs. Un file
 * statico lo ricopierebbe, e cambiando dominio resterebbe a indicare quello
 * vecchio — che è esattamente il difetto trovato il 2026-10-17 su canonical e
 * sitemap.
 *
 * Fino a quella data il file non esisteva affatto: `/robots.txt` rispondeva
 * con la pagina 404, e i motori non avevano un indirizzo da cui partire per
 * trovare la sitemap.
 *
 * `/api/` è la funzione del modulo contatti: accetta solo POST, e un GET
 * risponde 405. Non c'è niente da indicizzare.
 */
import type { APIRoute } from 'astro';
import { abs } from '../lib/seo';

export const GET: APIRoute = () =>
  new Response(
    ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${abs('/sitemap-index.xml')}`, ''].join(
      '\n'
    ),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
