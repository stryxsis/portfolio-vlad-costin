/**
 * Testimonianze.
 *
 * ⚠⚠ QUESTE NOVE VOCI SONO SEGNAPOSTO, non testimonianze reali. Stanno qui su
 * richiesta esplicita di Vlad per lavorare sulla grafica della sezione, e la
 * sezione resta accesa (`SITE.features.testimonials`) finché non chiede lui di
 * spegnerla — non rimuoverle né rispegnere il flag di propria iniziativa.
 *
 * PRIMA DI PUBBLICARE vanno sostituite con citazioni vere: una testimonianza
 * inventata su un portfolio è l'unica cosa che, se scoperta, azzera la fiducia
 * in tutto il resto della pagina.
 *
 * ⚠⚠ LA LUNGHEZZA DI QUESTO ARRAY DECIDE IL LAYOUT DELLA SEZIONE.
 * `Testimonials.astro` sceglie l'impianto in base a quante voci ci sono:
 *
 *      1      righe editoriali, registro "una sola" (la citazione prende la scena)
 *    2-5      righe editoriali (una riga per voce, il corpo scala sul numero)
 *    6-8      il muro che scorre, 2 colonne
 *    9+       il muro che scorre, 3 colonne
 *
 * Non c'è niente da cambiare nel codice per passare da uno all'altro: si
 * aggiungono citazioni qui e la Home si adegua. La soglia e il perché dei numeri
 * stanno in testa a Testimonials.astro.
 *
 * ⚠ PERCHÉ SONO NOVE E NON TRE (cambiato il 2026-08-06). Erano tre, quando la
 * sezione era una riga di tre card affiancate. Nove è il minimo che riempie le
 * TRE colonne del muro: una colonna che scorre in loop ha bisogno di abbastanza
 * card da essere più alta della finestra che la mostra, altrimenti si vede la
 * giuntura del ciclo. Con tre citazioni in tre colonne ogni colonna avrebbe
 * mostrato la stessa frase in loop: non è una grafica da giudicare, è un difetto
 * da guardare.
 *
 * Il compromesso che rende i segnaposto utili senza fabbricare una persona:
 *   - i NOMI stanno fra parentesi quadre e sono coppie dell'alfabeto NATO
 *     (Alfa Bravo, Charlie Delta, ...), quindi nessuna frase è attribuita a un
 *     individuo che potrebbe esistere. ⚠ La scelta NON è un vezzo: le iniziali
 *     alimentano il monogramma quando manca la foto (vedi TestimonialCard), e
 *     nove card marcate tutte "[Nome Cognome]" avrebbero prodotto nove cerchi
 *     identici con dentro "NC" — che in un muro si legge come un errore di
 *     rendering, non come un segnaposto. Coppie diverse danno monogrammi diversi
 *     conservando la LUNGHEZZA di un nome vero, che è ciò che conta per giudicare
 *     l'impaginazione della riga di attribuzione;
 *   - i RUOLI restano fra parentesi quadre, di lunghezze diverse per lo stesso
 *     motivo;
 *   - le CITAZIONI hanno lunghezza e ritmo realistici, perché è l'unica cosa che
 *     permette di giudicare l'impaginazione delle card. Sono deliberatamente di
 *     lunghezze molto diverse (da ~110 a ~205 caratteri): in un muro di card è la
 *     DISPARITÀ, non la media, che si vede;
 *   - gli URL social puntano alla HOME della piattaforma, non a un profilo
 *     inventato.
 *
 * ⚠ L'ORDINE DI QUESTO ARRAY È UNA DECISIONE EDITORIALE, non un caso. Le colonne
 * si riempiono a fette di tre (0-2 / 3-5 / 6-8) e le colonne 2 e 3 SPARISCONO
 * sotto i breakpoint (vedi Testimonials.astro): su telefono si legge solo la
 * PRIMA fetta. Quindi le tre citazioni più forti vanno messe in testa, non in
 * fondo. Le prime tre qui sono anche di tre lunghezze diverse, così la colonna
 * visibile da sola resta rappresentativa dell'impaginazione.
 */
import type { Testimonial } from '../lib/types';

export const TESTIMONIALS: Testimonial[] = [
  /* -- Colonna 1: l'unica visibile su telefono ---------------------------- */
  {
    quote:
      'Gli ho descritto il problema male, e mi ha restituito la domanda giusta prima di scrivere una riga di codice.',
    name: '[Alfa Bravo]',
    role: '[Ruolo] · [Azienda]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'sito', url: 'https://example.com/' },
    ],
  },
  {
    quote:
      'Abbiamo lavorato insieme su una scadenza stretta. Non ha mai promesso più di quello che poteva consegnare, e ha consegnato tutto quello che aveva promesso.',
    name: '[Charlie Delta]',
    role: '[Ruolo più lungo] · [Azienda]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'github', url: 'https://github.com/' },
    ],
  },
  {
    quote:
      'La parte tecnica la davo per scontata. Quello che mi ha colpito è che tornava con domande sul perché una funzione servisse, non solo su come scriverla. Il sito che ne è uscito lo usiamo ancora ogni giorno.',
    name: '[Echo Foxtrot]',
    role: '[Ruolo] · [Azienda]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'instagram', url: 'https://www.instagram.com/' },
      { kind: 'sito', url: 'https://example.com/' },
    ],
  },

  /* -- Colonna 2: compare da 48rem ---------------------------------------- */
  {
    quote:
      'Ha riscritto una pagina che ci metteva otto secondi ad aprirsi. Adesso è sotto il secondo, e non me ne ero accorto finché non me lo ha fatto vedere con i numeri alla mano.',
    name: '[Golf Hotel]',
    role: '[Ruolo] · [Azienda]',
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/' }],
  },
  {
    quote:
      'Spiega le cose senza farti sentire stupido. Per me, che non sono del settore, è stata la differenza fra decidere e fidarmi.',
    name: '[India Juliett]',
    role: '[Ruolo] · [Azienda molto lunga]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'sito', url: 'https://example.com/' },
    ],
  },
  {
    quote:
      'Puntuale nelle consegne e chiaro nei preventivi: nessuna sorpresa a fine progetto, che nella mia esperienza non è affatto la norma.',
    name: '[Kilo Lima]',
    role: '[Ruolo] · [Azienda]',
    socials: [{ kind: 'sito', url: 'https://example.com/' }],
  },

  /* -- Colonna 3: compare da 75rem ---------------------------------------- */
  {
    quote:
      'Gli abbiamo chiesto una cosa e lui ne ha proposta una più semplice che risolveva lo stesso problema. Abbiamo fatto come diceva lui.',
    name: '[Mike November]',
    role: '[Ruolo] · [Azienda]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'github', url: 'https://github.com/' },
    ],
  },
  {
    quote:
      "L'ho visto lavorare sotto pressione durante un evento con duecento persone in sala. Il sito ha tenuto e lui era tranquillo.",
    name: '[Oscar Papa]',
    role: '[Ruolo] · [Azienda]',
    socials: [{ kind: 'instagram', url: 'https://www.instagram.com/' }],
  },
  {
    quote:
      'Non sparisce dopo la consegna. A tre mesi di distanza gli ho scritto per una modifica e ha risposto lo stesso giorno, senza farmi pesare che il progetto fosse chiuso.',
    name: '[Quebec Romeo]',
    role: '[Ruolo] · [Azienda]',
    socials: [
      { kind: 'linkedin', url: 'https://www.linkedin.com/' },
      { kind: 'sito', url: 'https://example.com/' },
    ],
  },
];
