/**
 * Le stage: gli effetti legati al PROGRESSO dello scroll, non a un ingresso.
 *
 * Sta separato da reveal.ts perché la differenza è operativa, non tematica:
 * i reveal si creano una volta e scattano `once`, quindi non scrivono più nulla
 * dopo; le stage scrivono stile a ogni frame in cui sono attive. Tenere le due
 * cose in file distinti rende il conto dei costi leggibile: il budget da
 * difendere è il numero di trigger IN SCRUB, non il numero di trigger.
 *
 * VOCABOLARIO:
 *   M12  [data-screen] + [data-occludes]  rientro dell'uscente nell'handoff
 *   M9   [data-plates] + [data-plate]     scambio dei piatti della stage §30
 *   M6   [data-drift]                     micro-deriva orizzontale in scrub
 *
 * ZERO `pin: true` in tutto il file, e non è un dettaglio stilistico: il pinning
 * inietta un `pin-spacer` nel DOM al refresh, cioè muta il layout mentre si
 * scorre. È la causa numero uno di jank e di sfarfallio nelle stage. Qui ogni
 * stage è `position: sticky` in CSS e ScrollTrigger si limita a LEGGERE il
 * progresso: il rischio è eliminato per costruzione invece che gestito.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Soglia di motion del sito: sotto, nessuna stage viene creata. */
const STAGE_QUERY = '(min-width: 56.25rem) and (prefers-reduced-motion: no-preference)';

export function initStages(): void {
  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  mm.add(STAGE_QUERY, () => {
    const cleanups: (() => void)[] = [];

    /* ---- M12 — il rientro della sezione uscente --------------------------
       L'occlusione in sé è CSS puro e funziona anche senza JS (vedi
       Handoff.astro). Questo aggiunge solo la profondità: mentre la entrante
       sale, l'uscente rientra di un 4% e si spegne a 0.45. Due transform
       compositati, nessun paint.

       Il trigger è la sezione ENTRANTE e non l'uscente: l'uscente è sticky,
       quindi la sua posizione misurata cambia mentre si scorre, e sarebbe il
       riferimento sbagliato. */
    document.querySelectorAll<HTMLElement>('[data-occludes]').forEach((occluder) => {
      const name = occluder.dataset.occludes;
      const screen = document.querySelector<HTMLElement>(`[data-screen="${name}"]`);
      if (!screen) return;

      gsap.to(screen, {
        scale: 0.96,
        autoAlpha: 0.45,
        // `none` è obbligatorio in scrub: un easing sopra una posizione già
        // guidata dallo scroll fa sembrare l'elemento in ritardo sul dito.
        ease: 'none',
        scrollTrigger: {
          trigger: occluder,
          start: 'top bottom', // la entrante affaccia dal basso
          end: 'top top', // ...e ha finito di coprire
          scrub: true,
          invalidateOnRefresh: true,
          // `will-change` acceso solo per la durata della transizione: costante
          // su uno strato a schermo pieno costerebbe memoria di compositing per
          // tutta la vita della pagina, per guadagnare un frame una volta sola.
          onToggle: (self) => {
            screen.style.willChange = self.isActive ? 'transform, opacity' : '';
          },
        },
      });

      cleanups.push(() => {
        screen.style.willChange = '';
        gsap.set(screen, { clearProps: 'scale,opacity,visibility' });
      });
    });

    /* ---- Stage dei piatti (§30) ------------------------------------------
       Un solo trigger. `onUpdate` calcola l'indice attivo e scrive SOLO quando
       cambia: due scritture di classe in tutta la stage invece di una per
       frame. La dissolvenza la fa il CSS con una durata propria, che è anche
       ciò che la rende netta invece che molle. */
    document.querySelectorAll<HTMLElement>('[data-plates]').forEach((stageEl) => {
      const name = stageEl.dataset.plates;
      const plates = Array.from(stageEl.querySelectorAll<HTMLElement>('[data-plate]'));
      // Con un piatto solo non c'è niente da scambiare: la sezione resta
      // l'elenco statico che è già nel suo stato di default.
      if (plates.length < 2) return;

      const screen = document.querySelector<HTMLElement>(`[data-screen="${name}"]`);
      const travel = document.querySelector<HTMLElement>(`[data-travel="${name}"]`);
      // Il genitore dello schermo: è l'elemento che sta FERMO nel flusso, quindi
      // l'unico riferimento di trigger affidabile in una stage sticky.
      const trigger = screen?.parentElement ?? stageEl;

      let current = -1;
      const activate = (i: number): void => {
        if (i === current) return;
        current = i;
        plates.forEach((p, j) => p.classList.toggle('is-active', j === i));
      };
      // Stato di partenza: senza questo i piatti resterebbero tutti a
      // visibility:hidden finché il primo evento di scroll non arriva.
      activate(0);

      ScrollTrigger.create({
        trigger,
        start: 'top top',
        // La corsa è l'altezza del distanziatore del Handoff, letta a ogni
        // refresh: è espressa in svh, quindi cambia col ridimensionamento.
        end: () => `+=${travel?.offsetHeight ?? window.innerHeight * 2}`,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          activate(Math.min(plates.length - 1, Math.floor(self.progress * plates.length)));
        },
      });

      cleanups.push(() => plates.forEach((p) => p.classList.remove('is-active')));
    });

    /* ---- Micro-deriva orizzontale (§20) ---------------------------------
       Il movimento più piccolo del sito: 2.5% verso sinistra lungo tutta la
       sezione. Non deve essere notato, deve solo togliere l'impressione che il
       blocco sia incollato alla pagina. Negativo di proposito: verso destra
       creerebbe overflow orizzontale. */
    document.querySelectorAll<HTMLElement>('[data-drift]').forEach((el) => {
      gsap.fromTo(
        el,
        { xPercent: 0 },
        {
          xPercent: -2.5,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );
      cleanups.push(() => gsap.set(el, { clearProps: 'x,xPercent' }));
    });

    return () => cleanups.forEach((fn) => fn());
  });
}