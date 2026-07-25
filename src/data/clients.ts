/**
 * Social proof.
 *
 * Sono NOMI REALI dal CV, etichettati per quello che sono. `kind` distingue
 * "dove ho lavorato" da "dove ho studiato": chiamare "cliente" un'azienda in cui
 * si è stati dipendenti è il genere di ambiguità che un lettore attento nota
 * subito, e che costa più credibilità di quanta ne guadagni.
 *
 * I loghi non ci sono ancora: il componente rende i nomi trattati
 * tipograficamente e passa automaticamente ai loghi quando arriveranno,
 * aggiungendo `logo` a queste voci.
 */
import type { ClientRef } from '../lib/types';

export const CLIENTS: ClientRef[] = [
  { name: 'JEParma', kind: 'lavoro', url: 'https://www.jeparma.it' },
  { name: 'Università di Parma', kind: 'studio', url: 'https://www.unipr.it' },
  { name: 'Scic Cucine d’Italia', kind: 'lavoro' },
  { name: 'Sonoco Metal Packaging', kind: 'lavoro' },
  { name: 'ITIS Leonardo Da Vinci', kind: 'studio' },
];