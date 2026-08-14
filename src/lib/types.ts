/** I tipi dei dati strutturati che NON sono collection (vedi src/data/). */

/** Una voce di timeline. `kind` è ciò che rende visibile l'intreccio
 *  studio ⇄ lavoro: è il concetto della pagina About, non una decorazione. */
export interface TimelineEntry {
  /** Anno di inizio, usato come numerale gigante. */
  year: number;
  /** Date ISO ("2022-09"), sia per l'attributo datetime di <time> sia per
   *  generare l'etichetta leggibile: l'etichetta NON si scrive a mano, la
   *  produce `periodParts()` in src/lib/format.ts. Una data in due formati in
   *  due campi diversi divergerebbe alla prima modifica distratta. */
  from: string;
  to?: string;
  /**
   * ⚠ DUE FAMIGLIE, NON QUATTRO VALORI ALLA PARI (dal 2026-08-14):
   *
   *   `studio` | `lavoro`    PERIODI. Hanno una durata, quindi possono avere
   *                          un `to` o essere `current`. Sono le due tracce
   *                          che si intrecciano, ed è per questo che `studio`
   *                          è rientrato rispetto a `lavoro`.
   *   `bivio` | `traguardo`  MOMENTI. Sono un punto nel tempo: niente `to`,
   *                          mai `current`, e `TimelineItem` stampa la sola
   *                          data invece dell'intervallo.
   *
   * La distinzione NON ha un campo suo (`momento: true`) di proposito: sarebbe
   * un secondo dato da tenere in sync con `kind`, libero di contraddirlo — un
   * `kind: 'bivio', momento: false` sarebbe compilabile e insensato. Qui la
   * forma è DEDOTTA dal tipo, che è l'unica cosa che la determina davvero.
   */
  kind: 'studio' | 'lavoro' | 'bivio' | 'traguardo';
  role: string;
  org: string;
  place?: string;
  detail: string;
  /** true = ancora in corso. */
  current?: boolean;
  /**
   * false = esclusa dal teaser della Home anche se rientrerebbe nel `limit`.
   * Default true (inclusa). Serve a JourneyTeaser.astro, che deve stare in UNO
   * schermo (vincolo geometrico dell'handoff M12, vedi la nota in quel file):
   * quando una voce nuova non ci sta più tutte insieme, si spegne la meno
   * recente invece di stringere il layout — misurato via CDP, non deciso a
   * occhio (vedi il commento sulla voce spenta in timeline.ts). La pagina
   * `/chi-sono` (Timeline senza `limit`) non legge questo campo: lì tutte le
   * voci restano, sempre.
   */
  teaser?: boolean;
}

export interface SkillGroup {
  label: string;
  /** Nota mono opzionale sotto il gruppo. */
  note?: string;
  items: string[];
}

/**
 * Un profilo pubblico dell'autore di una testimonianza.
 *
 * `kind` è un'unione chiusa e non una stringa libera perché ogni valore ha il
 * suo path SVG scritto a mano in TestimonialCard.astro: una piattaforma nuova
 * deve essere un errore di compilazione lì, non un'icona che manca a runtime.
 */
export interface TestimonialSocial {
  kind: 'linkedin' | 'github' | 'instagram' | 'sito';
  url: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /**
   * Ritratto piccolo, come URL pubblico (`/img/...`). Se manca, la card compone
   * il monogramma dalle iniziali invece di lasciare un buco: non tutti mandano
   * una foto, e uno slot vuoto si legge come un errore.
   *
   * Perché una stringa e non un `ImageMetadata` di astro:assets: i dati stanno
   * in un `.ts` normale, quindi non c'è un import statico per riga. Il giorno in
   * cui arrivano foto vere si scelga fra /public (semplice, nessuna
   * ottimizzazione) e una mappa costruita con `import.meta.glob` — ma non si
   * costruisce quella macchina prima di avere la prima foto.
   */
  avatar?: string;
  socials?: TestimonialSocial[];
}

export interface ClientRef {
  name: string;
  /** Cosa è stato: distinguere "cliente" da "dove ho studiato" è una scelta di
   *  onestà, non di tassonomia. */
  kind: 'lavoro' | 'studio' | 'cliente';
  url?: string;
}

export interface BackstageItem {
  title: string;
  body: string;
}