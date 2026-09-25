/**
 * L'unico entry point del JS del sito.
 *
 * NON è un'isola: è un modulo ES normale importato da un <script> che Astro
 * processa, bundla e deduplica. Nessun framework, nessuna idratazione.
 *
 * Ordine obbligato: prima lo scroll (crea l'istanza Lenis e il ticker
 * condiviso), poi i reveal e la navbar, che dipendono da quello.
 */
import { initScroll } from './scroll';
import { initReveal, initSectionState, showEverything } from './reveal';
import { initStages } from './stage';
import { initNav } from './nav';
import { initBanner } from './banner';
import { initLoader } from './loader';
import { initGlobe404 } from './globe404';
import { initLightfall } from './lightfall';
import { initCampoBinario } from './campoBinario';
import { initWorks } from './works';

declare global {
  interface Window {
    __vcBooted?: boolean;
  }
}

function boot(): void {
  // Guardia di idempotenza: se un giorno si aggiungesse ClientRouter, questo
  // impedisce doppie istanze di Lenis e ScrollTrigger duplicati.
  if (window.__vcBooted) return;
  window.__vcBooted = true;

  try {
    // Segnala al watchdog inline che il JS delle animazioni è partito, così
    // non rimuove la classe che tiene nascosti gli elementi da rivelare.
    document.documentElement.dataset.animReady = '1';

    /* PRIMO DI TUTTI, e non per gerarchia: il velo è già dipinto sopra la
       pagina (lo script inline in <head> lo ha acceso prima del paint), quindi
       da questo momento c'è un conto alla rovescia vero davanti agli occhi di
       chi guarda. Tutto ciò che segue succede sotto al velo e può prendersi il
       tempo che serve. */
    initLoader();

    initScroll();
    initReveal();
    initStages();
    initNav();
    /* Dopo initNav: la banda spinge la navbar, quindi la navbar deve esistere
       e aver già misurato la propria pillola prima che qualcosa la sposti. */
    initBanner();
    /* Esce da solo su ogni pagina che non sia la 404 (nessun `[data-globe]`
       da trovare), come initLoader fuori dalla Home. */
    initGlobe404();
    /* Stessa forma: esce da solo dove non c'è `[data-lightfall]`, cioè ovunque
       tranne la hero di /portfolio. ⚠ A differenza del globo, con movimento
       ridotto NON esce — disegna un fotogramma solo e si ferma: il fondale deve
       restare, fermo, o resterebbe un rettangolo vuoto. */
    initLightfall();
    /* Stessa forma ancora: esce da solo dove non c'è un campo binario VIVO,
       cioè ovunque tranne la hero di /chi-sono. Non anima niente — misura i
       fotogrammi durante lo scroll e decide se la griglia va alleggerita su
       questo dispositivo. Vedi campoBinario.ts per il perché non lo decide un
       controllo su `hardwareConcurrency` come faceva la prima stesura. */
    initCampoBinario();
    /* Esce da solo dove non c'è `[data-works]`, cioè ovunque tranne /portfolio. */
    initWorks();

    // Fuori dal try dei precedenti solo concettualmente: non è movimento ma
    // stato, e deve funzionare anche con movimento ridotto (vedi reveal.ts).
    initSectionState();
  } catch (err) {
    // Se l'inizializzazione fallisce, il contenuto pre-nascosto resterebbe
    // invisibile: un sito rotto è peggio di un sito senza animazioni.
    console.error('[boot] inizializzazione animazioni fallita:', err);
    showEverything();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}