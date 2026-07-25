/**
 * ⚠ QUESTO path esatto: `src/content.config.ts`.
 * `src/content/config.ts` era la posizione legacy della v4 ed è stata RIMOSSA
 * in Astro 6 insieme a `legacy.collections`.
 *
 * Zod è v4: si usa `z.url()` e `z.email()`, non `z.string().url()`.
 *
 * DUE collection, e solo due:
 *  - `projects` (case study) e `blog` hanno prosa, immagini e uno slug pubblico.
 *  - timeline, skill, testimonianze e loghi NON sono collection: hanno
 *    cardinalità fissa, nessun corpo in prosa e vengono riusati nel JSON-LD,
 *    quindi vogliono tipi a compile-time. Stanno in `src/data/*.ts`.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * `!**\/_*` esclude i file con prefisso underscore.
 * Serve davvero: il prefisso _ esclude un file dal ROUTING, non dalla
 * collection. Senza questa negazione, `_template.mdx` viene raccolto come
 * entry, il suo schema validato, e la build FALLISCE cercando la cover
 * `nome-del-progetto/cover.jpg` che per definizione non esiste.
 */
const NO_TEMPLATES = ['**/*.{md,mdx}', '!**/_*'];

const projects = defineCollection({
  loader: glob({ pattern: NO_TEMPLATES, base: './src/content/progetti' }),
  // La forma a funzione è quella che espone l'helper `image()`, che valida il
  // file e lo trasforma in ImageMetadata (larghezza/altezza incluse → CLS 0).
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Riga di sottotitolo mostrata sotto il titolo nel case study. */
      subtitle: z.string(),
      /** Meta description e og:description. Il limite non è estetico: oltre
       *  ~160 caratteri Google tronca. */
      description: z.string().max(160),

      // -- Fatti, quelli che il layout deve posizionare, ordinare o riusare --
      client: z.string().optional(),
      role: z.string(),
      year: z.number().int().min(2015).max(2100),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      stack: z.array(z.string()).default([]),

      /** Risultati misurati. Vivono nel frontmatter e non nel corpo perché
       *  vengono renderizzati come riga di statistiche E finiscono nel JSON-LD. */
      metrics: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .default([]),

      cover: image(),
      coverAlt: z.string(),
      gallery: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      /** Se assente, l'immagine OG viene derivata dalla cover. */
      ogImage: image().optional(),

      liveUrl: z.url().optional(),
      repoUrl: z.url().optional(),

      /** In evidenza nella Home. */
      featured: z.boolean().default(false),
      /** Ordine nella griglia; più basso = prima. */
      order: z.number().default(999),
      /** Ampiezza della card nella griglia non ortogonale del portfolio. */
      span: z.enum(['small', 'wide', 'tall', 'full']).default('small'),
      draft: z.boolean().default(false),
    }),
});

const blog = defineCollection({
  loader: glob({ pattern: NO_TEMPLATES, base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().max(160),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      /** default true: un articolo non è pubblicato finché non lo si dichiara. */
      draft: z.boolean().default(true),
    }),
});

export const collections = { projects, blog };