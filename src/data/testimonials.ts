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
 * ✓ VERE finora: Francesco Fantesini e Stefano Marcacci (2026-10-03). Le
 *   altre quattro restano provvisorie.
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
      'Gli abbiamo portato nove famiglie di prodotti e tre modi diversi di raccontarle. Ne è uscito un sito che un cliente capisce al primo giro, e che finalmente somiglia a come lavoriamo davvero.',
    name: 'Giorgio Canalini',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: giorgioCanalini,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/giorgiocanalini/' }],
  },
  {
    quote:
      'In JEParma Vlad è quello a cui passi un progetto sapendo che arriverà in fondo. Il sito del Network Day l’ha costruito mentre seguiva anche i clienti, e per la prima volta i partecipanti sono arrivati all’evento sapendo già dove andare.',
    name: 'Andrea D’Amico',
    // U+2060 attorno al trattino: su telefono l'anno andava a capo a metà.
    role: 'Ex presidente · JEParma 2025\u2060–\u20602026',
    avatar: andreaDamico,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/a-da/' }],
  },
  {
    quote:
      'Avevamo due pubblici che non parlano la stessa lingua: studenti da tutto il mondo e università. Vlad li ha separati senza farci sembrare due aziende diverse, e ha trasformato una burocrazia complicata in pagine che si leggono.',
    name: 'Chiara Pedretti Boraschi',
    role: 'Fondatrice · Kimere',
    avatar: chiaraPedrettiBoraschi,
    socials: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/chiara-pedretti-boraschi-4a8529170/' }],
  },

  /* -- Seconda colonna ---------------------------------------------------- */
  {
    quote:
      'Ci serviva un sito che parlasse ai ristoratori senza perdere il calore del laboratorio. Prima della grafica ha voluto capire chi sono i nostri clienti, e oggi è il primo link che mandiamo a un nuovo partner.',
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
