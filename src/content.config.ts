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
import { HEX, paletteProblems } from './lib/palette';

const hex = z.string().regex(HEX, 'colore atteso come #rgb o #rrggbb, senza alfa');

/**
 * La palette del progetto (vedi src/lib/palette.ts). Opzionale: senza, il case
 * study usa i colori del sito. ⚠ Il contrasto delle coppie che il layout usa
 * davvero è verificato QUI: una palette sotto soglia non compila.
 */
const palette = z
  .object({
    background: hex,
    surface: hex,
    accent: hex,
    accentSecondary: hex.optional(),
    border: hex,
    text: hex,
    textMuted: hex,
  })
  .superRefine((p, ctx) => {
    for (const message of paletteProblems(p)) ctx.addIssue({ code: 'custom', message });
  });

/**
 * Un risultato. ⚠ `verified` è FALSE di default, ed è la riga che conta di più
 * in tutto lo schema: una metrica compare nel case study, nel mirror .md e nel
 * JSON-LD SOLO se è dichiarata verificata, e una metrica verificata DEVE dire
 * da dove viene. Così un `[placeholder]` dimenticato nel frontmatter non
 * diventa mai un numero pubblicato: resta nel file, invisibile.
 */
const metric = z
  .object({
    label: z.string(),
    value: z.string(),
    unit: z.string().optional(),
    /** Da dove viene il numero: "Google Analytics del cliente", "log del server"… */
    source: z.string().optional(),
    /** Su quale intervallo: "ott–dic 2025". */
    period: z.string().optional(),
    /** Come è stato misurato, se non è ovvio dalla fonte. */
    method: z.string().optional(),
    /** Il valore di partenza, se il risultato è un confronto. */
    baseline: z.string().optional(),
    /** `benchmark` = misura tecnica di laboratorio (es. peso di pagina);
     *  `cliente` = risultato osservato sul progetto vero. Si rendono distinti. */
    kind: z.enum(['cliente', 'benchmark']).default('cliente'),
    verified: z.boolean().default(false),
  })
  .refine((m) => !m.verified || Boolean(m.source), {
    message: 'una metrica `verified: true` deve dichiarare `source`',
  })
  .refine((m) => !m.verified || !/placeholder/i.test(m.value), {
    message: 'una metrica verificata non può avere un valore segnaposto',
  });

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

      /** Risultati. Vivono nel frontmatter e non nel corpo perché vengono
       *  renderizzati come modulo dedicato E riusati nel mirror .md. Si
       *  pubblicano SOLO quelli `verified` — vedi `metric` qui sopra. */
      metrics: z.array(metric).default([]),

      /** Tipologia mostrata nel palco ("Gestionale web", "Sito evento"…). */
      category: z.string().optional(),

      /**
       * `demo` = progetto di ESEMPIO, contenuti segnaposto. Resta pubblicato
       * (gli URL esistono già e non devono rompersi), ma il palco lo dichiara a
       * voce alta invece di lasciarlo passare per un case study verificato.
       * Diverso da `draft`, che invece non viene pubblicato affatto.
       */
      status: z.enum(['published', 'demo']).default('published'),

      palette: palette.optional(),

      cover: image(),
      coverAlt: z.string(),
      /**
       * Cosa è la cover. `screenshot` = il prodotto vero; `illustration` =
       * un'immagine astratta che lo evoca. Il palco lo DICE (una label accanto
       * al visual): un'illustrazione non deve passare per uno screenshot.
       */
      coverKind: z.enum(['screenshot', 'illustration']).default('illustration'),
      /**
       * Come la cover riempie la cornice del palco. `contain` non ritaglia
       * niente (lo screenshot resta intero, con del margine); `cover` ritaglia
       * e allora conta `coverFocal`. In nessuno dei due casi la bitmap si
       * deforma: cambia la cornice, mai le proporzioni dell'immagine.
       */
      coverFit: z.enum(['contain', 'cover']).default('cover'),
      /** Il punto da tenere in vista quando la cover è ritagliata, in % (0–100). */
      coverFocal: z
        .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
        .default({ x: 50, y: 50 }),
      /** Screenshot della versione mobile, SOLO se esiste davvero. */
      coverMobile: image().optional(),
      coverMobileAlt: z.string().optional(),
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
    })
    .refine((d) => !d.coverMobile || Boolean(d.coverMobileAlt), {
      message: '`coverMobile` richiede `coverMobileAlt`',
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