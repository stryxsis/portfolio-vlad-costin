// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

/**
 * L'URL canonico del sito. UNICA FONTE DI VERITÀ per canonical, sitemap, OG e JSON-LD.
 * Tutto il resto lo legge da `import.meta.env.SITE` (vedi src/lib/site.ts).
 *
 * Cambiare SOLO questa riga: nessun URL è hardcoded altrove nel progetto.
 *
 * ⚠ FINO AL 2026-10-17 ERA ANCORA `https://portfolio-vlad-costin.vercel.app`,
 * mesi dopo che il sito era online sul dominio vero: canonical, sitemap, OG e
 * robots indicavano a Google l'indirizzo di Vercel come quello ufficiale. Gli
 * altri due indirizzi (www e vercel.app) rimandano qui con un 308, in
 * vercel.json.
 */
const SITE_URL = 'https://vladcostin-developer.com';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  // 'never' + build.format 'directory' => canonical == URL in sitemap == URL servito.
  // Zero catene di redirect 308. Le rotte .md/.txt si risolvono solo senza slash finale.
  trailingSlash: 'never',
  build: { format: 'directory' },

  compressHTML: true,

  // ⚠ Prefetch di Astro SPENTO dal 2026-10-12: il suo script (page.js) partiva
  // a ogni caricamento e, sulle pagine leggere, pesava sul thread proprio
  // mentre il browser fotografava la pagina vecchia per il cambio pagina,
  // facendolo saltare. Il prefetch al passaggio del mouse lo fanno ora le
  // speculation rules native, in BaseLayout: stesso effetto, zero JS.
  prefetch: false,

  image: {
    // Nessun host remoto: tutte le immagini sono locali in src/assets e passano da astro:assets.
    domains: [],
    remotePatterns: [],
  },

  /**
   * API Fonts di Astro: stabile dalla v6. NON scrivere @font-face a mano e NON
   * aggiungere <link rel=preload> manuali — Astro scarica, self-hosta, e genera
   * fallback metric-matched (`optimizedFallbacks`), che è ciò che azzera il CLS
   * dovuto allo swap del webfont.
   *
   * Una sola famiglia per display e body: è ciò che produce la pulizia della
   * reference. Il mono è il secondo carattere e fa lavoro semantico (numeri
   * indice, label di sezione, metadati, tag di stack) — non decorazione.
   *
   * Pesi: solo 400 e 500. Niente 700/800/900.
   */
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Geist',
      cssVariable: '--font-geist',
      weights: [400, 500],
      styles: ['normal'],
      // 'latin' basta per l'italiano. Aggiungere 'latin-ext' SOLO se comparirà
      // testo in romeno (ă â î ș ț): costa peso per glifi altrimenti inusati.
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      optimizedFallbacks: true,
      display: 'swap',
    },
  ],

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
