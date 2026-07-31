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
  kind: 'studio' | 'lavoro';
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

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  linkedin?: string;
  avatar?: string;
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