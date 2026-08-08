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

    initScroll();
    initReveal();
    initStages();
    initNav();
    /* Dopo initNav: la banda spinge la navbar, quindi la navbar deve esistere
       e aver già misurato la propria pillola prima che qualcosa la sposti. */
    initBanner();

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