/**
 * I capitoli di un case study: insieme CHIUSO e tipizzato.
 *
 * Sta in un modulo TS e non nel frontmatter di Chapter.astro perché serve a tre
 * consumatori: il componente, il layout (che ne rende il rail di navigazione) e
 * il guard di build.
 *
 * Il vantaggio del tipo unione: scrivere `id="contexto"` diventa un errore di
 * `astro check`, non un layout rotto in silenzio.
 */
export const CHAPTERS = {
  contesto: { n: '01', title: 'Il contesto' },
  sfida: { n: '02', title: 'La sfida' },
  processo: { n: '03', title: 'Il processo' },
  risultato: { n: '04', title: 'Il risultato' },
  /** Opzionale, esclusa dal rail di navigazione. */
  note: { n: '05', title: 'Note tecniche' },
} as const;

export type ChapterId = keyof typeof CHAPTERS;

/** I capitoli obbligatori, nell'ordine in cui si leggono. */
export const REQUIRED_CHAPTERS: ChapterId[] = ['contesto', 'sfida', 'processo', 'risultato'];

/** Quelli che compaiono nel rail laterale del case study. */
export const NAV_CHAPTERS = REQUIRED_CHAPTERS;