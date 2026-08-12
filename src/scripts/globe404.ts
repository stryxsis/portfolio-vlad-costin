/**
 * Il globo della 404: quanto costa, come gira, e come si ferma.
 *
 * Sostituisce il fondo video della prima stesura, che Vlad ha trovato a scatti.
 *
 * ⚠ ORIGINE: uno snippet React (`cobe` + shadcn + `@/lib/utils`) portato da
 * Vlad. Qui la decisione è DIVERSA dalle tre volte precedenti, ed è
 * deliberato: **`cobe` è stato installato.** Non è un framework né un sistema
 * di componenti — è una libreria vanilla di 13 KB, ZERO dipendenze, che
 * espone una funzione (`createGlobe(canvas, opts)`) e disegna in WebGL. Sta
 * nella stessa categoria di GSAP e Lenis, che questo sito usa già. React,
 * `cn()` e la struttura `/components/ui` restano fuori, come sempre.
 *
 * ⚠ LO SNIPPET È SCRITTO PER COBE v1 E NON FUNZIONA COSÌ COM'È SULLA v2.
 * Due differenze, entrambe verificate leggendo `node_modules/cobe`:
 *   1. `onRender` NON ESISTE PIÙ. Nella v2 non c'è nessuna callback per
 *      frame — e non c'è nemmeno un ciclo di rendering interno (zero
 *      occorrenze di `requestAnimationFrame` nel sorgente). Il ciclo lo deve
 *      guidare chi la usa, chiamando `update()`. Copiando lo snippet il globo
 *      sarebbe apparso FERMO, dipinto una volta sola.
 *   2. `width`/`height` sono la misura CSS: cobe fa `canvas.width =
 *      opts.width * devicePixelRatio`. Lo snippet passa `width * 2` E
 *      `devicePixelRatio: 2`, quindi rende a **quattro volte** i pixel
 *      necessari (su uno schermo Retina, sedici volte l'area del canvas). È
 *      lì che stava il costo, non in `cobe`.
 *
 * ⚠ E `update()` RIDIMENSIONA IL CANVAS SE GLI SI PASSANO width/height —
 * riallocando il buffer di disegno. Per questo il ciclo passa SOLO `phi`, e
 * la misura viaggia a parte, solo quando cambia davvero.
 */
import createGlobe from 'cobe';

/* --- Tarature, tutte in un posto solo ------------------------------------
   Se un domani il globo risultasse pesante su una macchina lenta, è QUI che
   si interviene, in quest'ordine: prima `DPR_MAX` (l'area cresce col
   quadrato, quindi è la leva che pesa di più), poi `CAMPIONI`. */

/** Tetto al pixel ratio. Oltre 2 non si guadagna nulla di visibile su un
 *  oggetto sfumato come questo, e l'area da riempire raddoppia ancora. */
const DPR_MAX = 2;

/** Quanti punti compongono i continenti. Il riferimento usa 16000; a questa
 *  dimensione la differenza non si vede e ogni punto è lavoro per frame. */
const CAMPIONI = 12000;

/** Velocità di rotazione, radianti per frame. */
const PASSO = 0.0035;

/** L'accento del sito (`--color-accent: #9370f5`), normalizzato 0-1 come
 *  vuole cobe. ⚠ È l'UNICO punto del sito che ricopia un token invece di
 *  leggerlo: WebGL vuole tre float, non una stringa CSS. Se l'accento cambia,
 *  questa riga va cambiata con lui. */
const ACCENTO: [number, number, number] = [147 / 255, 112 / 255, 245 / 255];

/** Parma. L'unico segnaposto sul globo, e non è decorazione: su una pagina
 *  che dice "ti sei perso", indicare dove sto io è l'unica informazione utile
 *  che un mappamondo possa dare. */
const PARMA: [number, number] = [44.8015, 10.3279];

function webglDisponibile(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function initGlobe404(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-globe]');
  if (!canvas) return;

  const sezione = canvas.closest<HTMLElement>('[data-globe-scope]');

  /* Un globo che gira è movimento continuo: chi ha chiesto di non averne non
     lo riceve, e non lo riceve nemmeno fermo — non viene creato affatto, così
     non resta un contesto WebGL a occupare memoria per niente. La pagina resta
     completa: il testo è tutto lì. Stessa regola per una macchina senza WebGL. */
  if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  if (!webglDisponibile()) return;

  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);

  let lato = canvas.offsetWidth;
  if (lato === 0) return; // nascosto o non ancora impaginato: non c'è niente da disegnare

  let phi = 0;
  let rotazioneManuale = 0;
  let inPausa = false;

  /** Dove il puntatore ha cominciato a trascinare; `null` = non si trascina. */
  let presaDa: number | null = null;
  let spostamento = 0;

  const globe = createGlobe(canvas, {
    devicePixelRatio: dpr,
    // ⚠ Larghezza CSS, NON già moltiplicata: ci pensa cobe. Vedi la nota in
    // testa al file sul perché lo snippet originale rendeva a 4x.
    width: lato,
    height: lato,
    phi: 0,
    theta: 0.28,
    dark: 0,
    diffuse: 0.4,
    mapSamples: CAMPIONI,
    mapBrightness: 1.15,
    // Globo bianco su canvas nero: è il contrasto massimo disponibile, e
    // l'unica scelta che non introduce una seconda tinta accanto all'accento.
    baseColor: [1, 1, 1],
    glowColor: [1, 1, 1],
    markerColor: ACCENTO,
    markers: [{ location: PARMA, size: 0.07 }],
  });

  /* ---- Il ciclo -----------------------------------------------------------
     Il rAF è nostro perché la v2 non ne ha uno (vedi la nota in testa).
     Si passa SOLO `phi`: aggiungere width/height qui farebbe riallocare il
     buffer di disegno ad ogni fotogramma.
     Quando la scheda va in secondo piano il browser sospende `rAF` da solo,
     quindi non serve nessun aggancio a `visibilitychange`. */
  const disegna = (): void => {
    if (!inPausa && presaDa === null) phi += PASSO;
    globe.update({ phi: phi + rotazioneManuale });
    requestAnimationFrame(disegna);
  };
  requestAnimationFrame(disegna);

  /* Il canvas entra in dissolvenza: senza, comparirebbe di scatto.
     ⚠ Sul rapporto con la regola LCP: l'elemento più grande sopra la piega di
     questa pagina è il "404" tipografico, che si dipinge subito e non anima
     nulla. Il canvas gli sta sotto ed è più piccolo; anche nel caso in cui
     Chrome lo considerasse candidato, l'animazione di opacità lo escluderebbe
     e l'LCP ricadrebbe sul numero — cioè su un elemento già dipinto. */
  sezione?.classList.add('is-live');

  /* ---- Dimensione ---------------------------------------------------------
     `ResizeObserver` sul canvas e non l'evento `resize`: il lato dipende dal
     layout, non solo dalla finestra. ⚠ Osservare l'elemento di cui si sta
     scrivendo la dimensione è la trappola già costata un difetto nell'avviso
     §00 — qui NON si presenta, perché la dimensione CSS del canvas la decide
     il foglio di stile e questo codice si limita a leggerla per dire a WebGL
     quanti pixel disegnare. */
  new ResizeObserver(() => {
    const nuovo = canvas.offsetWidth;
    if (nuovo === 0 || nuovo === lato) return;
    lato = nuovo;
    globe.update({ width: lato, height: lato });
  }).observe(canvas);

  /* ---- Trascinamento ------------------------------------------------------
     ⚠ NON viola la regola "niente hover come trigger": non parte niente al
     passaggio del mouse — la rotazione va già da sola, e il trascinamento è
     un'azione deliberata di chi guarda. */
  const prendi = (x: number): void => {
    presaDa = x - spostamento;
    canvas.style.cursor = 'grabbing';
  };
  const lascia = (): void => {
    presaDa = null;
    canvas.style.cursor = 'grab';
  };
  const muovi = (x: number): void => {
    if (presaDa === null) return;
    spostamento = x - presaDa;
    rotazioneManuale = spostamento / 200;
  };

  canvas.addEventListener('pointerdown', (e) => prendi(e.clientX));
  canvas.addEventListener('pointerup', lascia);
  canvas.addEventListener('pointercancel', lascia);
  canvas.addEventListener('pointerleave', lascia);
  canvas.addEventListener('pointermove', (e) => muovi(e.clientX));
  // `touch-action: none` è in CSS: senza, il browser si prende il gesto per
  // scorrere la pagina e il trascinamento non arriva mai qui.

  /* ---- Il comando di pausa ------------------------------------------------
     ⚠ WCAG 2.2.2, come per il video che questo globo sostituisce: un
     movimento automatico oltre i 5 secondi, presentato INSIEME al contenuto
     da leggere, deve potersi fermare. Il globo gira all'infinito sotto il
     testo della pagina, quindi l'obbligo vale identico.
     ⚠ E `destroy()` NON è la risposta: fermare deve essere reversibile, e
     distruggere il globo lascerebbe un rettangolo vuoto — cioè nascondere
     invece di mettere in pausa. Si smette solo di far avanzare `phi`. */
  const tasto = sezione?.querySelector<HTMLButtonElement>('[data-globe-toggle]');
  if (tasto) {
    const etichetta = (): void => {
      tasto.textContent = inPausa ? 'Riprendi il globo' : 'Ferma il globo';
      tasto.setAttribute('aria-pressed', String(inPausa));
    };
    etichetta();
    tasto.addEventListener('click', () => {
      inPausa = !inPausa;
      etichetta();
    });
  }
}
