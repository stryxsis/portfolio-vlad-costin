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
 *                           ⚠ NESSUN UTENTE al momento: l'unico era il filetto
 *                           di §01, passato a M14 perché lì deve far parte
 *                           dell'accensione e non precederla. Il codice resta
 *                           perché il vocabolario è valido e riusabile, ma non
 *                           aspettarsi effetti modificandolo finché nessuno lo
 *                           marca.
 *   M11b data-rail          filetto verticale della timeline (scrub)
 *   M14 data-activate       reveal ONE-SHOT via classi `is-in`/`is-on`/
 *                           `is-instant` (nessun tween qui: il CSS del
 *                           componente anima, questo modulo commuta soltanto).
 *                           Generico e riusabile su qualunque elemento — oggi
 *                           marca `.wid__clauses` (le due battute complete),
 *                           `.wid__title` (solo `is-in`, per lo squiggle),
 *                           `.sp__logos` (solo `is-in`, ingresso riga +
 *                           accensione loghi su touch) e `.ap` (solo `is-in`,
 *                           alone + accensione delle parole).
 *                           ⚠ Le due soglie sono FISSE (80% e 40%) e un
 *                           `data-on="NN"` per parametrizzare la seconda è
 *                           stato aggiunto e poi RIMOSSO nello stesso giorno
 *                           (2026-08-14). Serviva a far accendere prima le
 *                           parole di `.ap`, e non funzionava: avvicinando la
 *                           seconda soglia alla prima, le due battute si
 *                           sovrappongono invece di succedersi — 90px di
 *                           scroll si attraversano in una frazione di
 *                           secondo, mentre l'animazione che devono seguire
 *                           dura un secondo pieno. Quando due battute devono
 *                           stare in ORDINE, la leva è un ritardo nel CSS del
 *                           componente, non una soglia più vicina qui: vedi
 *                           `.ap__key` in Approach.astro. Se un giorno
 *                           riservisse davvero, il problema da risolvere è
 *                           quasi certamente un altro.
 *
 * ⚠ `data-activate` NON VA MAI COMBINATO CON `data-reveal` SULLO STESSO
 * ELEMENTO. Costato un bug reale, due volte: se condividono la soglia
 * d'ingresso (entrambi partono a `clamp(top 88%)`), il fade generico di M4
 * — che parte da opacità zero — copre l'istante in cui l'effetto di
 * `data-activate` succede, rendendolo invisibile o indistinguibile dal solito
 * ingresso di ogni altra sezione. Se un elemento marcato `data-activate` ha
 * bisogno anche di un ingresso "arriva da sotto e sfuma", quell'ingresso va
 * scritto come CSS ancorato a `.is-in` (vedi `.sp__logos` in
 * SocialProof.astro), non delegato a `data-reveal`.
 *
 * ⚠ E MAI GATARE UN'ANIMAZIONE SU `.is-active`. Quella classe (vedi
 * `initSectionState` più sotto) è lo stato "sto guardando questa sezione
 * ADESSO": la commuta un IntersectionObserver, ON quando la banda centrale la
 * contiene e OFF quando la si lascia — per design, perché serve a evidenziare
 * la sezione corrente nell'indice (`SectionIndex.astro`), che DEVE
 * risincronizzarsi ogni volta. Qualunque reveal agganciato a `.is-active`
 * invece si disfa e si ripete a ogni passaggio: è il difetto che ha reso
 * necessario `data-activate` (le sue classi si aggiungono e non si tolgono
 * mai).
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
    const cleanupsM14: Array<() => void> = [];

    /* ---- Perché un ingresso già visto tornava indietro (2026-08-08) --------
       Difetto segnalato da Vlad su `.wid__title` (M1) e su `.st__text` (M2):
       "appena torno su si bugga e ri parte l'animazione". Scorrendo verso
       l'alto sopra il titolo, le righe/parole tornavano di scatto nella posa
       di partenza (mascherate, `yPercent` pieno); ripassandoci sopra in
       discesa l'ingresso si rigiocava da capo.

       ⚠ NON È UN RE-SPLIT, e la prima diagnosi (l'evento `loadingdone` del
       FontFaceSet che fa risplittare gli elementi `autoSplit`) era SBAGLIATA:
       verificata via CDP con un MutationObserver sull'elemento durante tutta
       l'oscillazione, ZERO ristrutturazioni del DOM — mentre il transform
       della parola tornava esattamente al valore `from` (`translate(0%,
       105%)`). Quindi non è il DOM a essere ricostruito: è il PLAYHEAD del
       tween a essere riportato a zero.

       ⚠ LA CAUSA VERA È CHE `once: true` NON BASTA A FAR MORIRE IL TRIGGER.
       `once` uccide lo ScrollTrigger quando si raggiunge la sua posizione di
       FINE, non quando l'animazione finisce — e il default di `end` è `bottom
       top`, cioè "il fondo del titolo ha superato il bordo alto della
       viewport". Questi titoli vivono dentro un handoff sticky (M12): il loro
       schermo resta incollato, quindi quel fondo può non superare mai davvero
       il bordo alto, e il trigger resta VIVO a tempo indeterminato. Finché è
       vivo, riportarsi con lo scroll prima del suo `start` rirende il tween a
       progress 0 — che per un `gsap.from()` è la posa nascosta.

       Il fix è quindi togliere di mezzo il trigger appena l'ingresso è
       finito, invece di sperare che si tolga da solo: `finishEntrance()`
       uccide lo ScrollTrigger E ripulisce il transform inline, così non resta
       in giro NIENTE che possa riportare indietro l'elemento. È la stessa
       regola già valida per M14 (`data-activate`, classi additive che non si
       tolgono mai): un'animazione one-shot, una volta giocata, non deve avere
       nessuna strada per tornare allo stato di partenza.

       `splitPlayed` resta, e copre il caso RESTANTE e diverso: un re-split
       vero (un resize di finestra vero rispezza le righe, ed è il motivo per
       cui `autoSplit` serve). Senza, quel re-split ricostruirebbe un
       `gsap.from` nuovo su un titolo già entrato. Marca l'elemento ORIGINALE,
       che il re-split non ricrea. */
    const splitPlayed = new WeakSet<Element>();

    const finishEntrance = (el: Element, tween: gsap.core.Tween, targets: Element[]): void => {
      splitPlayed.add(el);
      tween.scrollTrigger?.kill();
      // Via anche il transform inline: lo stato finale è la posizione naturale
      // dentro il wrapper mascherato, non un valore da mantenere scritto.
      gsap.set(targets, { clearProps: 'transform' });
    };

    /* ---- RETE DI SICUREZZA PER M1/M2, e copre un difetto LIVE -------------
       ⚠ Trovato il 2026-08-11 su `/chi-sono`: la bio del sito (`.ab__lede`,
       cinque righe, il testo canonico) era **invisibile in modo permanente**.
       Non "entrava in ritardo": non entrava mai, a nessuna posizione di
       scroll. Misurato via CDP: i cinque frammenti fermi a
       `translate(0%, 110%)` dentro i loro wrapper mascherati.

       ⚠ LA CAUSA È `once: true`, ED ERA GIÀ DOCUMENTATA IN QUESTO FILE — per
       M4, non per M1/M2. La nota di M4 poco più sotto lo dice per esteso: con
       `once` un trigger che si trova start (ed end) GIÀ SUPERATI in un solo
       update viene reclamato da ScrollTrigger prima di aver giocato, e
       l'elemento resta nello stato di partenza per sempre. M4 ha imparato la
       lezione e tiene la contabilità a mano; M1 e M2 sono rimasti con `once`.
       Si vede solo quando un elemento splittato nasce SOPRA la propria soglia
       (`top 82%`), cioè sopra la piega — che sulla Home non capita mai (lì i
       titoli splittati stanno tutti più in basso, e sopra la piega non si
       splitta per la regola LCP), ma capita su ogni pagina interna che apra
       con un titolo e una lede.

       Il rimedio è quello che questo file già applica due volte (`sweepPassed`
       per M4, `settle` per M14): un controllo di STATO invece che di evento.
       L'invariante è la stessa scritta più sotto: quando lo scorrimento è
       fermo, niente che sia in vista può essere ancora nascosto. */
    const splitTweens = new Map<Element, { tween: gsap.core.Tween; finisci: () => void }>();

    const settleSplits = (): void => {
      if (splitTweens.size === 0) return;
      const soglia = window.innerHeight * 0.82;
      for (const [el, { tween, finisci }] of splitTweens) {
        if (splitPlayed.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0) {
          /* Già scorso via sopra: stato finale SENZA animare — un ingresso di
             cui nessuno ha visto l'inizio non è un'animazione, è un ritardo.
             `progress(1)` non fa scattare `onComplete`, quindi la chiusura va
             chiamata a mano o resterebbe vivo il trigger che questa stessa
             sessione ha appena imparato a uccidere. */
          tween.progress(1);
          finisci();
        } else if (r.top < soglia) {
          // In vista e oltre la soglia: deve giocare adesso, non "quando entra"
          // — è già entrato.
          tween.play();
        }
      }
    };

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
            // Re-split dopo che l'ingresso è già stato visto: stato finale
            // diretto, nessun nuovo ScrollTrigger da far scattare una seconda
            // volta — vedi la nota su `splitPlayed` qui sopra.
            if (splitPlayed.has(el)) {
              gsap.set(self.lines, { yPercent: 0 });
              return;
            }
            const tween: gsap.core.Tween = gsap.from(self.lines, {
              yPercent: 110,
              duration: 0.9,
              stagger: 0.08,
              ease: 'power3.out',
              onComplete: () => finishEntrance(el, tween, self.lines),
              scrollTrigger: {
                trigger: el,
                // clamp() evita il salto quando il trigger è già oltre lo start
                // al primo paint.
                start: 'clamp(top 82%)',
                /* ⚠ NIENTE `once: true` — c'era, e rendeva la bio di
                   `/chi-sono` invisibile per sempre (vedi la nota su
                   `settleSplits` sopra). Non serve nemmeno più: `finishEntrance`
                   uccide il trigger appena l'ingresso è finito, che è il
                   momento giusto — `once` invece lo uccide al raggiungimento
                   della FINE, che può arrivare prima che abbia giocato. */
                fastScrollEnd: true,
              },
            });
            splitTweens.set(el, { tween, finisci: () => finishEntrance(el, tween, self.lines) });
            return tween;
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
            // Stessa rete di `splitPlayed` di M1 qui sopra: un re-split dopo
            // l'ingresso già visto va dritto allo stato finale.
            if (splitPlayed.has(el)) {
              gsap.set(self.words, { yPercent: 0 });
              return;
            }
            const tween: gsap.core.Tween = gsap.from(self.words, {
              yPercent: 105,
              duration: 0.7,
              stagger: 0.035,
              ease: 'expo.out',
              onComplete: () => finishEntrance(el, tween, self.words),
              // Niente `once`, stessa ragione di M1 qui sopra.
              scrollTrigger: { trigger: el, start: 'clamp(top 80%)', fastScrollEnd: true },
            });
            splitTweens.set(el, { tween, finisci: () => finishEntrance(el, tween, self.words) });
            return tween;
          },
        })
      );
    });

    /* M15 — split STRUTTURALE per carattere, e NIENT'ALTRO.
       A differenza di M1/M2 qui SplitText non attacca nessun tween: produce solo
       i wrapper, uno <span class="sp__letter"> per lettera. L'accensione la fa il
       CSS del componente, gated su `data-activate`/`is-in` dell'antenato — stessa
       filosofia di M14, riusata invece di duplicata.

       ⚠ `--i` È UN INDICE GLOBALE, NON LOCALE ALLA PAROLA. SplitText spacca ogni
       elemento separatamente, quindi senza coordinamento la cascata ripartirebbe
       da zero ad ogni parola e il riflesso si vedrebbe attraversare il titolo
       tre volte invece di una. `data-i-offset` — calcolato a mano sul testo
       statico, che non cambia — dice da dove continuare il conteggio. */
    document.querySelectorAll<HTMLElement>('[data-split="chars"]').forEach((el) => {
      const offset = Number(el.dataset.iOffset ?? 0);
      splits.push(
        SplitText.create(el, {
          type: 'chars',
          autoSplit: true,
          aria: 'none', // vedi la nota su aria-prohibited-attr sopra
          charsClass: 'sp__letter',
          onSplit(self) {
            self.chars.forEach((c, i) => {
              (c as HTMLElement).style.setProperty('--i', String(offset + i));
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

    /* La rete di M1/M2 (vedi `settleSplits` in cima). Stessi due agganci di
       `sweepPassed` qui sopra e per le stesse ragioni: il `refresh` copre il
       primo layout e ogni ricalcolo (resize, font arrivati, re-split), lo
       `scrollEnd` copre l'arrivo in una posizione qualunque senza eventi di
       ingresso. La chiamata diretta copre il caso in cui nessuno dei due
       arrivi mai — che è esattamente ciò che succedeva su `/chi-sono`. */
    ScrollTrigger.addEventListener('refresh', settleSplits);
    ScrollTrigger.addEventListener('scrollEnd', settleSplits);
    settleSplits();

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

    /* M14 — L'ACCENSIONE, in due battute.
       Questo modulo NON anima nulla: commuta due classi e lascia le transizioni
       al CSS del componente. È deliberato — la cascata fra le tre righe è fatta
       con `transition-delay` su `nth-child`, quindi non costa un tween per
       elemento, e i valori di "spento" restano leggibili accanto a quelli di
       "acceso" nel foglio di stile invece di essere sepolti in un oggetto JS.

       ⚠ PERCHÉ DUE SOGLIE E NON UN `delay` DI UN SECONDO.
       La richiesta iniziale era: entra, aspetta ~1s, poi si accende. Un timer
       fisso ha due difetti opposti e nessuno dei due è recuperabile. Con tre
       righe in cascata l'ultima finirebbe ~2,4s dopo l'ingresso, e chi scorre a
       velocità normale attraversa questo blocco in meno di due: sarebbe già
       oltre. Chi invece si ferma a leggere non ha nessun bisogno di aspettare.
       Qui l'attesa la produce la DISTANZA DI SCROLL fra le due soglie.

       ⚠ 80% → 40%, NON 80% → 65%. La prima versione usava 65%, cioè ~200px a
       900px di viewport — una distanza che un singolo respiro di rotellina o
       un flick di trackpad attraversa in una frazione di secondo, quindi le
       due battute arrivavano quasi insieme e la pausa non si sentiva mai. A
       40% la distanza sale a ~430px: serve un gesto di scroll reale per
       attraversarla, non un tick. Chi va piano ha la pausa, chi scorre in
       fretta comunque non resta indietro perché la seconda battuta non
       dipende dal tempo, dipende da dove si trova lo sguardo.

       ⚠ E PERCHÉ "SPENTO" NON È MAI INVISIBILE NÉ SFOCATO A LUNGO.
       `is-in` (arrivo, 80%) porta la riga a fuoco e la lascia NITIDA e
       leggibile, solo cromaticamente inerte. `is-on` (accensione, 40%) fa
       arrivare l'accento. Tenere il testo a `opacity: 0` — o sotto un blur —
       per tutta la pausa violerebbe l'invariante che tiene in piedi
       `sweepPassed` qui sotto: quando lo scroll è fermo, niente che sia in
       vista può essere ancora illeggibile. Con questa divisione la pausa non
       trattiene informazione, trattiene solo colore.

       ⚠ SUL PERCHÉ IL PRIMO TENTATIVO NON SI VEDEVA AFFATTO, non solo si
       vedeva poco: il contenitore portava ANCHE `data-reveal`, quindi M4 lo
       faceva entrare con il suo fade + risalita generico — lo stesso di ogni
       altra sezione — proprio alla soglia `is-in`. Quel fade copriva l'intero
       effetto: il blocco appariva già "fatto" con il solito ingresso standard,
       e ciò che succedeva sotto (righe a fuoco, poi accensione) non aveva mai
       la possibilità di leggersi come qualcosa di diverso. `data-activate` ha
       la sua rete di sicurezza completa qui sotto (`is-instant` + i due
       ascoltatori): non deve MAI portare anche `data-reveal`, o il fade
       generico torna a nascondere tutto da capo. */
    const activatable = Array.from(document.querySelectorAll<HTMLElement>('[data-activate]'));

    if (activatable.length > 0) {
      /* Controllo di STATO, non di evento, per gli stessi scenari di
         `sweepPassed`: salto d'ancora, tasto Fine, ripristino della posizione
         al reload. Se il blocco è già oltre una soglia, la classe va messa
         comunque — non ci sarà nessun ingresso futuro da osservare.
         `is-instant` azzera durate e ritardi quando il blocco è già USCITO
         sopra la viewport: un'accensione di cui nessuno ha visto l'inizio non
         è un'animazione, è solo un ritardo (stessa regola del ramo `onLeave`). */
      const settle = (): void => {
        for (const el of activatable) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0) el.classList.add('is-instant', 'is-in', 'is-on');
          if (r.top < window.innerHeight * 0.8) el.classList.add('is-in');
          if (r.top < window.innerHeight * 0.4) el.classList.add('is-on');
        }
      };

      /* I trigger coprono il caso vivo (il blocco che entra mentre si scorre),
         che `settle` da solo non prenderebbe: `scrollEnd` scatta quando lo
         scroll si FERMA, e aspettare quello vorrebbe dire vedere il blocco
         acceso solo dopo essersi fermati. Nessun `once`: la classe è additiva e
         idempotente, quindi ri-applicarla non costa nulla ed è più robusto che
         far reclamare il trigger a ScrollTrigger (vedi il commento su `once` in
         M4 qui sopra).

         ⚠ `onLeave` NON È RIDONDANTE CON `settle`, ed è il caso che questa
         funzione ha sbagliato alla prima scrittura. Il ragionamento sbagliato
         era: "il salto lo prende `settle` su scrollEnd". Verificato via CDP, no:
         dopo un salto programmatico di posizione — che è ciò che fanno un link
         ancora, il tasto Fine e il ripristino dello scroll al reload — quello
         scroll litiga con l'interpolazione di Lenis e `scrollEnd` non arriva,
         quindi `settle` non gira e il blocco resta spento E SFOCATO per sempre.
         Con `JUMP=bottom` le righe erano ancora a `scale 0.96` e `blur(5px)`,
         cioè contenuto illeggibile in modo permanente: lo stesso difetto che il
         batch di M4 copre con la sua terza callback. Servono tutte e tre. */
      for (const el of activatable) {
        const turnOn = (cls: string) => () => el.classList.add(cls);
        /* Il blocco è stato attraversato in un colpo: stato finale SENZA
           animazione. `is-instant` azzera durate e ritardi — un'accensione di
           cui nessuno ha visto l'inizio non è un'animazione, è solo un ritardo.
           Non viene rimossa tornando su: M4 non ripete i suoi reveal (li
           contabilizza in una WeakSet), e questo si comporta allo stesso modo. */
        const skipToEnd = (): void => {
          el.classList.add('is-instant', 'is-in', 'is-on');
        };
        ScrollTrigger.create({
          trigger: el,
          start: 'clamp(top 80%)',
          onEnter: turnOn('is-in'),
          onEnterBack: turnOn('is-in'),
          onLeave: skipToEnd,
        });
        ScrollTrigger.create({
          trigger: el,
          start: 'clamp(top 40%)',
          onEnter: turnOn('is-on'),
          onEnterBack: turnOn('is-on'),
          onLeave: skipToEnd,
        });
      }

      /* ⚠ E QUI SERVE UN ASCOLTATORE DI `scroll` VERO, non gli eventi di
         ScrollTrigger, e la ragione è misurata — non prudenza.
         Con un salto al FONDO ASSOLUTO del documento (`window.scrollTo(0,
         scrollHeight)`, cioè tasto Fine o ripristino della posizione al reload
         in fondo) non arriva NIENTE: né `refresh`, né `scrollEnd`, né `onLeave`
         dei trigger qui sopra. Verificato via CDP: a scrollY 8701 il blocco
         restava a `scale 0.96` e `blur(5px)` indefinitamente, e bastava un
         nudge di rotellina da 40px perché `onLeave` scattasse e risolvesse
         tutto — cioè la logica era giusta e la SORGENTE degli eventi sbagliata.
         Motivo: quello scroll è programmatico e clampato al massimo, quindi
         Lenis non lo interpola e l'update interno di ScrollTrigger non gira.
         L'evento `scroll` del DOM invece è garantito dalle specifiche per
         qualunque `scrollTo`, ed è per questo che la rete finale si aggancia
         lì.

         Il costo è una `getBoundingClientRect` per blocco marcato (sulla Home
         ce n'è esattamente uno) per evento, e SI STACCA DA SOLO appena tutto è
         acceso — dopodiché non resta nessun ascoltatore attivo. Stesso schema
         di auto-rimozione di `sweepPassed`. */
      const settleOnScroll = (): void => {
        settle();
        if (activatable.every((el) => el.classList.contains('is-on'))) {
          window.removeEventListener('scroll', settleOnScroll);
        }
      };

      ScrollTrigger.addEventListener('refresh', settle);
      window.addEventListener('scroll', settleOnScroll, { passive: true });
      settle();

      cleanupsM14.push(() => {
        ScrollTrigger.removeEventListener('refresh', settle);
        window.removeEventListener('scroll', settleOnScroll);
      });
    }

    return () => {
      ScrollTrigger.removeEventListener('refresh', sweepPassed);
      ScrollTrigger.removeEventListener('scrollEnd', sweepPassed);
      cleanupsM14.forEach((fn) => fn());
      cleanupsM14.length = 0;
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
  if (sections.length === 0 || !('IntersectionObserver' in window)) return () => { };

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
