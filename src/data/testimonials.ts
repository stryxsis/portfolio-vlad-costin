/**
 * Testimonianze.
 *
 * ⚠⚠ PERSONE VERE, FRASI PROVVISORIE (dal 2026-09-25). I nomi, i ruoli e le
 * foto sono reali e li ha dati Vlad; le CITAZIONI le ho scritte io su sua
 * richiesta, come segnaposto verosimile, in attesa delle parole vere di
 * ciascuno. Vanno sostituite PRIMA DI QUALUNQUE DEPLOY: una frase messa in
 * bocca a una persona esistente è peggio di un nome fra parentesi quadre, ed è
 * l'unica cosa che, se scoperta, azzera la fiducia in tutto il resto della
 * pagina.
 *
 * ✓ VERE finora: Francesco Fantesini e Stefano Marcacci (2026-10-03),
 *   Giorgio Canalini (2026-10-04), Chiara Pedretti Boraschi e Alex Iuliani
 *   (2026-10-09). Resta provvisoria solo quella di Andrea D’Amico.
 *
 * I nove segnaposto con i nomi dell'alfabeto NATO (`[Alfa Bravo]`…) sono stati
 * TOLTI lo stesso giorno, su richiesta di Vlad: restano solo persone reali.
 *
 * ⚠⚠ LA LUNGHEZZA DI QUESTO ARRAY DECIDE IL LAYOUT DELLA SEZIONE.
 * `Testimonials.astro` sceglie l'impianto in base a quante voci ci sono:
 *
 *      1      righe editoriali, registro "una sola" (la citazione prende la scena)
 *    2-5      righe editoriali (una riga per voce, il corpo scala sul numero)
 *    6-8      il muro che scorre, 2 colonne
 *    9+       il muro che scorre, 3 colonne
 *
 * Oggi sono sei: il muro a due colonne da tre. Togliendone una la sezione passa
 * da sola alle righe editoriali, e non c'è niente da cambiare nel codice.
 *
 * ⚠ L'ORDINE È UNA DECISIONE EDITORIALE. Il muro divide l'array in fette da
 * ceil(n / colonne) e sotto i breakpoint resta visibile solo la PRIMA: su
 * telefono si leggono le prime tre voci. Per questo in testa c'è una voce per
 * cliente diverso (Reggiana, JEParma, Kimere) e non i tre soci di Reggiana di
 * fila.
 *
 * Le foto (`avatar`) stanno in src/assets/testimonianze/, una per persona,
 * nominate `nome-cognome.jpg` e già ritagliate sul volto (400×400): Astro le
 * serve in WebP a 128px. Chi non ha una foto riceve il monogramma dalle
 * iniziali (TestimonialIdentity). Il solo social è il LinkedIn di ciascuno,
 * dato da Vlad il 2026-09-25 — prima puntavano al sito dell'azienda, e Vlad
 * voleva invece che l'icona portasse alla persona.
 */
import type { Testimonial } from '../lib/types';
import alexIuliani from '../assets/testimonianze/alex-iuliani.jpg';
import andreaDamico from '../assets/testimonianze/andrea-damico.jpg';
import chiaraPedrettiBoraschi from '../assets/testimonianze/chiara-pedretti-boraschi.jpg';
import francescoFantesini from '../assets/testimonianze/francesco-fantesini.jpg';
import giorgioCanalini from '../assets/testimonianze/giorgio-canalini.jpg';
import stefanoMarcacci from '../assets/testimonianze/stefano-marcacci.jpg';

export const TESTIMONIALS: Testimonial[] = [
  /* -- Prima colonna: l'unica visibile su telefono ------------------------ */
  {
    quote:
      /* ⚠ VERA, inviata da Giorgio il 2026-10-04. Tolta solo la firma; i
         quattro capoversi sono uniti in uno, come le altre citazioni. */
      'Ci siamo affidati a lui per la realizzazione del sito Internet della nostra società e siamo rimasti davvero molto soddisfatti del risultato. Fin dal primo momento si è dimostrato una persona estremamente competente, disponibile e attenta alle nostre esigenze. Ha saputo trasformare le nostre idee in un sito moderno, professionale e curato in ogni dettaglio, lavorando con grande precisione e puntualità. Il risultato finale è stato impeccabile e ha pienamente rispecchiato quello che avevamo in mente. Una persona seria, professionale e soprattutto sempre disponibile ad ascoltare e trovare la soluzione migliore. Lo consiglio assolutamente a chiunque abbia bisogno di realizzare o rinnovare il proprio sito web.',
    name: 'Giorgio Canalini',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: giorgioCanalini,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/giorgiocanalini/' }],
  },
  {
    quote:
      /* ⚠ PROVVISORIA, scritta da me: va sostituita con le parole di Andrea.
         Corretta il 2026-10-12 su richiesta di Vlad: col Network Day era
         appena entrato in JEParma e non seguiva altri clienti, e non è vero
         che i partecipanti siano arrivati «sapendo dove andare». */
      'Il sito del Network Day è stato il primo progetto di Vlad in JEParma: era appena entrato. Quello che non conosceva l’ha imparato strada facendo, e il sito era online prima dell’evento. È quello a cui passi un progetto sapendo che arriverà in fondo.',
    name: 'Andrea D’Amico',
    // U+2060 attorno al trattino: su telefono l'anno andava a capo a metà.
    role: 'Ex presidente · JEParma 2025\u2060–\u20602026',
    avatar: andreaDamico,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/a-da/' }],
  },
  {
    quote:
      /* ⚠ VERA, inviata da Chiara il 2026-10-09. Testo intero, nessun ritocco. */
      'Vlad ha svolto un lavoro eccezionale sulla parte di programmazione del sito Kimere. Non solo ha dimostrato una profonda competenza tecnica, ma ha saputo trasformare un’idea complessa in una piattaforma fluida, veloce e intuitiva. È un professionista attento ai dettagli, puntuale nelle consegne e sempre pronto a trovare la soluzione migliore di fronte a qualsiasi sfida di sviluppo. Lavorare con lui è una garanzia!',
    name: 'Chiara Pedretti Boraschi',
    role: 'Fondatrice · Kimere',
    avatar: chiaraPedrettiBoraschi,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/chiara-pedretti-boraschi-4a8529170/' }],
  },

  /* -- Seconda colonna ---------------------------------------------------- */
  {
    quote:
      /* ⚠ VERA, inviata da Alex il 2026-10-09. I tre capoversi sono uniti in
         uno, come le altre citazioni; nessun altro ritocco. */
      'Vlad si è occupato della realizzazione del sito web di una mia azienda, ALSI Gluten Free, svolgendo un lavoro perfetto per le mie esigenze e in linea con quanto concordato insieme. Dopo una prima fase di confronto per capire le necessità aziendali e gli obiettivi comunicativi, Vlad ha curato tutto il processo, creando la struttura, assicurandosi che il sito fosse funzionale e intuitivo, il tutto mantenendo coerenti brand identity e proponendo soluzioni alle quali non avevo pensato. In due righe: avevo bisogno di un sito, lui l’ha creato nel modo migliore possibile. Niente di meglio.',
    name: 'Alex Iuliani',
    role: 'Ex cofondatore · ALSI Gluten Free',
    avatar: alexIuliani,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/alex-iuliani-236a5a232/' }],
  },
  {
    quote:
      /* ⚠ VERA, inviata da Francesco il 2026-10-03. Ritocchi solo di forma:
         «può essere seguita» → «definita» (refuso evidente), tolta la nota fra
         parentesi in cui lasciava a noi se nominare l'azienda, tolta la firma. */
      'La collaborazione con Vlad Costin per la creazione del nostro portale può essere definita come un’esperienza decisamente positiva. Paziente, preciso e tempestivo. Ha saputo tradurre in realtà ogni nostra idea ed ha fatto in modo che ogni concetto venisse espresso e reso al massimo del suo significato sia in termini di espressione che graficamente. Il nostro sito è diventato così facile da trovare, accattivante, intuitivo ed elegante. Non possiamo che dirci più che soddisfatti del risultato ottenuto, anche in termini di spiegazione e contenuti. Lo consiglieremo sicuramente a chiunque.',
    name: 'Francesco Fantesini',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: francescoFantesini,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/francesco-fantesini-86a5a7218/' }],
  },
  {
    quote:
      /* ⚠ VERA, inviata da Stefano il 2026-10-03. Tolta solo la firma. */
      'Io e i miei soci abbiamo avuto il piacere di affidarci a Vlad per la realizzazione del sito internet della nostra azienda. Essendo per noi la prima esperienza di questo tipo, cercavamo qualcuno che sapesse non solo occuparsi della parte tecnica, ma anche guidarci nelle varie scelte che questo lavoro comporta. Vlad, nonostante la giovane età, ha dimostrato grande competenza, consapevolezza e professionalità, accompagnandoci passo dopo passo con disponibilità e pazienza. Abbiamo apprezzato in particolare la sua tempestività, la capacità di comprendere le nostre esigenze e l’ottimo problem solving. Il risultato finale ha superato le nostre aspettative, riuscendo a tradurre al meglio ciò che avevamo in mente, anche quando non era semplice per noi esprimerlo. Un’esperienza decisamente positiva e un professionista che ci sentiamo di consigliare.',
    name: 'Stefano Marcacci',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: stefanoMarcacci,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/stefano-marcacci-b0aa5435/' }],
  },
];
