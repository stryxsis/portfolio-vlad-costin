/**
 * Il cambio di progetto fra case study: due ritocchi a una navigazione che
 * funziona già da sola.
 *
 * Il cambio È una navigazione normale (vedi CaseStudyLayout). Questo modulo
 * non intercetta nessun link, non chiama `preventDefault`, non tiene stato:
 * se non girasse, i link porterebbero comunque alla pagina giusta e la View
 * Transition farebbe una dissolvenza. Fa due cose soltanto:
 *
 *  1. LA CARD CHE DIVENTA LA SCENA. Al momento del passaggio (`pageswap`,
 *     l'ultimo istante della pagina vecchia) il nome `cs-visual` si sposta
 *     dallo schermo del progetto uscente alla MINIATURA della destinazione:
 *     la View Transition la vede allora come lo stesso oggetto dello schermo
 *     della pagina nuova e la fa volare dalla striscia al palco.
 *     ⚠ Solo se la miniatura è davvero IN VISTA — dentro la viewport E dentro
 *     la striscia, che scorre in orizzontale. Una miniatura fuori schermo
 *     volerebbe da un punto che nessuno vede: lì si lascia la dissolvenza.
 *     Vale anche per Indietro/Avanti, perché `pageswap` c'è anche lì.
 *
 *  2. PREPARARE L'IMMAGINE SU INTENTO. Al passaggio del puntatore o al focus
 *     su un link verso un altro case study, un `<link rel=preload>` con lo
 *     STESSO srcset del visual di destinazione (vedi lib/stage-media.ts).
 *     Mai tutti insieme al caricamento: sono le immagini più pesanti.
 *
 * ⚠ CINQUE CLIC DI FILA non lasciano niente di vecchio in giro: ogni nuova
 * navigazione annulla la precedente (lo fa il browser), e questo modulo non ha
 * né code né timer da smaltire.
 */

/** Il sottoinsieme di `PageSwapEvent` che serve qui (non tutte le versioni
 *  della libreria DOM di TypeScript lo dichiarano ancora). */
interface SwapEvent extends Event {
  viewTransition: ActiveTransition | null;
  activation: { entry: { url: string } | null } | null;
}

interface ActiveTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}
declare global {
  interface Window {
    /** Messa da parte dallo script inline di CaseStudyLayout. */
    __csVT?: ActiveTransition | null;
  }
}

const NAME = 'cs-visual';

/** Una transizione interrotta da un'altra navigazione rifiuta le sue promesse.
 *  È previsto (succede a ogni clic rapido), non un errore: si zittisce qui,
 *  altrimenti ogni pagina rimasta nella bfcache lo stamperebbe in console. */
function quiet(vt: ActiveTransition | null | undefined): void {
  if (!vt) return;
  for (const p of [vt.ready, vt.updateCallbackDone, vt.finished]) p?.catch(() => {});
}

/**
 * ⚠ UN CLIC DURANTE LA TRANSIZIONE NON DEVE ANDARE PERSO. Misurato: per tutta
 * la durata (~950ms) Chrome fa l'hit-test sulla radice, `elementFromPoint`
 * restituisce <html>, e il clic su una seconda miniatura non va da nessuna
 * parte — `pointer-events: none` sullo strato della transizione non cambia
 * niente. Chi scorre i progetti in fretta perderebbe proprio i clic che
 * contano.
 *
 * Quindi: alla pressione la transizione si SALTA (lo stato finale è già lì
 * sotto, completo), e al rilascio si attiva il link che sta davvero sotto il
 * puntatore. `click()` su quel link è una navigazione normale, con la sua
 * transizione, e un altro clic rapido farà la stessa cosa: resta sempre e
 * solo l'ultima destinazione.
 *
 * Tasti modificatori o pulsante centrale: non si simula niente. Il browser
 * farebbe altro (nuova scheda) e un `click()` sintetico non può riprodurlo;
 * è meglio lasciare che quel singolo gesto, raro, vada a vuoto.
 */
function keepClicksDuring(vt: ActiveTransition): void {
  let point: { x: number; y: number } | null = null;
  let done = false;
  const opts = { capture: true } as const;

  const down = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    point = { x: e.clientX, y: e.clientY };
    vt.skipTransition();
  };
  const click = (e: MouseEvent) => {
    const p = point;
    point = null;
    if (done) removeEventListener('click', click, opts);
    if (!p || (e.target as Element | null)?.closest?.('a[href]')) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = document.elementFromPoint(p.x, p.y)?.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    e.preventDefault();
    link.click();
  };

  addEventListener('pointerdown', down, opts);
  addEventListener('click', click, opts);
  /* `then(f, f)` e NON `finally(f)`: `finally` restituisce una promessa
     nuova, e quando `finished` viene rifiutata (una transizione interrotta da
     un clic rapido) quella promessa nuova resta senza gestore — un errore in
     console a ogni cambio veloce. Trovato così, non letto nella specifica. */
  const cleanup = () => {
    done = true;
    removeEventListener('pointerdown', down, opts);
    // Un clic premuto durante la transizione e rilasciato dopo va ancora servito.
    if (!point) removeEventListener('click', click, opts);
  };
  vt.finished.then(cleanup, cleanup);
}

function inView(el: Element, strip: Element | null): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) {
    return false;
  }
  if (!strip) return true;
  const s = strip.getBoundingClientRect();
  // Almeno metà della miniatura dentro la parte visibile della striscia.
  const visible = Math.min(r.right, s.right) - Math.max(r.left, s.left);
  return visible >= r.width / 2;
}

/** Riporta i nomi com'erano: serve se la pagina torna dalla bfcache, dove
 *  resterebbero quelli impostati nell'istante in cui è stata lasciata. */
function resetNames(): void {
  document.querySelectorAll<HTMLElement>('[data-cs-thumb-img], [data-cs-screen]').forEach((el) => {
    el.style.removeProperty('view-transition-name');
  });
}

export function initCaseSwitch(): void {
  const root = document.querySelector('[data-cs]');
  if (!root) return;
  /* ---- 0. I clic durante la transizione in arrivo ---- */
  if (window.__csVT) keepClicksDuring(window.__csVT);
  window.__csVT = null;

  /* ---- 1. La miniatura che diventa la scena ---- */
  window.addEventListener('pageswap', (event) => {
    const e = event as SwapEvent;
    const url = e.activation?.entry?.url;
    quiet(e.viewTransition);
    if (!e.viewTransition || !url) return;

    const dest = new URL(url);
    if (dest.origin !== location.origin || dest.pathname === location.pathname) return;

    const strip = document.querySelector('[data-cs-strip]');
    const card = document.querySelector<HTMLAnchorElement>(
      `[data-cs-thumb][href="${CSS.escape(dest.pathname)}"]`
    );
    const thumb = card?.querySelector<HTMLElement>('[data-cs-thumb-img]');
    const screen = document.querySelector<HTMLElement>('[data-cs-screen]');
    if (!thumb || !screen || !inView(thumb, strip)) return;

    screen.style.setProperty('view-transition-name', 'cs-visual-out');
    thumb.style.setProperty('view-transition-name', NAME);
  });

  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) resetNames();
  });
  /* Tornando dalla bfcache il modulo non riparte: la transizione di rientro
     arriva solo come evento. */
  window.addEventListener('pagereveal', (event) => {
    const vt = (event as Event & { viewTransition?: ActiveTransition | null }).viewTransition;
    quiet(vt);
    if (vt && document.readyState === 'complete') keepClicksDuring(vt);
  });

  /* ---- 1b. Annotare l'ultima scelta (vedi lo script inline del layout) ----
     Al CLIC, e per il mouse anche alla PRESSIONE: a cadenze molto rapide
     pressione e rilascio possono cadere in due documenti diversi (la pagina
     cambia fra i due), e allora il `click` non nasce mai. La pressione sì.
     ⚠ Non per il touch: lì una pressione può essere l'inizio di uno swipe
     sulla striscia, e registrarla come scelta sarebbe un errore. */
  const remember = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-cs-link]');
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    try {
      sessionStorage.setItem('vc:cs-intent', JSON.stringify({ href: link.pathname, t: Date.now() }));
    } catch {
      /* Storage non disponibile (navigazione privata): resta la navigazione
         normale, che basta in tutti i casi tranne quello limite qui sopra. */
    }
  };
  root.addEventListener('click', (e) => remember(e as MouseEvent), { capture: true });
  root.addEventListener(
    'pointerdown',
    (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') remember(e as MouseEvent);
    },
    { capture: true }
  );

  /* ---- 2. Preparare l'immagine della destinazione ---- */
  const sizes = root.querySelector<HTMLElement>('[data-cs-sizes]')?.dataset.csSizes;
  const done = new Set<string>();
  const prepare = (event: Event) => {
    const link = (event.target as Element | null)?.closest?.<HTMLElement>('[data-cs-preload]');
    const srcset = link?.dataset.csPreload;
    if (!srcset || done.has(srcset)) return;
    done.add(srcset);
    const l = document.createElement('link');
    l.rel = 'preload';
    l.as = 'image';
    l.type = 'image/avif';
    l.setAttribute('imagesrcset', srcset);
    if (sizes) l.setAttribute('imagesizes', sizes);
    document.head.append(l);
  };
  root.addEventListener('pointerover', prepare, { passive: true });
  root.addEventListener('focusin', prepare);
}
