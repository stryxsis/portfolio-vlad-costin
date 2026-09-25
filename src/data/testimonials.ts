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
 * Le foto (`avatar`) stanno in /public/img/testimonianze, ritagliate sul volto
 * a 128px dagli originali in src/assets/testimonianze/originali. Chi non ha una
 * foto riceve il monogramma dalle iniziali (TestimonialIdentity). I social
 * puntano al sito dell'organizzazione, non a un profilo personale indovinato.
 */
import type { Testimonial } from '../lib/types';

export const TESTIMONIALS: Testimonial[] = [
  /* -- Prima colonna: l'unica visibile su telefono ------------------------ */
  {
    quote:
      'Gli abbiamo portato nove famiglie di prodotti e tre modi diversi di raccontarle. Ne è uscito un sito che un cliente capisce al primo giro, e che finalmente somiglia a come lavoriamo davvero.',
    name: 'Giorgio Canalini',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: '/img/testimonianze/giorgio-canalini.webp',
    socials: [{ kind: 'sito', url: 'https://www.reggianapackaging.it/it' }],
  },
  {
    quote:
      'In JEParma Vlad è quello a cui passi un progetto sapendo che arriverà in fondo. Il sito del Network Day l’ha costruito mentre seguiva anche i clienti, e per la prima volta i partecipanti sono arrivati all’evento sapendo già dove andare.',
    name: 'Andrea D’Amico',
    // U+2060 attorno al trattino: su telefono l'anno andava a capo a metà.
    role: 'Ex presidente · JEParma 2025⁠–⁠2026',
    socials: [{ kind: 'sito', url: 'https://www.jeparma.it/' }],
  },
  {
    quote:
      'Avevamo due pubblici che non parlano la stessa lingua: studenti da tutto il mondo e università. Vlad li ha separati senza farci sembrare due aziende diverse, e ha trasformato una burocrazia complicata in pagine che si leggono.',
    name: 'Chiara',
    role: 'Fondatrice · Kimere',
    socials: [{ kind: 'sito', url: 'https://kimereconsulting.com/' }],
  },

  /* -- Seconda colonna ---------------------------------------------------- */
  {
    quote:
      'Ci serviva un sito che parlasse ai ristoratori senza perdere il calore del laboratorio. Prima della grafica ha voluto capire chi sono i nostri clienti, e oggi è il primo link che mandiamo a un nuovo partner.',
    name: 'Alex',
    role: 'Ex cofondatore · ALSI Gluten Free',
    socials: [{ kind: 'sito', url: 'https://www.alsiglutenfree.com/' }],
  },
  {
    quote:
      'Quando incontro un’azienda nuova, il sito è la prima cosa che guardano. Oggi lo mando prima della riunione, non dopo, e non devo più spiegare cosa manca.',
    name: 'Francesco Fantesini',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: '/img/testimonianze/francesco-fantesini.webp',
    socials: [{ kind: 'sito', url: 'https://www.reggianapackaging.it/it' }],
  },
  {
    quote:
      'Ogni modifica che abbiamo chiesto è arrivata spiegata, non solo fatta. E quando una richiesta non aveva senso ce l’ha detto, con un’alternativa già pronta.',
    name: 'Stefano Marcacci',
    role: 'Cofondatore · Reggiana Packaging',
    avatar: '/img/testimonianze/stefano-marcacci.webp',
    socials: [{ kind: 'sito', url: 'https://www.reggianapackaging.it/it' }],
  },
];
