/**
 * La timeline, dai dati reali del CV. In ordine cronologico di inizio.
 *
 * `kind` separa studio da lavoro perché il concetto della pagina About è
 * esattamente questo: per un autodidatta le due cose non sono due fasi in fila,
 * si sovrappongono. Nel 2024-2025 tre voci sono attive insieme, e la timeline
 * deve farlo VEDERE invece di dirlo.
 */
import type { TimelineEntry } from '../lib/types';

export const TIMELINE: TimelineEntry[] = [
  {
    year: 2017,
    from: '2017-09',
    to: '2022-06',
    kind: 'studio',
    role: 'Scuola secondaria di secondo grado',
    org: 'ITIS Leonardo Da Vinci',
    detail:
      'Qui ho scritto la prima riga di codice che facesse qualcosa di utile. Il resto l’ho imparato da solo, la sera.',
    /* ⚠ SPENTA SOLO NEL TEASER DELLA HOME, non qui: su `/chi-sono` c'è ancora,
       intera. Con l'ingresso di JEParma il teaser è salito a quattro voci e a
       1440×900 misurava 1031px contro gli 900 disponibili — 131px sopra
       la viewport, che per una sezione sticky vuol dire una coda irraggiungibile
       (vedi il vincolo in JourneyTeaser.astro). Fra le cinque voci questa è la
       meno recente, quindi è quella che si spegne quando lo spazio non basta
       per tutte. */
    teaser: false,
  },
  {
    year: 2022,
    from: '2022-09',
    to: '2025-02',
    kind: 'lavoro',
    role: 'Programmatore',
    org: 'Scic Cucine d’Italia',
    place: 'Parma',
    detail:
      'Due anni e mezzo su problemi che non stavano in un tutorial: dati veri, vincoli veri, gente che aspetta. È dove ho imparato a fare domande prima di aprire l’editor.',
  },
  {
    /* ⚠ MOMENTO, non periodo (vedi il commento su `kind` in lib/types.ts):
       niente `to`, niente `current`, e la voce stampa la sola data.
       Sta PRIMA della laurea di proposito, ed è tutto il senso della voce:
       giugno 2024, tre mesi prima dell'iscrizione e mentre il lavoro in Scic
       era ancora in corso — cioè nel punto in cui le due strade erano
       davvero entrambe aperte. Spostarla dopo la laurea la trasformerebbe
       nel racconto di una decisione già presa. */
    year: 2024,
    from: '2024-06',
    kind: 'bivio',
    role: 'Il primo grande bivio',
    org: 'Continuare a lavorare, o iscrivermi all’università',
    detail:
      'Potevo restare dov’ero: stipendio, colleghi, un lavoro che mi piaceva e che sapevo fare. Ho scelto la strada più lunga, e non l’ho ancora rimpianta.',
    /* Fuori dal teaser della Home per la stessa ragione della voce delle
       superiori: il teaser deve stare in UNO schermo (vincolo dell'handoff
       M12) e oggi ci stanno esattamente tre voci. */
    teaser: false,
  },
  {
    year: 2024,
    from: '2024-09',
    kind: 'studio',
    role: 'Laurea triennale in Ingegneria Informatica',
    org: 'Università degli Studi di Parma',
    detail:
      'Algoritmi, sviluppo software, sistemi informatici. Serve a capire perché funziona quello che già facevo funzionare.',
    current: true,
  },
  {
    year: 2025,
    from: '2025-01',
    kind: 'lavoro',
    role: 'Developer',
    org: 'JEParma',
    place: 'Junior Enterprise, Parma',
    detail:
      'Progetti per aziende vere mentre studio. È il punto in cui teoria e pratica hanno smesso di essere due cose separate.',
    current: true,
  },
  {
    /* ⚠ MOMENTO come il bivio, e ultima voce della timeline: è il traguardo
       più recente, quindi chiude il racconto proprio dove comincia la coda
       tratteggiata di `Timeline.astro` ("Vediamo cosa mi aspetta"). */
    year: 2026,
    from: '2026-08',
    kind: 'traguardo',
    role: 'Il mio primo sito online',
    org: 'Questo che stai leggendo',
    detail:
      'Progettato e scritto da zero, senza template né temi comprati. Il primo posto in cui ogni scelta è mia — e in cui quello che so fare si vede invece di doverlo raccontare.',
    teaser: false,
  },
];