/**
 * LA DENSITÀ ADATTIVA DEL CAMPO BINARIO (/chi-sono) — misurata, non indovinata.
 *
 * ⚠ QUESTA È LA SECONDA STESURA, E SOSTITUISCE UN'EURISTICA SBAGLIATA.
 * La prima (2026-09-16) decideva in uno `<script is:inline>` guardando
 * `navigator.hardwareConcurrency` e `navigator.deviceMemory`, con una soglia
 * larga scelta da me e dichiarata come «meglio sbagliare per eccesso: un
 * dispositivo potente declassato perde un po' di densità e non se ne accorge
 * nessuno». **Non era vero, e a smentirla è bastato il primo PC vero**: quello
 * di Vlad, potente, si è ritrovato il fondale rado — e se ne è accorto subito.
 *
 * ⚠ IL DIFETTO NON ERA LA SOGLIA, ERA IL METODO. Ritoccare i numeri avrebbe
 * solo spostato il confine su cui sbagliare, lasciando intatta la categoria di
 * errore: quei due valori non dicono quanto è veloce un dispositivo. Non
 * esiste una CPU «a 4 core» — esistono i 4 core di un portatile del 2013 e
 * quelli di un Apple Silicon; `deviceMemory` è arrotondato a una potenza di
 * due e tagliato a 8, quindi distingue malissimo proprio in alto; e diversi
 * browser attenti alla privacy (Brave, Firefox con `resistFingerprinting`)
 * dichiarano numeri FINTI e bassi apposta, cioè declassano macchine potenti
 * per definizione. Un'euristica costruita su quei due dati non può che
 * sbagliare su qualcuno; l'unica domanda era su chi.
 *
 * ⚠ QUINDI SI MISURA LA COSA CHE INTERESSA DAVVERO: quanto ci mette un
 * fotogramma MENTRE SI SCORRE LA HERO. È esattamente il gesto di cui Vlad si è
 * lamentato, ed è l'unico momento in cui il problema esiste — a pagina ferma
 * anche un dispositivo lentissimo sta a 60fps, perché non c'è niente da fare.
 * Un PC potente non verrà MAI declassato, perché i suoi fotogrammi non sono
 * lenti: non è una soglia tarata meglio, è una classe di errore che sparisce.
 *
 * ⚠ IL VERDETTO SI RICORDA (`localStorage`), e serve a non rifare la misura ad
 * ogni visita: uno `<script is:inline>` in `<head>` lo rilegge e applica la
 * classe PRIMA del primo paint, così dalla seconda visita in poi non c'è
 * nessun momento in cui le cifre spariscono sotto gli occhi. La prima visita
 * su un dispositivo lento resta a densità piena per il primo secondo di
 * scroll: è il prezzo dichiarato di non indovinare.
 */

/** La classe che dimezza la griglia su due assi. Scritta anche nello script
 *  inline di `BaseLayout.astro`: cambiarne una sola scollega le due metà. */
const CLASSE = 'bf-rado';
/** La chiave del verdetto. Stessa convenzione di `vc:seen` del velo. */
const CHIAVE = 'vc:bf';

/** Quanti fotogrammi servono prima di decidere. ⚠ Non è prudenza generica: la
 *  mediana su poche decine di campioni è ancora ostaggio di un singolo
 *  intoppo (una GC, un'altra scheda che compila, l'antivirus), e un falso
 *  positivo qui si RICORDA — cioè costa densità per sempre su una macchina
 *  buona. È lo stesso errore appena corretto, e non va reintrodotto da un
 *  campione troppo corto. */
const CAMPIONI_MINIMI = 60;

/** Sopra questa soglia il dispositivo è in difficoltà vera. 30ms ≈ 33fps: ben
 *  sotto i 60, e ben sopra il rumore di un fotogramma saltato ogni tanto.
 *  ⚠ Misurato: col campo a densità piena un PC debole sta a ~33ms di mediana,
 *  con la griglia dimezzata a ~17ms. La soglia cade fra i due, non su uno. */
const SOGLIA_MS = 30;

/** ⚠ SERVE ANCHE UN QUARTILE BASSO ALTO, e non è ridondante con la mediana:
 *  un dispositivo veloce che incespica per mezzo secondo può avere la mediana
 *  sopra soglia se la finestra di misura è corta, ma i suoi fotogrammi BUONI
 *  restano buoni. Chiedere che anche il 25° percentile sia lento significa
 *  chiedere che sia lento DI CONTINUO, non che abbia avuto un brutto momento. */
const SOGLIA_Q1_MS = 22;

const leggi = (): string | null => {
  try {
    return localStorage.getItem(CHIAVE);
  } catch {
    /* In navigazione privata il solo accesso può LANCIARE, non restituire
       null: stessa trappola già documentata per il velo. */
    return null;
  }
};

const scrivi = (v: string): void => {
  try {
    localStorage.setItem(CHIAVE, v);
  } catch {
    /* Senza storage la misura si rifà ad ogni visita: funziona lo stesso, si
       paga solo il primo secondo di scroll ogni volta. */
  }
};

export function initCampoBinario(): void {
  const campo = document.querySelector<HTMLElement>('.bf:not(.bf--fermo)');
  /* Esce da sé dove il campo vivo non c'è, come initGlobe404 fuori dalla 404. */
  if (!campo) return;

  /* Già deciso in una visita precedente: la classe l'ha già messa lo script
     inline prima del paint, qui non c'è niente da fare. */
  if (leggi()) return;

  /* Con movimento ridotto il campo è congelato: non ci sono fotogrammi da
     misurare e non c'è niente da alleggerire. */
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

  const radice = document.documentElement;
  let campioni: number[] = [];
  let ultimo = 0;
  let raf = 0;
  let scorrendo = 0;
  let chiuso = false;

  /* ⚠ Arrow const e non `function alloScroll()`: una function declaration è
     HOISTATA in cima al blocco, quindi TypeScript la considera creata prima
     del controllo `if (!campo) return` e dentro di lei `campo` torna a essere
     `HTMLElement | null`. Con una const il narrowing sopravvive. */
  const alloScroll = (): void => {
    if (chiuso) return;
    scorrendo = performance.now();
    /* Il campo conta solo finché lo si sta guardando: passata la hero, quello
       che succede sotto non riguarda più questa decisione. */
    if (campo.getBoundingClientRect().bottom <= 0) {
      /* Si è usciti dalla hero senza aver raccolto abbastanza: nessun verdetto
         scritto, si riproverà alla prossima visita. Meglio non decidere che
         decidere su quattro campioni. */
      smonta();
    }
  };

  const smonta = (): void => {
    chiuso = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('scroll', alloScroll);
  };

  const decidi = (): void => {
    const v = [...campioni].sort((a, b) => a - b);
    const mediana = v[Math.floor(v.length / 2)] ?? 0;
    const q1 = v[Math.floor(v.length * 0.25)] ?? 0;
    smonta();
    if (mediana > SOGLIA_MS && q1 > SOGLIA_Q1_MS) {
      radice.classList.add(CLASSE);
      scrivi('rado');
    } else {
      /* ⚠ Si ricorda ANCHE il verdetto positivo. Senza, ogni visita rifarebbe
         la misura, e prima o poi una di quelle misure capiterebbe in un momento
         storto — cioè un PC buono verrebbe declassato per sfortuna, che è
         esattamente il difetto che questo file esiste per chiudere. */
      scrivi('pieno');
    }
  };

  const tick = (ora: number): void => {
    if (chiuso) return;
    raf = requestAnimationFrame(tick);
    const dt = ultimo === 0 ? 0 : ora - ultimo;
    ultimo = ora;
    /* ⚠ SI CAMPIONA SOLO MENTRE SI SCORRE, ed è il punto di tutta la misura:
       a pagina ferma anche un dispositivo lentissimo fa 60fps, perché non c'è
       niente da comporre. Misurare da fermi vorrebbe dire non declassare mai
       nessuno — cioè avere scritto questo file per niente. */
    if (dt > 0 && dt < 500 && performance.now() - scorrendo < 120) {
      campioni.push(dt);
      if (campioni.length >= CAMPIONI_MINIMI) decidi();
    }
  };

  window.addEventListener('scroll', alloScroll, { passive: true });
  raf = requestAnimationFrame(tick);
  window.addEventListener('pagehide', smonta, { once: true });
}
