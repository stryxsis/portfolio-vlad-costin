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
];