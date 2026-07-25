/** I tipi dei dati strutturati che NON sono collection (vedi src/data/). */

/** Una voce di timeline. `kind` è ciò che rende visibile l'intreccio
 *  studio ⇄ lavoro: è il concetto della pagina About, non una decorazione. */
export interface TimelineEntry {
  /** Anno di inizio, usato come numerale gigante. */
  year: number;
  /** Etichetta leggibile del periodo, es. "set 2022 — feb 2025". */
  period: string;
  /** Date ISO per l'attributo datetime di <time>: è questo che le macchine leggono. */
  from: string;
  to?: string;
  kind: 'studio' | 'lavoro';
  role: string;
  org: string;
  place?: string;
  detail: string;
  /** true = ancora in corso. */
  current?: boolean;
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