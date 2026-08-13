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
   * LA STRINGA BIO CANONICA, destinata a: JSON-LD Person.description,
   * llms.txt, meta description e og:description di default.
   * Terza persona ed entità nominate esplicitamente: è la forma che un motore
   * di risposta generativo può citare senza doverla riscrivere.
   *
   * ⚠ DAL 2026-08-13 NESSUNO LA LEGGE, come già succede a `sameAs` qui sotto,
   * e per la stessa ragione: i suoi consumatori (JSON-LD, llms.txt) non sono
   * ancora stati costruiti. L'unico posto che la stampava era la hero di
   * /chi-sono, passata a `bioIo` perché lì parla Vlad e non un catalogo.
   * NON è codice morto da cancellare — è la stringa che quei consumatori
   * useranno il giorno in cui esistono, ed è scritta nella forma che serve a
   * loro. Chi la cancella dovrà riscriverla identica.
   */
  bio:
    'Vlad Costin è uno sviluppatore e studente di Ingegneria Informatica ' +
    "all'Università di Parma. Costruisce interfacce e applicazioni web, con " +
    'esperienza in JavaScript, PHP, Python, C++ e SQL, e lavora come developer ' +
    'presso JEParma. Vive a Colorno, in provincia di Parma.',

  /**
   * LA BIO IN PRIMA PERSONA — quella che si LEGGE, nella hero di /chi-sono.
   * Testo dettato da Vlad il 2026-08-13.
   *
   * ⚠ NON È UN DOPPIONE DI `bio`, ed è il motivo per cui sta appiccicata a
   * lei invece che dentro la pagina: le due stringhe hanno voce e
   * destinatario diversi e NON sono intercambiabili. `bio` è in terza
   * persona con le entità nominate per esteso perché il suo lettore è una
   * macchina (JSON-LD, llms.txt, meta description): un motore generativo la
   * cita così com'è, e riscritta in prima persona citerebbe "sono" senza
   * sapere chi parla. Questa invece è la voce di Vlad sulla pagina che parla
   * di lui, ed è l'unica delle due che un essere umano legge.
   *
   * ⚠ I FATTI DENTRO SONO GLI STESSI: cambiando lavoro, ateneo o linguaggi
   * si toccano ENTRAMBE. Stanno adiacenti apposta — chi apre questo file per
   * aggiornarne una si trova l'altra sotto gli occhi.
   */
  bioIo:
    'Sono Vlad Costin. Se c’è una cosa che mi definisce è che non sto mai ' +
    'fermo. Sono uno studente di Ingegneria Informatica all’Unipr e, ' +
    'contemporaneamente, uno sviluppatore. Che sia JavaScript, PHP, Python, ' +
    'C++ o SQL, il mio obiettivo è uno solo: costruire interfacce solide e ' +
    'app che risolvono problemi.',

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
     * WhatsApp — canale di contatto della CTA finale.
     *
     * ⚠⚠ QUESTO CAMPO PUBBLICA IL NUMERO DI TELEFONO, e lo fa per scelta
     * esplicita di Vlad (2026-08-06), che ha revocato la regola precedente
     * ("numero di telefono e data di nascita non compaiono da nessuna parte nel
     * sito pubblico"). Non è un'omissione: `wa.me` non ha nessuna variante che
     * nasconda il numero — sta nell'URL, quindi nell'HTML servito, quindi
     * leggibile da qualunque scraper. Chi rimuove WhatsApp dalla CTA rimuova
     * anche questo campo, o resta un numero pubblicato senza nessuno che lo usi.
     *
     * ⚠ LA DATA DI NASCITA RESTA NON PUBBLICATA: la revoca riguarda solo il
     * telefono, non l'intera regola di privacy.
     *
     * `number` è in formato E.164 senza `+` né spazi, come pretende wa.me.
     * `url` è precomposto qui e non nei componenti, così il numero esiste in un
     * solo posto anche se un domani lo si usa altrove.
     */
    whatsapp: {
      number: '393515173372',
      label: '+39 351 517 3372',
      /* Messaggio precompilato: chi arriva da qui ha già scrollato tutta la
         Home, quindi la prima riga può darlo per scontato invece di far
         ricominciare da "ciao". `encodeURIComponent` a mano — è una costante,
         non vale una chiamata a runtime. */
      url: 'https://wa.me/393515173372?text=Ciao%20Vlad%2C%20ho%20visto%20il%20tuo%20portfolio%20e%20vorrei%20parlarti%20di%20un%20progetto.',
    },

    /**
     * LinkedIn — profilo reale (fornito il 2026-08-06, non più un segnaposto).
     * Lo legge il link "LinkedIn" fra i canali diretti della CTA finale.
     * ⚠ Lo stesso URL è ripetuto in `sameAs` qui sotto, e la duplicazione è
     * voluta: sono due consumatori diversi (un link visibile contro un elenco
     * per i motori) e leggere l'uno dall'altro legherebbe il tipo di `sameAs` a
     * questo campo. Se l'URL cambia, vanno cambiati entrambi.
     */
    linkedin: 'https://www.linkedin.com/in/vlad-costin/',

    /**
     * Località. Scelta di privacy deliberata: la data di nascita NON compare sul
     * sito pubblico. Il numero di telefono invece SÌ, da agosto 2026, ma solo
     * come link WhatsApp — vedi il campo `whatsapp` qui sopra.
     */
    location: { locality: 'Colorno', region: 'Emilia-Romagna', country: 'IT' },
    locationLabel: 'Colorno (PR), Italia',
    languages: ['Italiano (madrelingua)', 'Romeno (madrelingua)', 'Inglese (intermedio)'],
    /**
     * Profili pubblici, destinati a `Person.sameAs` nel JSON-LD.
     * ⚠ OGGI NESSUNO LEGGE QUESTO CAMPO: `Seo.astro` emette il JSON-LD solo se
     * riceve la prop `jsonLd`, e nessuna pagina la passa ancora. Compilarlo è
     * preparazione, non un effetto — chi si aspetta di vedere il proprio URL
     * nell'HTML servito cercandolo qui non lo troverà, e il posto dove
     * intervenire è la pagina, non questa riga.
     */
    sameAs: [
      'https://www.linkedin.com/in/vlad-costin/',
      // [placeholder] GitHub: inserire l'URL reale quando c'è un profilo da mostrare.
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
    updated: 'agosto 2026',
    sizeLabel: '189 KB',
  },

  /**
   * Disponibilità dichiarata. Chiude l'inventario di /chi-sono con l'unica
   * riga che non è una competenza ma uno STATO.
   *
   * ⚠ È UNA STRINGA E NON UN BOOLEANO CON DUE TESTI, di proposito: il
   * pallino verde accanto significa "aperto", quindi non esiste una versione
   * di questa riga che dica "non disponibile" — sarebbe un semaforo verde su
   * un cartello di divieto. Quando Vlad non prende più progetti, la riga si
   * TOGLIE (questo campo a stringa vuota), non si capovolge.
   */
  availability: 'Accetto nuovi progetti freelance',

  /**
   * FEATURE FLAG — sezioni la cui esistenza dipende da contenuti che non ci
   * sono ancora. Il componente e i dati esistono già: cambia solo il flag.
   */
  features: {
    /** ⚠ Spento su richiesta di Vlad (2026-08-07): riaccendere solo quando
     *  arrivano testimonianze vere in src/data/testimonials.ts. */
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