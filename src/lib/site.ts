/**
 * ★ UNICA FONTE DI VERITÀ per tutti i dati di identità del sito.
 *
 * Regole:
 * - Nessun URL, email, nome o handle va scritto a mano in un componente.
 *   Se serve un dato di identità, si importa da qui.
 * - L'URL base NON sta qui: sta in `astro.config.mjs` come `site`, e si legge
 *   da `import.meta.env.SITE`. Così esiste in un solo posto e Astro lo usa
 *   anche per sitemap e canonical.
 */

/** URL canonico, letto dalla config Astro. Non duplicarlo. */
export const SITE_URL = import.meta.env.SITE;

export const SITE = {
  /** Nome del sito, usato in og:site_name e nel titolo. */
  name: 'Vlad Costin',
  /** Titolo di default e suffisso dei titoli di pagina. */
  titleDefault: 'Vlad Costin — Sviluppatore e studente di Ingegneria Informatica',
  titleTemplate: '%s — Vlad Costin',
  locale: 'it_IT',
  lang: 'it',
  /** Lingua per i campi `inLanguage` di Schema.org. */
  inLanguage: 'it-IT',

  /**
   * LA STRINGA BIO CANONICA. Una sola, riusata in: meta description di default,
   * JSON-LD Person.description, llms.txt, og:description della home.
   * Terza persona ed entità nominate esplicitamente: è la forma che un motore
   * di risposta generativo può citare senza doverla riscrivere.
   */
  bio:
    'Vlad Costin è uno sviluppatore e studente di Ingegneria Informatica ' +
    "all'Università di Parma. Costruisce interfacce e applicazioni web, con " +
    'esperienza in JavaScript, PHP, Python, C++ e SQL, e lavora come developer ' +
    'presso JEParma. Vive a Colorno, in provincia di Parma.',

  /** Versione breve per meta description (≤160 caratteri). */
  description:
    'Sviluppatore e studente di Ingegneria Informatica a Parma. Progetto e ' +
    'costruisco interfacce e applicazioni web che risolvono problemi reali.',

  author: {
    name: 'Vlad Costin',
    givenName: 'Vlad',
    familyName: 'Costin',
    jobTitle: 'Sviluppatore web',
    email: 'vladcostin58@gmail.com',
    /**
     * Località. Scelta di privacy deliberata: numero di telefono e data di
     * nascita NON compaiono sul sito pubblico. Contatto solo via email e form.
     */
    location: { locality: 'Colorno', region: 'Emilia-Romagna', country: 'IT' },
    locationLabel: 'Colorno (PR), Italia',
    languages: ['Italiano (madrelingua)', 'Romeno (madrelingua)', 'Inglese (intermedio)'],
    /** Profili pubblici, usati in JSON-LD `sameAs`. */
    sameAs: [
      // [placeholder] Inserire gli URL reali; le voci vuote vengono filtrate.
      // 'https://www.linkedin.com/in/...',
      // 'https://github.com/...',
    ] as string[],
  },

  /** Immagine Open Graph di default: 1200x630, PNG, in /public/og/. */
  ogImage: { path: '/og/default.png', width: 1200, height: 630, alt: 'Vlad Costin' },

  /**
   * Il CV. Il nome file è un URL pubblico stabile: una volta condiviso,
   * NON si rinomina più.
   */
  cv: {
    path: '/cv/vlad-costin-cv.pdf',
    label: 'Scarica il CV (PDF)',
    // [placeholder] Aggiornare quando il PDF viene sostituito.
    updated: '[mese anno]',
    sizeLabel: '[--] KB',
  },

  /**
   * FEATURE FLAG — sezioni la cui esistenza dipende da contenuti che non ci
   * sono ancora. Il componente e i dati esistono già: cambia solo il flag.
   */
  features: {
    /** Nessuna testimonianza reale disponibile: sezione non renderizzata. */
    testimonials: false,
    /** Il blog arriva in fase 2, quando esisterà il primo articolo. */
    blog: false,
  },
} as const;

/** Navigazione principale. Gli URL sono definitivi: un URL è l'ID permanente
 *  di una pagina, rinominarlo butta via ogni citazione ottenuta. */
export const NAV = [
  { href: '/chi-sono', label: 'Chi sono' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/contatti', label: 'Contatti' },
] as const;