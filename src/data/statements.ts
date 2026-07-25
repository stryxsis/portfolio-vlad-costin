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
  /** Le parole (esatte, come compaiono in `text`) che ricevono l'accento. */
  accent: string[];
}

export const STATEMENTS = {
  /** Home §40 — sezione full-bleed su fondo paper. */
  home: {
    label: 'Nota a margine',
    text: 'Non sono il più esperto della stanza. Sono quello che non smette di studiare.',
    accent: ['non smette di studiare'],
  },
  /** About §10 — filosofia, full-bleed su fondo paper. */
  about: {
    label: 'Come la vedo',
    text: 'Il codice è la parte facile. La parte difficile è capire cosa serve davvero.',
    accent: ['cosa serve davvero'],
  },
} as const satisfies Record<string, Statement>;