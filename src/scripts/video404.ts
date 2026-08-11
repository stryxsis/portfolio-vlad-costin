/**
 * Il fondo video della 404: quando si carica, quando NON si carica, e come si ferma.
 *
 * Il disegno sta in 404.astro. Qui c'è solo la decisione di caricarlo.
 *
 * ⚠ IL `src` DEL VIDEO NON STA NELL'HTML, sta in `data-src`, e non è un
 * vezzo: un `<video src autoplay>` scritto nel markup si scarica SEMPRE — con
 * JS spento, per un crawler, e soprattutto per chi ha chiesto meno movimento,
 * a cui verrebbe scaricato un filmato che poi non deve nemmeno partire. Con
 * `data-src` il video esiste solo se qualcuno decide che debba esistere, e in
 * tutti gli altri casi resta il fotogramma statico — che è già l'immagine
 * giusta, non un ripiego.
 */

/** Il fondo è decorativo: se la connessione è scarsa o l'utente ha chiesto di
 *  risparmiare dati, un filmato di sfondo è la prima cosa da non scaricare. */
function connessioneGenerosa(): boolean {
  const c = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!c) return true; // informazione non disponibile: non si penalizza nessuno
  if (c.saveData) return false;
  return c.effectiveType !== 'slow-2g' && c.effectiveType !== '2g';
}

export function initVideo404(): void {
  const video = document.querySelector<HTMLVideoElement>('[data-bg-video]');
  if (!video) return;

  const sezione = video.closest<HTMLElement>('[data-bg-scope]');
  const src = video.dataset.src;
  if (!src) return;

  /* Stessa condizione che governa ogni movimento del sito. Non si usa
     `html.js-anim` perché quella classe cade anche per il watchdog del bundle,
     e qui la domanda è solo una: l'utente vuole del movimento? */
  const movimentoOk = matchMedia('(prefers-reduced-motion: no-preference)').matches;
  if (!movimentoOk || !connessioneGenerosa()) return;

  /* ⚠ `preload` va riportato ad `auto` PRIMA di assegnare `src`, e la prima
     stesura sbagliava proprio qui. Nel markup l'attributo è `preload="none"`
     — corretto, perché impedisce di scaricare il filmato a chi non lo vedrà
     mai — ma lasciarlo a `none` dopo aver messo il `src` significa che il
     browser non carica NIENTE: misurato via CDP, il video restava
     `paused: true` con la sorgente impostata e l'evento `canplay` non
     arrivava mai, perché non c'era nessun caricamento in corso da cui potesse
     nascere. */
  video.preload = 'auto';
  video.src = src;

  /* `play()` può essere RIFIUTATA — le politiche di autoplay cambiano fra
     browser e un video muto di solito passa, ma non è garantito. Se viene
     rifiutata non si insiste: resta il fotogramma, che è già completo. La
     promessa va comunque gestita, o in console compare un errore non catturato
     ad ogni 404 caricata.
     Si chiama `play()` SUBITO invece di aspettare `canplay`: è `play()` stessa
     ad avviare il recupero dei dati, e la sua promessa si risolve quando la
     riproduzione è davvero cominciata — cioè è già l'evento giusto, senza
     bisogno di ascoltarne un altro prima. */
  void video.play().then(
    () => sezione?.classList.add('is-live'),
    () => {
      /* niente: il fondo statico è già in scena */
    }
  );

  /* ---- Il comando di pausa ------------------------------------------------
     ⚠ NON è una gentilezza opzionale: WCAG 2.2.2 chiede che un movimento
     automatico più lungo di 5 secondi, presentato INSIEME ad altro contenuto,
     si possa fermare. Qui il movimento sta letteralmente dietro al testo che
     la pagina esiste per far leggere. È lo stesso obbligo già rispettato dal
     muro di §04 (che si ferma in hover e col fuoco dentro); lì bastava
     l'hover perché il muro È il contenuto, qui serve un comando esplicito
     perché nessuno "passa sopra" un fondo a tutto schermo per fermarlo.

     Il bottone vive nell'HTML ma si vede solo con `is-live`: senza video in
     moto non c'è niente da fermare, e un comando che non comanda niente è
     peggio della sua assenza. */
  const tasto = sezione?.querySelector<HTMLButtonElement>('[data-bg-toggle]');
  if (!tasto) return;

  const etichetta = (inPausa: boolean): void => {
    tasto.textContent = inPausa ? 'Riprendi lo sfondo' : 'Ferma lo sfondo';
    tasto.setAttribute('aria-pressed', String(inPausa));
  };
  etichetta(false);

  tasto.addEventListener('click', () => {
    if (video.paused) {
      void video.play().then(() => etichetta(false), () => {});
    } else {
      video.pause();
      etichetta(true);
    }
  });
}
