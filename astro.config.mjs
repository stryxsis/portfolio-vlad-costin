// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

/**
 * L'URL canonico del sito. UNICA FONTE DI VERITÀ per canonical, sitemap, OG e JSON-LD.
 * Tutto il resto lo legge da `import.meta.env.SITE` (vedi src/lib/site.ts).
 *
 * [placeholder] Sostituire con il dominio definitivo quando verrà acquistato.
 * Cambiare SOLO questa riga: nessun URL è hardcoded altrove nel progetto.
 */
const SITE_URL = 'https://portfolio-vlad-costin.vercel.app';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  // 'never' + build.format 'directory' => canonical == URL in sitemap == URL servito.
  // Zero catene di redirect 308. Le rotte .md/.txt si risolvono solo senza slash finale.
  trailingSlash: 'never',
  build: { format: 'directory' },

  compressHTML: true,

  // Prefetch degli hover sui link interni: navigazione percepita istantanea senza ClientRouter.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  image: {
    // Nessun host remoto: tutte le immagini sono locali in src/assets e passano da astro:assets.
    domains: [],
    remotePatterns: [],
  },

  integrations: [
    sitemap({
      // 404 e pagine di servizio non devono finire in sitemap.
      filter: (page) => !['/404', '/grazie'].some((p) => page.includes(p)),
      changefreq: 'monthly',
      lastmod: new Date(),
    }),
    mdx(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
