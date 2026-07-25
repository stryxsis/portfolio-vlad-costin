/**
 * Lenis + ScrollTrigger: UN SOLO loop di rAF, posseduto da GSAP.
 *
 * Le tre righe di wiring qui sotto non sono opzionali e non sono
 * interscambiabili: sono la differenza tra uno scroll fluido e uno scroll che
 * "salta" dopo ogni micro-stallo del main thread.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

let lenis: Lenis | null = null;

/** Istanza condivisa, per lo scroll lock del menu mobile e per scrollTo. */
export function getLenis(): Lenis | null {
  return lenis;
}

export function initScroll(): void {
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.config({
    // Accorpa i callback a un solo evento per frame.
    limitCallbacks: true,
    // Su mobile la barra degli indirizzi che si ritrae cambia l'altezza della
    // viewport: senza questo, ogni scroll innescherebbe un refresh completo.
    ignoreMobileResize: true,
  });

  // Mai insieme a Lenis: entrambi intercettano wheel/touch e si contendono lo
  // scroll. È anche dichiarato sperimentale nella documentazione GSAP.
  ScrollTrigger.normalizeScroll(false);

  lenis = new Lenis({
    // autoRaf è già false in Lenis 1.3.x: NON metterlo a true, altrimenti
    // esistono due loop di rAF (il suo e quello di GSAP) che si desincronizzano.
    lerp: 0.09,
    smoothWheel: true,
    // false: il momentum nativo del touch è migliore e più economico.
    syncTouch: false,
    // Fa passare i link #hash attraverso Lenis.
    anchors: true,
    overscroll: true,
  });

  // 1) ScrollTrigger si aggiorna nello STESSO frame in cui Lenis scrive la
  //    posizione di scroll.
  lenis.on('scroll', ScrollTrigger.update);

  // 2) Il loop è uno solo e lo possiede GSAP. Lenis vuole millisecondi,
  //    gsap.ticker passa secondi. Il terzo argomento `prioritize: true` fa
  //    scrivere a Lenis la posizione PRIMA che i tween di GSAP la leggano:
  //    due ricalcoli di stile per frame diventano uno.
  gsap.ticker.add((time) => lenis!.raf(time * 1000), false, true);

  // 3) Con il lag smoothing attivo (default: soglia 500ms), dopo un qualunque
  //    stallo del main thread GSAP clampa il delta time e l'interpolazione di
  //    Lenis si desincronizza dalla posizione reale: si vede uno scatto.
  gsap.ticker.lagSmoothing(0);

  // Le distanze relative alla viewport e le righe spezzate da SplitText
  // dipendono dalle metriche del font: ricalcolare quando il webfont è pronto.
  void document.fonts.ready.then(() => ScrollTrigger.refresh());
}