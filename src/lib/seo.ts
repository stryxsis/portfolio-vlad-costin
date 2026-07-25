/**
 * IL CONTRATTO SUGLI URL.
 *
 * Un solo punto in cui si costruiscono URL assoluti, così canonical, sitemap,
 * Open Graph e JSON-LD non possono mai divergere.
 *
 * Perché non usare `Astro.url`: in dev vale `http://localhost:4321/...`, in
 * build vale il path della pagina. Usarlo per il canonical produce canonical
 * sbagliati in locale e fragili in produzione. `import.meta.env.SITE` è invece
 * sempre il dominio canonico configurato.
 *
 * Il sito è configurato con `trailingSlash: 'never'`, quindi tutte le funzioni
 * qui NORMALIZZANO togliendo lo slash finale: canonical == URL in sitemap ==
 * URL servito. Zero catene di redirect 308.
 */

import { SITE_URL } from './site';

/**
 * Normalizza un path: garantisce lo slash iniziale, rimuove quello finale,
 * collassa gli slash doppi. La root resta '/'.
 */
export function normalizePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  const collapsed = withLeading.replace(/\/{2,}/g, '/');
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '');
}

/** Trasforma un path (o un URL già assoluto) in URL assoluto sul dominio canonico. */
export function abs(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(normalizePath(pathOrUrl), SITE_URL).href;
}

/**
 * L'URL canonico di una pagina. `Astro.url.pathname` è la fonte del path
 * (corretta), ma l'origin viene sempre da `site`.
 */
export function canonicalFor(pathname: string): string {
  return abs(pathname);
}

/** Compone il titolo: la home usa il titolo pieno, le altre il template. */
export function titleFor(title: string | undefined, titleDefault: string, template: string): string {
  if (!title) return titleDefault;
  return template.replace('%s', title);
}