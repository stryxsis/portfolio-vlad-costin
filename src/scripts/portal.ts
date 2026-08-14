/**
 * M19 — IL PORTALE: la finestra che si apre sullo spazio.
 *
 * Chiesto da Vlad (2026-08-14) portando uno snippet React (`ScrollExpand.jsx`
 * + il suo CSS): un riquadro che parte piccolo e, scorrendo, si apre fino a
 * riempire lo schermo. La prima CTA di /chi-sono (il bivio) è stata buttata
 * via per questo — «cambiamo lo stile completamente».
 *
 * ⚠ NESSUNA DIPENDENZA INSTALLATA, quinta volta. E qui non è nemmeno una
 * rinuncia: il cuore di quello snippet è `position: sticky` dentro un
 * contenitore alto, con un `clip-path` guidato dal progresso di scroll —
 * cioè ESATTAMENTE il vocabolario che questo file già parla (M12/M16). Il
 * disegno si porta intero; a sparire è solo l'impalcatura React.
 *
 * ⚠ COSA SI È BUTTATO DELLO SNIPPET, e non è codice in meno per pigrizia:
 *
 *   - **Il loop `requestAnimationFrame` con lo smoothing esponenziale**
 *     (`current += (target - current) * (1 - Math.exp(-1/(60*smoothing)))`).
 *     È un'interpolazione fra la posizione di scroll e quella dipinta: la fa
 *     già `scrub` di ScrollTrigger, e sopra c'è già Lenis che smorza lo
 *     scroll stesso. Tenerlo avrebbe messo TRE interpolazioni in fila sullo
 *     stesso gesto, che non è più fluido — è in ritardo.
 *   - **`smoothstep()` e il calcolo a mano delle soglie.** Qui le fasi sono
 *     posizioni su una timeline in scrub: GSAP mappa il progresso 0..1 sulla
 *     durata totale, quindi le stesse soglie del riferimento (0.4, 0.68,
 *     0.12) diventano posizioni, non condizionali dentro un callback.
 *   - **`readProgress()` + i due rami `useWindowScroll`.** Il riferimento può
 *     scrollare dentro sé stesso; qui lo scroller è la pagina, sempre.
 *   - **`ResizeObserver` + `measure()`.** L'altezza del contenitore è in
 *     `svh` nel CSS e `invalidateOnRefresh` rimisura le corse: nessuno deve
 *     scrivere pixel in JS.
 *
 * ⚠ ZERO `pin: true`, come in tutto il repo: lo sticky è dichiarato in CSS e
 * questo modulo si limita a LEGGERE il progresso. Un pin inietterebbe un
 * `pin-spacer` nel DOM al refresh, cioè muterebbe il layout mentre si scorre.
 *
 * ⚠ E LO STATO FINALE È QUELLO BASE, non quello iniziale: nel CSS il riquadro
 * nasce già aperto (`--pt-p: 1`) e sono questi tween a riportarlo indietro.
 * Senza JS, con JS rotto, con movimento ridotto o sotto i 900px, la sezione è
 * una CTA completa e ferma — non un rettangolo piccolo che nessuno aprirà mai.
 * È la lezione già costata §03 (vedi CLAUDE.md): una sezione che dipende da un
 * `gsap.set` per essere visibile si rompe in silenzio il giorno in cui quel
 * `set` non viene raggiunto.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Stessa soglia di motion delle stage: sotto, nessun portale viene creato. */
const PORTAL_QUERY = '(min-width: 56.25rem) and (prefers-reduced-motion: no-preference)';

/* Le proporzioni della corsa. Sono FRAZIONI e non secondi: con lo scrub GSAP
   mappa il progresso 0..1 sulla durata totale della timeline, quindi conta solo
   il rapporto fra loro.
   ⚠ IL RAPPORTO FRA QUESTI DUE DEVE RESTARE QUELLO DI `--pt-track` NEL CSS: è
   il CSS a creare la distanza di scroll (l'altezza del contenitore), questo
   file decide solo COME viene spesa. Cambiarne uno solo comprime o dilata
   l'apertura dentro una corsa che non è cambiata. */
const APERTURA = 1;
const FERMO = 0.29; /* 0,35 / 1,2 del riferimento */

/* Le soglie del riferimento, tenute IDENTICHE perché sono la sua taratura e
   funzionava: l'invito a scorrere sparisce subito, il titolo se ne va nella
   seconda metà dell'apertura, il contenuto entra solo sull'ultimo terzo. */
const INVITO_FINE = 0.12;
const TITOLO_DA = 0.4;
const TITOLO_A = 0.88;
const DENTRO_DA = 0.68;

/** Lo zoom di partenza del cielo. Il riferimento usa 1.35 su una FOTO; qui
 *  sotto ci sono delle stelle, e a 1.35 il campo visibile nel riquadro
 *  piccolo diventa così rado da sembrare vuoto. 1.18 conserva la sensazione
 *  di avvicinamento senza diradare il cielo. */
const ZOOM = 1.18;

export function initPortal(): void {
  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  mm.add(PORTAL_QUERY, () => {
    const cleanups: (() => void)[] = [];

    document.querySelectorAll<HTMLElement>('[data-portal]').forEach((track) => {
      const q = <T extends HTMLElement>(sel: string): T | null =>
        track.querySelector<T>(sel);

      const frame = q('[data-portal-frame]');
      const cielo = q('[data-portal-sky]');
      const titolo = q('[data-portal-say]');
      const dentro = q('[data-portal-inside]');
      const invito = q('[data-portal-hint]');

      /* Il riquadro è l'unica parte non negoziabile: senza, non c'è niente da
         aprire e la sezione resta quella statica, che è già completa. */
      if (!frame) return;

      const tl = gsap.timeline({
        /* `none` obbligatorio in scrub: un easing sopra una posizione già
           guidata dallo scroll fa sembrare l'elemento in ritardo sul dito.
           ⚠ Il riferimento qui usa `smoothstep`, cioè un ease-in-out — se lo
           si rimpiange, va rimesso INSIEME a una `scrub: <numero>`, mai da
           solo: è l'interpolazione che rende accettabile lo scarto fra dito e
           pixel, non l'easing. */
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          invalidateOnRefresh: true,
          /* `will-change` acceso solo per la durata della corsa. ⚠ Su questo
             riquadro conta più che altrove: è grande quanto la viewport e
             `clip-path` è una proprietà di paint, non di composizione —
             tenerlo promosso a vita costerebbe memoria per tutta la pagina
             per guadagnare un fotogramma una volta sola. */
          onToggle: (self) => {
            frame.style.willChange = self.isActive ? 'clip-path' : '';
            if (cielo) cielo.style.willChange = self.isActive ? 'transform' : '';
          },
        },
      });

      /* L'APERTURA. Un solo numero (`--pt-p`, 0 → 1) e la geometria la calcola
         il CSS: gli insets, il raggio degli angoli e tutto il resto sono
         `calc()` su quella variabile. È deliberato — così le proporzioni del
         riquadro si leggono e si ritoccano nel foglio di stile, accanto a ciò
         che descrivono, invece di essere sepolte in cinque `style.setProperty`
         dentro un callback per frame come nel riferimento. */
      tl.fromTo(frame, { '--pt-p': 0 }, { '--pt-p': 1, duration: APERTURA }, 0);

      /* Il cielo si allontana mentre la finestra si apre: è ciò che fa leggere
         l'apertura come un AVVICINAMENTO allo spazio invece che come un
         rettangolo che cresce. Senza, le stelle sembrano incollate al vetro. */
      if (cielo) tl.fromTo(cielo, { scale: ZOOM }, { scale: 1, duration: APERTURA }, 0);

      /* L'invito se ne va appena si comincia: ha già fatto il suo lavoro nel
         momento esatto in cui qualcuno lo esegue. */
      if (invito) {
        tl.to(invito, { opacity: 0, y: 8, duration: APERTURA * INVITO_FINE }, 0);
      }

      /* Il titolo si allontana verso l'alto e svanisce. Lo `scale` appena sopra
         1 non è decorazione: un testo che sfuma restando della stessa
         grandezza legge come un livello spento, mentre uno che cresce di poco
         legge come qualcosa che ci sta passando accanto — che è quello che
         succede, visto che dietro si sta aprendo dello spazio. */
      if (titolo) {
        tl.to(
          titolo,
          {
            opacity: 0,
            y: -28,
            scale: 1.06,
            duration: APERTURA * (TITOLO_A - TITOLO_DA),
          },
          APERTURA * TITOLO_DA
        );
      }

      /* Il contenuto entra solo sull'ultimo terzo, quando la finestra è ormai
         quasi tutto lo schermo: prima sarebbe testo dentro un francobollo. */
      if (dentro) {
        tl.fromTo(
          dentro,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: APERTURA * (1 - DENTRO_DA) },
          APERTURA * DENTRO_DA
        );
      }

      /* LA CODA FERMA. Un tween vuoto: non anima nulla, OCCUPA TEMPO — e con
         lo scrub il tempo è distanza di scroll. Serve perché senza, la sezione
         si sbloccherebbe nell'istante esatto in cui il contenuto finisce di
         comparire, e i due bottoni non si vedrebbero mai fermi. Stesso
         dispositivo della coda del mazzo di §30. */
      tl.to({}, { duration: FERMO });

      cleanups.push(() => {
        frame.style.willChange = '';
        if (cielo) cielo.style.willChange = '';
        /* Le proprietà scritte dai tween vanno rimosse, non lasciate al loro
           ultimo valore: uscendo da questa media query (resize sotto i 900px,
           o movimento ridotto attivato a pagina aperta) il ramo statico deve
           ritrovare gli elementi puliti, o resterebbero all'opacità che aveva
           il fotogramma in cui ci si trovava. */
        gsap.set(frame, { clearProps: '--pt-p' });
        if (cielo) gsap.set(cielo, { clearProps: 'transform' });
        [titolo, dentro, invito].forEach((el) => {
          if (el) gsap.set(el, { clearProps: 'opacity,transform' });
        });
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}
