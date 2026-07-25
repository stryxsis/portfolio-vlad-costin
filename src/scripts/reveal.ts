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

    /* M4 — rise-in generico. `batch` accorpa gli elementi che entrano insieme in
       un solo callback invece di creare N trigger indipendenti.

       ⚠ NIENTE `once: true`, e la contabilità di "già rivelato" è fatta a mano.
       Motivo, verificato in Chrome: con `once` un SALTO di posizione (link
       ancora, tasto Fine, ripristino dello scroll al reload) attraversa start e
       end nello stesso update, ScrollTrigger reclama i trigger, e gli elementi
       restano a opacità 0 — anche continuando a scorrere, perché il trigger non
       esiste più. Contenuto invisibile in modo permanente, cioè il modo peggiore
       di rompersi, sullo scenario più banale che ci sia: ricaricare la pagina a
       metà.

       Tre coperture, quindi:
         onEnter      lo scorrimento normale verso il basso
         onEnterBack  si torna su dentro la fascia dopo esserla passata
         onLeave      la fascia è stata attraversata in un colpo → mostra SUBITO,
                      senza animazione: un'entrata di cui nessuno ha visto
                      l'inizio non è un'animazione, è solo un ritardo. */
    const revealed = new WeakSet<Element>();

    const reveal = (els: Element[], animate: boolean): void => {
      const fresh = els.filter((el) => !revealed.has(el));
      if (fresh.length === 0) return;
      fresh.forEach((el) => revealed.add(el));

      gsap.to(fresh, {
        yPercent: 0,
        autoAlpha: 1,
        duration: animate ? 0.8 : 0,
        stagger: animate ? 0.06 : 0,
        ease: 'power2.out',
        overwrite: true,
      });
    };

    ScrollTrigger.batch('[data-reveal]', {
      interval: 0.1,
      batchMax: 6,
      start: 'clamp(top 88%)',
      onEnter: (batch) => reveal(batch, true),
      onEnterBack: (batch) => reveal(batch, true),
      onLeave: (batch) => reveal(batch, false),
    });

    /* RETE DI SICUREZZA, e serve davvero.
       Qualsiasi approccio a EVENTI perde una transizione di stato che salta il
       mezzo: se la posizione passa da "elemento sotto la viewport" a "elemento
       sopra la viewport" in un solo update, non c'è nessun ingresso da
       osservare, e l'elemento resta a opacità 0 per sempre. Succede su cose
       banali: tasto Fine, link ancora, ripristino della posizione al reload.
       Contenuto invisibile in modo permanente è il peggior modo di rompersi, e
       tutto l'impianto `js-anim` esiste per impedirlo — questa è la stessa
       garanzia estesa allo scroll.

       La soluzione è un controllo di STATO, non di evento, e l'invariante è
       questo: QUANDO LO SCORRIMENTO SI FERMA, NIENTE CHE SIA IN VISTA PUÒ ESSERE
       ANCORA NASCOSTO. Se lo scroll è fermo e un elemento sta oltre la propria
       soglia d'ingresso a opacità 0, non c'è nessun evento futuro che lo
       salverà: è già un difetto.

       Due modi di mostrarlo, secondo dove si trova:
         - completamente sopra la viewport → subito, senza animazione: un
           ingresso di cui nessuno ha visto l'inizio non è un'animazione, è solo
           un ritardo;
         - ancora almeno in parte visibile → con l'animazione, così se la rete
           dovesse anticipare il batch al primo caricamento non si perde nulla.
       La contabilità in `revealed` impedisce che rete e batch si pestino.

       Quando gira: al `refresh` (iniziale, dopo `fonts.ready`, a ogni resize) e
       allo `scrollEnd`. Nessun costo per frame, e si stacca da sola appena tutti
       gli elementi sono stati rivelati. */
    let pending = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    const sweepPassed = (): void => {
      if (pending.length === 0) return;

      const threshold = window.innerHeight * 0.88;
      const late: HTMLElement[] = [];
      const missed: HTMLElement[] = [];

      for (const el of pending) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0) missed.push(el);
        else if (r.top < threshold) late.push(el);
      }

      if (missed.length > 0) reveal(missed, false);
      if (late.length > 0) reveal(late, true);

      pending = pending.filter((el) => !revealed.has(el));
      if (pending.length === 0) {
        ScrollTrigger.removeEventListener('refresh', sweepPassed);
        ScrollTrigger.removeEventListener('scrollEnd', sweepPassed);
      }
    };

    ScrollTrigger.addEventListener('refresh', sweepPassed);
    ScrollTrigger.addEventListener('scrollEnd', sweepPassed);
    sweepPassed();

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

    return () => {
      ScrollTrigger.removeEventListener('refresh', sweepPassed);
      ScrollTrigger.removeEventListener('scrollEnd', sweepPassed);
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

/**
 * Stato attivo della sezione: fa passare ad accento il numero d'indice.
 *
 * IntersectionObserver e NON uno ScrollTrigger per sezione. La prima versione
 * creava un trigger per ogni `[data-section]`: sulla Home sono otto trigger che
 * esistono solo per commutare una classe. L'observer ne usa ZERO e delega
 * l'osservazione al browser, che la fa fuori dal thread principale.
 *
 * Fuori da `gsap.matchMedia` di proposito: non è movimento, è uno stato. Con
 * `prefers-reduced-motion: reduce` il numero della sezione corrente deve
 * comunque colorarsi — è un'informazione di orientamento, non un'animazione.
 */
export function initSectionState(): () => void {
  const sections = document.querySelectorAll<HTMLElement>('[data-section]');
  if (sections.length === 0 || !('IntersectionObserver' in window)) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        e.target.classList.toggle('is-active', e.isIntersecting);
      }
    },
    {
      /* La banda centrale della viewport: una sezione è "attiva" quando la si
         sta leggendo, non quando ne affaccia un bordo. -40%/-40% lascia una
         finestra del 20% al centro — con due sezioni corte adiacenti possono
         risultare attive entrambe, ed è corretto: lo sono davvero. */
      rootMargin: '-40% 0px -40% 0px',
    }
  );

  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}

export { showEverything };