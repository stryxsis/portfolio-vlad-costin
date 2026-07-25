/**
 * I reveal allo scroll, guidati da attributi.
 *
 * Nessun componente contiene codice di animazione: i componenti emettono
 * `data-split="lines|words"` o `data-reveal`, e questo modulo li anima. Così
 * l'animazione è una decisione centralizzata e un componente nuovo la eredita
 * senza scrivere nulla.
 *
 * VOCABOLARIO (gli ID sono quelli del documento di design):
 *   M1  data-split="lines"  reveal mascherato riga per riga
 *   M2  data-split="words"  reveal mascherato parola per parola (statement corti)
 *   M4  data-reveal         rise-in generico
 *   M11 data-rule           filetto orizzontale che si disegna (once)
 *   M11b data-rail          filetto verticale della timeline (scrub)
 *
 * Tutto vive dentro gsap.matchMedia(): nel ramo `prefers-reduced-motion: reduce`
 * non viene creato NESSUNO ScrollTrigger e il contenuto è semplicemente visibile.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/** Stop di sicurezza: se qualcosa va storto, il contenuto resta leggibile. */
function showEverything(): void {
  gsap.set('[data-split], [data-reveal], [data-rule], [data-rail]', {
    clearProps: 'all',
    autoAlpha: 1,
    visibility: 'visible',
  });
  document.documentElement.classList.remove('js-anim');
}

export function initReveal(): void {
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const mm = gsap.matchMedia();

  /* ---- Ramo movimento consentito ---------------------------------------- */
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const splits: SplitText[] = [];

    // M1 — reveal riga per riga.
    // `mask: 'lines'` avvolge ogni riga in un contenitore con overflow clippato,
    // così l'animazione è una translateY sulla riga interna: interamente
    // compositata. Rifarlo a mano con clip-path animato costerebbe un paint
    // per frame.
    // `autoSplit: true` rispezza le righe quando il font è pronto o il
    // contenitore cambia larghezza — senza, lo swap del webfont cambia i
    // ritorni a capo DOPO che le righe sono state avvolte, e si vede uno shift.
    // L'animazione va creata dentro `onSplit` e restituita, così SplitText la
    // pulisce e la riprende al re-split.
    document.querySelectorAll<HTMLElement>('[data-split="lines"]').forEach((el) => {
      splits.push(
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          // 'none' e NON il default 'auto': 'auto' mette un aria-label sul
          // contenitore, ma aria-label è PROIBITO su ruoli come `paragraph` e
          // `generic` (<p>, <div>) — Lighthouse lo segnala come errore
          // aria-prohibited-attr. Con 'none' non viene aggiunto alcun ARIA e il
          // nome accessibile resta quello calcolato dal testo, che SplitText
          // lascia intatto dentro i wrapper.
          aria: 'none',
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 110,
              duration: 0.9,
              stagger: 0.08,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                // clamp() evita il salto quando il trigger è già oltre lo start
                // al primo paint.
                start: 'clamp(top 82%)',
                once: true,
                fastScrollEnd: true,
              },
            });
          },
        })
      );
    });

    // M2 — reveal parola per parola. Solo per statement brevi: su un paragrafo
    // lungo produce centinaia di wrapper e l'effetto diventa rumore.
    document.querySelectorAll<HTMLElement>('[data-split="words"]').forEach((el) => {
      splits.push(
        SplitText.create(el, {
          type: 'words',
          mask: 'words',
          autoSplit: true,
          aria: 'none', // vedi la nota su aria-prohibited-attr sopra
          onSplit(self) {
            return gsap.from(self.words, {
              yPercent: 105,
              duration: 0.7,
              stagger: 0.035,
              ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'clamp(top 80%)', once: true, fastScrollEnd: true },
            });
          },
        })
      );
    });

    // M4 — rise-in generico. `batch` accorpa gli elementi che entrano insieme
    // in un solo callback invece di creare N trigger indipendenti.
    ScrollTrigger.batch('[data-reveal]', {
      interval: 0.1,
      batchMax: 6,
      start: 'clamp(top 88%)',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          yPercent: 0,
          autoAlpha: 1,
          duration: 0.8,
          stagger: 0.06,
          ease: 'power2.out',
          overwrite: true,
        }),
    });

    // M11 — il filetto che si disegna. transform-origin è in CSS.
    document.querySelectorAll<HTMLElement>('[data-rule]').forEach((el) => {
      gsap.to(el, {
        scaleX: 1,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'clamp(top 92%)', once: true },
      });
    });

    // M11b — il filetto VERTICALE della timeline, disegnato in scrub.
    // Differenze rispetto a M11: asse Y invece di X, e scrub invece di `once`,
    // perché qui il filetto deve seguire la lettura voce per voce (è il gesto
    // dei "segmenti connettori") invece di comparire tutto in una volta.
    // `ease: 'none'` è obbligatorio in scrub: un easing su una posizione già
    // guidata dallo scroll fa sembrare il filetto in ritardo sul dito.
    document.querySelectorAll<HTMLElement>('[data-rail]').forEach((el) => {
      gsap.to(el, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          // Il contenitore, non il filetto: il filetto è alto quanto la lista,
          // ma partendo da scaleY(0) la sua altezza misurata sarebbe zero.
          trigger: el.parentElement ?? el,
          start: 'top 75%',
          end: 'bottom 65%',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });

    // Stato attivo della sezione: fa passare ad accento il numero d'indice.
    // Un toggle di classe (un paint), non un'animazione di colore per frame.
    document.querySelectorAll<HTMLElement>('[data-section]').forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 60%',
        end: 'bottom 40%',
        onToggle: (self) => section.classList.toggle('is-active', self.isActive),
      });
    });

    return () => {
      splits.forEach((s) => s.revert());
      splits.length = 0;
    };
  });

  /* ---- Ramo movimento ridotto -------------------------------------------
     Nessuno ScrollTrigger, nessuno SplitText, nessuna animazione: solo il
     contenuto nella sua posizione finale. */
  mm.add('(prefers-reduced-motion: reduce)', () => {
    showEverything();
  });
}

export { showEverything };