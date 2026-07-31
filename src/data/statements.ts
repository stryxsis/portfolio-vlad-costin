/**
 * Gli statement tipografici: le sezioni full-bleed che rompono il flusso.
 *
 * Il testo sta qui e non nei componenti perché sono le frasi che si riscrivono
 * più spesso, e perché la marcatura dell'accento va decisa insieme al testo:
 * `accent` elenca le parole che ricevono il colore, con il vincolo di MASSIMO
 * DUE per statement. Tre accenti in una frase non enfatizzano più niente.
 */
export interface Statement {
  /** Micro-label mono sopra lo statement. Le sezioni statement non hanno numero
   *  d'indice: è l'assenza del numero a dichiararle come aside tipografico. */
  label: string;
  text: string;
  /**
   * LA PREMESSA, che va smorzata: sottostringa esatta di `text`, di norma la
   * prima frase. Il manifesto funziona per contrasto — una premessa detta a
   * voce bassa e la conseguenza detta forte — e senza questo campo le due metà
   * peserebbero uguale, che è il modo di non dire niente con enfasi.
   * Tutto ciò che NON è `quiet` è la voce dominante.
   */
  quiet?: string;
  /** Le parole (esatte, come compaiono in `text`) che ricevono l'accento. */
  accent: string[];
  /**
   * Il timbro editoriale mono in fondo. Le voci si scrivono separate perché a
   * schermo le unisce un punto medio decorativo (`aria-hidden`, come i
   * separatori delle card in FeaturedProjects): unirle già qui in una stringa
   * sola vorrebbe dire far leggere "punto medio" a uno screen reader.
   */
  stamp?: string[];
  /**
   * LA PAROLA-FANTASMA: il piano di sfondo del manifesto, in corpo gigantesco e
   * contrasto quasi nullo, che deriva in parallasse mentre si scorre.
   *
   * Va scelta come NUCLEO SEMANTICO della frase, non come decorazione: è la
   * ragione per cui l'effetto non è gratuito. Per la Home è "STUDIARE", cioè la
   * parola su cui poggia l'accento del testo — il fondo ripete la parola
   * importante, non ne aggiunge una nuova.
   *
   * Una parola sola e senza spazi: il fantasma è `white-space: nowrap` e
   * sborda di proposito dal bordo destro, e due parole lo renderebbero
   * illeggibile invece che frammentario.
   */
  ghost?: string;
}

export const STATEMENTS = {
  /** Home §40 — sezione full-bleed su fondo paper. */
  home: {
    label: 'Nota a margine',
    text: 'Non sono il più esperto della stanza. Sono quello che non smette di studiare.',
    quiet: 'Non sono il più esperto della stanza.',
    accent: ['non smette di studiare'],
    stamp: ['Manifesto', 'Statement 04'],
    ghost: 'Studiare',
  },
  /** About §10 — filosofia, full-bleed su fondo paper. */
  about: {
    label: 'Come la vedo',
    text: 'Il codice è la parte facile. La parte difficile è capire cosa serve davvero.',
    quiet: 'Il codice è la parte facile.',
    accent: ['cosa serve davvero'],
    stamp: ['Manifesto', 'Statement 01'],
    ghost: 'Capire',
  },
} as const satisfies Record<string, Statement>;