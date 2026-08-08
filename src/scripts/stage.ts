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
 *   M16  [data-stack] + [data-stack-card] il mazzo di card che si accatasta, §30
 *   M17  [data-reel] / [data-call]        ciò che accade DENTRO una card, §30
 *   M6   [data-drift]                     micro-deriva orizzontale in scrub
 *
 * M9 ([data-plates]/[data-plate], i "piatti" che si scambiavano uno alla volta
 * in §30) NON ESISTE PIÙ: sostituito da M16, che tiene tutte le card in scena e
 * le fa sovrapporre invece di alternarle. Nessun file lo usa più.
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

    /* ---- M16 — il mazzo di §30 -------------------------------------------
       SOSTITUISCE M9 (i "piatti"). Prima le tre card erano alternative: una
       visibile alla volta, dissolvenza CSS fra l'una e l'altra, e `onUpdate`
       che commutava una classe solo al cambio di indice. Era un carosello —
       niente si sovrapponeva a niente. Ora restano tutte in scena e salgono da
       sotto accatastandosi, che è l'effetto richiesto.

       UNA TIMELINE IN SCRUB, e qui lo scrub è obbligato, non una scelta di
       costo. Con M9 si poteva commutare una classe e lasciare la dissolvenza al
       CSS perché il cambio era DISCRETO (piatto 1, poi 2, poi 3). Una card che
       scivola su un'altra è invece un movimento CONTINUO legato alla posizione
       dello scroll: l'unico modo di lasciarlo al CSS sarebbe far scattare
       transizioni a soglie, cioè trasformare uno scorrimento in tre scatti.

       IL TRIGGER È IL GENITORE DELLO SCHERMO, non lo schermo stesso: lo schermo
       è sticky, quindi la sua posizione misurata resta ferma in cima mentre si
       scorre e come riferimento non direbbe nulla. Il genitore è l'elemento che
       sta FERMO nel flusso. La corsa è il distanziatore dichiarato dal Handoff,
       riletto a ogni refresh perché è in svh. Identico a M9 su questo punto.

       LO STATO INIZIALE LO SCRIVE `gsap.set`, NON IL CSS: il parcheggio delle
       card in attesa è un `transform`, e in CSS sarebbe una proprietà
       `translate` che GSAP poi ricompilerebbe dentro la propria matrice,
       applicandola due volte (divieto in CLAUDE.md). È anche il motivo per cui
       le card partono a `opacity: 0` in CSS: `gsap.set` le accende nello stesso
       istante in cui le posiziona, così non esiste un fotogramma con le tre
       card sovrapposte a pila ferma. */
    document.querySelectorAll<HTMLElement>('[data-stack]').forEach((stageEl) => {
      const name = stageEl.dataset.stack;
      const cards = Array.from(stageEl.querySelectorAll<HTMLElement>('[data-stack-card]'));
      /* ⚠ ERA `if (cards.length < 2) return`, e NON era la degradazione gentile
         che il suo commento dichiarava ("con una card sola resta l'elenco
         statico"). L'elenco statico è il ramo SENZA `html.js-anim`; qui dentro
         le card partono a `opacity: 0` in CSS e ad accenderle è il `gsap.set`
         una ventina di righe più sotto. Uscire prima lo saltava, quindi la
         sezione restava un rettangolo NERO E VUOTO — misurato via CDP con un
         solo progetto in vetrina: `.fp__card` a `opacity: 0`, `transform: none`.
         Con una card non c'è un mazzo, ma c'è ancora una card da mostrare e un
         reel da far scorrere: si degrada, non si esce. */
      if (!cards.length) return;
      /* Una card sola: niente scalini, niente parcheggio, niente rientri — e
         tutta la corsa disponibile al reel di quell'unica card. È il caso vero
         ogni volta che i progetti in vetrina scendono a uno, non un'ipotesi. */
      const solo = cards.length === 1;

      const screen = document.querySelector<HTMLElement>(`[data-screen="${name}"]`);
      const travel = document.querySelector<HTMLElement>(`[data-travel="${name}"]`);
      const trigger = screen?.parentElement ?? stageEl;

      /* Quanto in basso si posa ogni card rispetto alla precedente, in % della
         propria altezza. È ciò che lascia visibile la striscia superiore delle
         card sepolte: senza, ognuna coprirebbe l'altra al pixel e il mazzo non
         si vedrebbe. Il 4% di margine libero in CSS (`height: 96%`) è calcolato
         su questo: STEP × (card - 1) = 4 con tre card. */
      const STEP = 2;
      /* Quanto rientra una card per OGNI card che le sale sopra. Cumulativo, non
         assoluto: con tre card la prima finisce a 0.94, la seconda a 0.97. È il
         DIVARIO fra le scale a far leggere una card come "più indietro" — un
         valore unico per tutte darebbe strisce identiche, cioè zero profondità. */
      const RECEDE = 0.03;
      /* Dove aspettano il turno le card non ancora entrate, in % della PROPRIA
         altezza. ⚠ 100 NON BASTA, ed è un errore facile: la card è più BASSA del
         contenitore (i punti percentuali liberi servono agli scalini), quindi
         tradurla del 100% della propria altezza non la porta fuori dal
         contenitore — le restava un dito di card visibile in fondo. Misurato:
         29px su uno stack di 725.
         ⚠ ERA `108` INCHIODATO. Con tre card serve 100/0.96 ≈ 104.2 e 108
         bastava, ma il margine finiva alla QUINTA card (altezza 92% → serve
         108.7): un numero magico che si rompe in silenzio appena l'array dei
         progetti cresce. Ora si misura la geometria reale — stessa filosofia
         degli assert di verify-stage, che verificano l'invariante e non il
         valore. Il +2 è il margine, l'unico numero rimasto. */
      const holder = cards[0]?.parentElement ?? stageEl;
      const cardH = cards[0]?.offsetHeight ?? 0;
      const PARK = cardH > 0 ? (holder.clientHeight / cardH) * 100 + 2 : 108;

      gsap.set(cards, { transformOrigin: 'center top', opacity: 1 });
      cards.forEach((c, i) => gsap.set(c, { yPercent: i === 0 ? 0 : PARK, scale: 1 }));

      /* Gli elementi di M17 vivono DENTRO le card, ma il loro `will-change` e il
         loro progresso li governa questa stessa corsa: raccolti qui per non
         interrogare il DOM in un callback che gira a ogni frame. */
      const reels = Array.from(stageEl.querySelectorAll<HTMLElement>('[data-reel]'));
      /* Il gancio del trascritto. Assegnato più in basso, quando la durata
         totale della timeline è nota: la soglia è una FRAZIONE di quella durata
         e non si può calcolare prima di aver costruito tutti i tween. */
      let onProgress: ((progress: number) => void) | null = null;

      const tl = gsap.timeline({
        // `none` obbligatorio in scrub: un easing sopra una posizione già
        // guidata dallo scroll fa sembrare l'elemento in ritardo sul dito.
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: {
          trigger,
          start: 'top top',
          end: () => `+=${travel?.offsetHeight ?? window.innerHeight * 2}`,
          scrub: true,
          invalidateOnRefresh: true,
          // `will-change` acceso solo per la durata della corsa: costante su tre
          // strati a schermo pieno costerebbe memoria di compositing per tutta
          // la vita della pagina, per guadagnare un frame una volta sola.
          onToggle: (self) => {
            [...cards, ...reels].forEach((c) => {
              c.style.willChange = self.isActive ? 'transform' : '';
            });
          },
          // Il trascritto di M17 si accende su una SOGLIA di progresso, non su un
          // tween: `onUpdate` in scrub e `onRefresh` per il caso in cui la
          // pagina nasca già oltre la soglia (ricarica a scroll ripristinato).
          onUpdate: (self) => onProgress?.(self.progress),
          onRefresh: (self) => onProgress?.(self.progress),
        },
      });

      /* I numeri sono FRAZIONI della corsa, non secondi: con lo scrub GSAP mappa
         il progresso 0..1 sulla durata totale della timeline, quindi contano
         solo le proporzioni fra loro.
         LEAD è il respiro iniziale in cui la prima card sta sola in scena —
         senza, la seconda inizierebbe a salire nell'istante esatto in cui lo
         schermo si incolla, e la prima non si vedrebbe mai per intero.
         ⚠ ERA 0.12, poi 0.2, poi 0.32: ogni volta non bastava (tre richiami
         espliciti). Ora 0.45, insieme a `travel` 440svh in index.astro. I due
         valori vanno alzati IN COPPIA: da solo un LEAD più alto sposta la
         proporzione fra le fasi ma non i pixel reali di scroll, perché la corsa
         totale è la stessa. In pixel, con viewport 900:
             scoperto = LEAD × (travel_px − 1 schermo) / (0.89 + 0.11 × LEAD)
         cioè 810px con 0.32/360svh e 1466px con 0.45/440svh — da 0.9 a 1.6
         schermi di rotellina in cui la prima card sta sola in scena. */
      /* ⚠ Con UNA card `LEAD` non ha più niente da proteggere: esiste per dare
         alla prima card un tratto in cui sta sola in scena PRIMA che la seconda
         salga, e senza seconda card quel tratto è tutta la corsa. A 0.45 avrebbe
         solo tagliato fuori il 45% della corsa dal reel, cioè l'opposto di quel
         che serve. */
      const LEAD = solo ? 0 : 0.45;
      /* ⚠ `solo ? 1 : ...` non è una precauzione teorica: con una card sola il
         divisore è `cards.length - 1`, cioè 0, e `span` diventerebbe `Infinity`.
         Oggi non se ne accorgerebbe nessuno (il ciclo delle salite qui sotto è
         vuoto e `inFocus(0)` non lo tocca), ed è esattamente il motivo per cui
         va chiuso adesso: un Infinity che gira per la funzione è un difetto che
         aspetta il prossimo che ci scrive dentro. */
      const span = solo ? 1 : (1 - LEAD) / (cards.length - 1);
      const dur = span * 0.78; // il resto è la pausa fra un arrivo e il successivo

      // `slice(1).forEach` invece di un `for` con indice: sotto `strictest`
      // (`noUncheckedIndexedAccess`) `cards[i]` è `HTMLElement | undefined`, e
      // l'iterazione dà l'elemento già ristretto senza un `!` non necessario.
      cards.slice(1).forEach((card, k) => {
        const i = k + 1; // indice reale nel mazzo
        const at = LEAD + k * span;
        tl.to(card, { yPercent: i * STEP, duration: dur }, at);
        // Tutte le card già arrivate rientrano di un altro scalino, nello
        // stesso istante in cui questa comincia a salire.
        cards.slice(0, i).forEach((below, j) => {
          tl.to(below, { scale: 1 - (i - j) * RECEDE, duration: dur }, at);
        });
      });

      /* ⚠ Con una card sola il ciclo qui sopra non aggiunge NESSUN tween, quindi
         la timeline nascerebbe a durata 0 — e tutto ciò che sotto è espresso come
         frazione di `tl.duration()` (la coda ferma, `total`, la finestra del
         reel, la soglia del trascritto) diventerebbe 0 o 0/0. Un tween vuoto le
         dà la corsa. L'1 non è un numero magico: con lo scrub GSAP mappa il
         progresso 0..1 sulla durata totale, quindi conta solo la PROPORZIONE fra
         i tween, ed è la stessa unità in cui sono già espressi LEAD e span. */
      if (solo) tl.to({}, { duration: 1 });

      /* ---- La coda ferma: uno schermo di scroll che non muove niente --------
         Un tween vuoto in fondo alla timeline. Non anima nulla: OCCUPA TEMPO, e
         con lo scrub il tempo è distanza di scroll. Il risultato è che dopo
         l'arrivo dell'ultima card serve ancora uno schermo intero di rotellina
         prima che la sezione si sblocchi, e in quello schermo il mazzo composto
         sta fermo a farsi guardare. Prima l'ultima card si posava nell'istante
         esatto in cui lo Statement iniziava a coprire: il mazzo finito non si
         vedeva mai.

         ⚠ LO SPAZIO PER QUESTA CODA NON LO CREA QUESTO TWEEN, lo crea il
         distanziatore del Handoff (`travel={320}` in index.astro, era 220). Lo
         sticky di `.ho__out` dura quanto quel distanziatore; qui si decide solo
         COME la corsa disponibile viene spesa. Aggiungere il tween senza
         allungare il distanziatore avrebbe compresso l'animazione nella stessa
         distanza di prima, senza nessuna pausa; allungare `end` senza allungare
         il distanziatore avrebbe fatto proseguire l'animazione oltre la fine
         dello sticky, con le card ancora in movimento mentre venivano coperte.

         La durata è PROPORZIONALE e misurata, non un numero a caso: si riserva
         alla coda esattamente uno schermo della corsa reale letta dal DOM. Se
         domani `travel` cambia, la proporzione si riadatta da sé — nessun valore
         duplicato fra questo file e index.astro. */
      const runPx = travel?.offsetHeight ?? window.innerHeight * 2;
      const holdPx = window.innerHeight;
      const animPx = Math.max(1, runPx - holdPx);
      tl.to({}, { duration: tl.duration() * (holdPx / animPx) });

      /* ---- M17 — LA VETRINA: ciò che accade dentro una card ----------------
         La card è il contenitore, non il contenuto. Ogni card ha una FINESTRA:
         il tratto di corsa in cui è quella in cima al mazzo. Dentro quella
         finestra la sua vetrina "suona".

         Le due vetrine usano meccanismi DIVERSI, e non è un'incoerenza:

           reel di un sito → SCRUB. La posizione della pagina dentro lo schermo
             è una posizione: legarla al dito è esatto, e tornando indietro la
             pagina risale, che è quello che una pagina fa.
           trascritto di una chiamata → UNA VOLTA SOLA, a tempo. Scrubbare una
             conversazione significa che risalendo la pagina si DIS-DICE: le
             parole rientrano, l'appuntamento si annulla. È inquietante e non
             c'è modo di renderlo bello. Una conversazione è una sequenza, non
             una posizione.

         Costo: zero ScrollTrigger nuovi (i reel sono tween sulla timeline che
         esiste già) e zero tween per il trascritto, che è tutto CSS. */
      const total = tl.duration();

      /* Quando la card `i` è a fuoco: da poco dopo il suo arrivo (il 70% della
         salita — prima è ancora mezza fuori schermo e la sua vetrina non si
         vedrebbe) a quando quella dopo l'ha coperta. L'ultima tiene la scena
         fino in fondo, coda ferma compresa.

         ⚠ LA PRIMA CARD CHIUDE A `LEAD`, NON A `LEAD + dur`, e questa è metà
         della risposta al "non riesco a scorrere abbastanza il sito". Le altre
         card continuano a scorrere il proprio reel anche MENTRE vengono coperte
         (finestra fino a `+dur`), che per loro va bene: hanno una pausa scoperta
         brevissima e senza quel sovrappiù il reel sarebbe troppo veloce. La
         prima card invece ha tutto `LEAD` per sé, ed estendere la finestra oltre
         l'inizio della copertura significava spalmare la corsa del reel su un
         tratto in parte già occluso: misurato, il reel arrivava al 55% della
         propria pagina nell'istante in cui la seconda card cominciava a salire,
         quindi il fondo del sito del Network Day NON SI VEDEVA MAI. Chiudendo a
         `LEAD` la pagina percorre il 100% di sé stessa mentre è ancora
         completamente scoperta, che è la cosa che si stava chiedendo. */
      const inFocus = (i: number): [number, number] => [
        i === 0 ? 0 : LEAD + (i - 1) * span + dur * 0.7,
        i === cards.length - 1 ? total : i === 0 ? LEAD : LEAD + i * span + dur,
      ];

      cards.forEach((card, i) => {
        const [from, to] = inFocus(i);

        card.querySelectorAll<HTMLElement>('[data-reel]').forEach((reel) => {
          const window_ = reel.parentElement;
          if (!window_) return;
          /* La corsa la dà la GEOMETRIA REALE, non un valore dichiarato: il reel
             è alto una percentuale dello schermo scritta in CSS, e leggerla qui
             la duplicherebbe. Funzione + `invalidateOnRefresh` = si rimisura al
             resize, e continuerà a funzionare quando i wireframe diventeranno
             screenshot veri con proporzioni tutte diverse. */
          tl.to(
            reel,
            {
              y: () => -Math.max(0, reel.offsetHeight - window_.clientHeight),
              duration: Math.max(0.01, to - from),
            },
            from
          );
        });
      });

      /* Il trascritto. La soglia è l'85% della salita della sua card: la prima
         battuta parte mentre la card sta ancora arrivando, così alla fine della
         salita la conversazione è già in corso invece di iniziare da ferma.
         ⚠ NON si usa `data-activate` (M14): la sua soglia è `top 80%` della
         SEZIONE, che qui scatta molto prima — la sezione entra in viewport un
         intero schermo prima che questa card sia in cima al mazzo. */
      const call = stageEl.querySelector<HTMLElement>('[data-call]');
      if (call && total > 0) {
        const owner = call.closest<HTMLElement>('[data-stack-card]');
        const idx = owner ? cards.indexOf(owner) : cards.length - 1;
        /* ⚠ La PRIMA card non ha una salita di cui prendere l'85%: è già in scena
           quando lo schermo si incolla. Con `0` netto la soglia risultava
           superata al primo frame, quindi `seenBefore` restava falso e il
           trascritto scattava dritto a `is-instant` — completo, senza mai
           animare. Finora non si vedeva perché la chiamata è l'ULTIMA delle tre
           card; con un solo progetto in vetrina, o con la chiamata spostata in
           testa, diventa l'unico comportamento visibile. Una frazione piccola ma
           POSITIVA della corsa le dà lo stesso "parte mentre stai già guardando"
           che ha in fondo al mazzo. */
        const callAt = (idx <= 0 ? total * 0.06 : LEAD + (idx - 1) * span + dur * 0.85) / total;

        /* `seenBefore` distingue "ci sono arrivato scorrendo" da "ci sono nato
           dentro". Nel secondo caso l'animazione è già stata persa, quindi si
           salta allo stato finale: è `is-instant` di M14, stessa logica.
           Le classi si AGGIUNGONO e non si toglieranno mai — è ciò che rende
           innocuo il fatto che questo callback giri a ogni frame e anche
           risalendo. */
        let seenBefore = false;
        onProgress = (progress) => {
          if (call.classList.contains('is-in')) return;
          if (progress < callAt) {
            seenBefore = true;
            return;
          }
          if (!seenBefore) call.classList.add('is-instant');
          call.classList.add('is-in');
        };
        // Sincronizzazione immediata: se la pagina è nata già oltre la soglia,
        // `onRefresh` potrebbe non arrivare mai (misurato su M14: un salto
        // programmatico non emette né refresh né scrollEnd).
        onProgress(tl.scrollTrigger?.progress ?? 0);
      }

      cleanups.push(() => {
        [...cards, ...reels].forEach((c) => {
          c.style.willChange = '';
        });
        gsap.set(cards, { clearProps: 'transform,transformOrigin,opacity' });
        if (reels.length) gsap.set(reels, { clearProps: 'transform' });
        call?.classList.remove('is-in', 'is-instant');
      });
    });

    /* ---- Deriva orizzontale in scrub (M6) -------------------------------
       Nata come MICRO-deriva: 2.5% verso sinistra lungo tutta la sezione, da non
       notare, solo per togliere l'impressione che un blocco sia incollato alla
       pagina. Negativa di proposito: verso destra creerebbe overflow.

       ⚠ L'AMPIEZZA ORA ARRIVA DAL MARKUP (`data-drift="-9"`), con -2.5 come
       default. Serviva per la parola-fantasma del manifesto §04, che è un piano
       di sfondo e deve derivare abbastanza da leggersi come parallasse: a 2.5%
       il movimento c'era ma non produceva profondità. Un secondo vocabolario
       sarebbe stato lo stesso meccanismo con un altro nome — e questo non aveva
       comunque nessun utente nel markup (come M11, vedi CLAUDE.md), quindi
       parametrizzarlo non ha potuto rompere niente.

       Il valore è una PERCENTUALE della larghezza dell'elemento, non pixel: un
       fantasma tipografico scala col viewport, e la sua deriva deve scalare con
       lui o a 390px sarebbe uno strappo e a 2560 un fremito. */
    document.querySelectorAll<HTMLElement>('[data-drift]').forEach((el) => {
      const raw = Number(el.dataset.drift);
      const to = Number.isFinite(raw) && raw !== 0 ? raw : -2.5;

      gsap.fromTo(
        el,
        { xPercent: 0 },
        {
          xPercent: to,
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