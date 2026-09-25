/**
 * I capitoli di un case study: insieme CHIUSO e tipizzato.
 *
 * Sta in un modulo TS e non nel frontmatter di Chapter.astro perché serve a
 * quattro consumatori: il componente, il layout (che ne rende l'indice), il
 * guard di build e il mirror .md.
 *
 * Il vantaggio del tipo unione: scrivere `id="contexto"` diventa un errore di
 * build, non un layout rotto in silenzio.
 *
 * ⚠ L'ID È UN URL PUBBLICO. `contesto`, `sfida`, `processo`, `risultato`
 * esistono già come anchor (/portfolio/x#sfida) e non vanno rinominati.
 *
 * ⚠ IL NUMERO NON STA PIÙ QUI (dal 2026-09-25). Prima ogni capitolo aveva il
 * suo `n` fisso ("01"…"05"), che andava bene finché i capitoli erano sempre
 * gli stessi quattro. Ora i moduli sono opzionali e ordinabili: un numero fisso
 * produrrebbe "01, 02, 06" su un case study senza i capitoli di mezzo. Il
 * numero lo dà l'ordine in cui i capitoli compaiono nel corpo — un contatore
 * CSS in Chapter.astro, lo stesso conteggio nell'indice del layout.
 */
export const CHAPTERS = {
  contesto: { title: 'Il contesto' },
  sfida: { title: 'La sfida' },
  processo: { title: 'Il processo' },
  /** Coppie problema → intervento, con <ProblemSolution>. */
  problemi: { title: 'Problemi e soluzioni' },
  /** Screenshot con didascalia, scelte di UX, architettura, integrazioni. */
  dettagli: { title: 'Come è fatto' },
  risultato: { title: 'Il risultato' },
  /** Tecnologie usate davvero, accessibilità, performance, vincoli. */
  tecnica: { title: 'Stack e dettagli tecnici' },
  imparato: { title: 'Cosa ho imparato' },
  /** Storico: resta valido per chi lo usa già. */
  note: { title: 'Note tecniche' },
} as const;

export type ChapterId = keyof typeof CHAPTERS;

/**
 * I capitoli obbligatori. Il guard di build resta, ed è deliberato: un case
 * study senza contesto o senza risultato non è un case study pubblicato a
 * metà, è un case study rotto. Tutti gli ALTRI moduli sono opzionali.
 */
export const REQUIRED_CHAPTERS: ChapterId[] = ['contesto', 'sfida', 'processo', 'risultato'];

export interface ChapterRef {
  id: ChapterId;
  title: string;
}

const isChapterId = (id: string): id is ChapterId => Object.hasOwn(CHAPTERS, id);

/**
 * I capitoli EFFETTIVAMENTE presenti nel corpo MDX, nell'ordine in cui si
 * leggono. È da qui che nasce l'indice: un modulo che non c'è non compare.
 *
 * Legge il sorgente (che il layout ha già in memoria) invece del DOM
 * renderizzato: è a build time, gratuito, e fallisce presto.
 *
 * ⚠ Lancia su id sconosciuti e su duplicati. Un id doppio produrrebbe due
 * `<section id>` uguali — HTML non valido, e un anchor che porta al primo dei
 * due per sempre.
 */
export function chaptersIn(body: string, where: string): ChapterRef[] {
  const out: ChapterRef[] = [];
  // Il titolo può precedere o seguire l'id: si leggono entrambi dagli attributi.
  for (const [tag] of body.matchAll(/<Chapter\b[^>]*>/g)) {
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    const title = /\btitle="([^"]*)"/.exec(tag)?.[1];
    if (!id) throw new Error(`[${where}] <Chapter> senza id`);
    if (!isChapterId(id)) {
      throw new Error(
        `[${where}] capitolo sconosciuto "${id}". Validi: ${Object.keys(CHAPTERS).join(', ')}`
      );
    }
    if (out.some((c) => c.id === id)) throw new Error(`[${where}] capitolo "${id}" ripetuto`);
    out.push({ id, title: title || CHAPTERS[id].title });
  }
  return out;
}

/** "01", "02"… dall'ordine di lettura. */
export const chapterNumber = (i: number) => String(i + 1).padStart(2, '0');
