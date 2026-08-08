/**
 * Verifica funzionale del motore animazioni, via CDP.
 *
 * Controlla le cose che possono rompersi in silenzio:
 *  - Lenis istanziato e ScrollTrigger creati
 *  - SplitText ha davvero spezzato le righe (e con i wrapper mascherati)
 *  - il titolo hero NON è mai a opacità < 1  (regola LCP)
 *  - i data-reveal diventano visibili dopo lo scroll
 *  - con prefers-reduced-motion: reduce -> zero ScrollTrigger e tutto visibile
 *  - con JS disattivato -> tutto visibile
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:4321/';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9344;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=' + process.env.TEMP + '/cdp-verify-' + PORT,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome non risponde');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((res) => {
    const myId = ++id;
    pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params, sessionId }));
  });

const { result: t } = await send('Target.getTargets');
const pg = t.targetInfos.find((x) => x.type === 'page');
const { result: at } = await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true });
const sid = at.sessionId;
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);

const evaluate = async (expression) => {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid);
  return result?.result?.value;
};

async function load(url) {
  await send('Page.navigate', { url }, sid);
  await sleep(2600);
}

const PROBE = `(() => {
  const q = (s) => document.querySelector(s);
  const st = window.ScrollTrigger || (window.gsap && window.gsap.core && null);
  const splitEl = q('[data-split="lines"]');
  const h1lines = [...document.querySelectorAll('.hero__headline, .hero__lead, .hero__cta')];
  return {
    jsAnimClass: document.documentElement.classList.contains('js-anim'),
    animReady: document.documentElement.dataset.animReady === '1',
    lenisClass: document.documentElement.classList.contains('lenis'),
    lenisSmooth: document.documentElement.classList.contains('lenis-smooth'),
    splitLineDivs: splitEl ? splitEl.querySelectorAll('div').length : -1,
    splitAriaLabel: splitEl ? splitEl.hasAttribute('aria-label') : false,
    /* ⚠ ERA un confronto con la stringa "Prima di annoiarti" scritta qui dentro.
       Quel testo è stato spostato nel sottotitolo di §01 (che non ha
       data-split) durante la revisione della sezione, e da allora il controllo
       era ROSSO senza che nulla fosse rotto: un assert inchiodato a una copy
       invece che a un'invariante, cioè lo stesso difetto che verify-stage aveva
       sull'hex del canvas. Un controllo sempre rosso insegna a ignorare l'esito
       di tutto lo strumento.
       L'invariante vera è indipendente dal testo: SplitText NON deve perdere né
       duplicare caratteri. Si confronta quindi il testo dell'elemento con la
       concatenazione delle righe che ha prodotto, a spazi normalizzati (fra una
       riga e l'altra lo spazio non sopravvive, ed è normale).
       NB: niente backtick in questo commento — sta DENTRO un template literal e
       lo chiuderebbe in anticipo. Stessa nota che sta in verify-stage.mjs, e
       stesso SyntaxError, preso due volte. */
    splitTextLen: splitEl ? splitEl.textContent.replace(/\\s+/g, '').length : -1,
    /* ⚠ SOLO I FIGLI DIRETTI. SplitText annida due livelli di div per riga (il
       wrapper esterno e quello interno che permette il mascheramento), quindi
       querySelectorAll('div') restituisce ogni riga DUE volte e la
       concatenazione dava esattamente il doppio dei caratteri: 142 contro 71.
       Il conteggio grezzo di splitLineDivs qui sopra resta com'era perché quel
       controllo chiede solo "almeno due", e va bene anche contando i nidi. */
    splitLinesLen: splitEl
      ? [...splitEl.children].filter(n => n.tagName === 'DIV')
          .map(d => d.textContent).join('').replace(/\\s+/g, '').length
      : -1,
    heroLineOpacities: h1lines.map(el => getComputedStyle(el).opacity),
    heroTitleOpacity: q('.hero__title') ? getComputedStyle(q('.hero__title')).opacity : null,
    revealCount: document.querySelectorAll('[data-reveal]').length,
    revealOpacities: [...document.querySelectorAll('[data-reveal]')].map(el => getComputedStyle(el).opacity),
    /* ⚠ NIENTE BACKTICK IN QUESTO COMMENTO: sta dentro un template literal
       (PROBE), quindi un backtick lo chiuderebbe e il file non parserebbe.

       Sonda .wid__rule e NON [data-rule]. L'invariante da garantire è "dopo lo
       scroll il filetto in cima alle clausole è disegnato", che non dipende da
       QUALE meccanismo lo disegna: prima era M11 (data-rule), adesso è la
       seconda battuta di M14 (.wid__clauses.is-on). Agganciato all'attributo,
       questo controllo diventava null — cioè verde-o-rosso per la presenza di
       un attributo invece che per lo stato del filetto — nel momento in cui il
       meccanismo cambiava, pur essendo il filetto perfettamente disegnato.
       Stessa regola dell'assert sul near-black in verify-stage.mjs: si misura
       l'invariante, non l'implementazione. */
    ruleScaleX: q('.wid__rule') ? getComputedStyle(q('.wid__rule')).transform : null,
    /* IL MANIFESTO §04. Si sondano gli stati OSSERVABILI — la scala del filetto
       e l'opacita' del timbro — non le classi che li producono: stessa regola di
       ruleScaleX qui sopra, cosi' il controllo sopravvive a un cambio di
       meccanismo invece di diventare null in silenzio.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    stRuleTransform: q('.st__text em')
      ? getComputedStyle(q('.st__text em'), '::after').transform
      : null,
    stStampOpacity: q('.st__stamp') ? getComputedStyle(q('.st__stamp')).opacity : null,
    stGhostOpacity: q('.st__ghost') ? getComputedStyle(q('.st__ghost')).opacity : null,
    /* §04 DICONO. Il gesto cinetico qui e' una CANCELLATURA (un ::after in
       scaleX su .ts__cut), non una sottolineatura: stessa famiglia di
       vocabolario dello statement, elemento diverso — quindi serve un sondaggio
       suo, e sondarlo con quello dello statement lo renderebbe verde per il
       motivo sbagliato. Sondati gli stati OSSERVABILI, come sopra.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsCutTransform: q('.ts__cut')
      ? getComputedStyle(q('.ts__cut'), '::after').transform
      : null,
    /* ⚠ §04 HA DUE IMPIANTI e a sceglierli e' il NUMERO di citazioni (vedi
       Testimonials.astro): sotto 6 le righe editoriali, da 6 in su il muro che
       scorre. Quindi questo strumento non puo' dare per scontato quale dei due
       stia guardando: sonda quale c'e' e poi asserisce solo le invarianti che
       hanno senso per quello. Senza questo, il giorno in cui Vlad sostituisce i
       segnaposto con tre testimonianze vere meta' dei controlli di §04
       diventerebbe rossa senza che si sia rotto niente — che e' il modo piu'
       rapido di insegnare a ignorare l'esito dello strumento.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsImpianto: q('.ts__track') ? 'muro' : q('.ts__list') ? 'focus' : 'assente',
    /* Le righe del registro editoriale: stessa logica delle colonne del muro,
       elemento diverso. */
    tsItemOpacities: Array.from(document.querySelectorAll('.ts__item')).map(
      (el) => getComputedStyle(el).opacity
    ),
    /* ⚠ L'INVARIANTE DEL REGISTRO A RIGHE: l'elenco divide un viewport meno il
       titolo fra le citazioni, e il corpo del testo e' tarato su quel conto
       (vedi la tabella QUOTE_SIZE in TestimonialsFocus). Se una citazione molto
       lunga, o un viewport molto basso, mandano il contenuto oltre lo spazio
       calcolato, il testo sborda dal proprio riquadro — e siccome non c'e'
       nessun ritaglio, sborda in silenzio, sovrapponendosi alla riga successiva.
       Qui si misura il debordo in pixel: e' l'unico difetto di quell'impianto
       che non si vede guardandolo a colpo d'occhio.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsListaDebordo: (() => {
      const l = q('.ts__list');
      if (!l) return null;
      return { finestra: Math.round(l.clientHeight), contenuto: Math.round(l.scrollHeight) };
    })(),
    /* ⚠ SI SONDANO LE COLONNE, NON LE CARD (cambiato con M18, il muro che
       scorre). Prima l'ingresso era per card, in cascata; oggi entra la colonna e
       la card non ha piu' nessuna opacita' propria. Sondare ancora .tc darebbe
       nove volte "1" a riposo e l'assert "a riposo non sono entrate" diventerebbe
       rosso — o, peggio, verde per il motivo sbagliato se qualcuno lo allentasse.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsColOpacities: Array.from(document.querySelectorAll('.ts__col')).map(
      (el) => getComputedStyle(el).opacity
    ),
    /* L'INVARIANTE GEOMETRICA DEL MARQUEE, e non e' un dettaglio: una traccia
       contiene le sue card due volte e trasla del 50%, quindi META' della traccia
       deve coprire ALMENO tutta la finestra che la mostra. Se non la copre, ad
       ogni giro passa un buco — il difetto tipico di un marquee con troppo poco
       contenuto, che si vede solo dopo decine di secondi (cioe' mai, durante uno
       sviluppo) e sempre a chi guarda la pagina per davvero.
       Si misura il rapporto e non un'altezza attesa: card e viewport cambiano,
       la relazione no.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsWallSeam: (() => {
      const wall = q('.ts__wall');
      if (!wall) return null;
      const h = wall.clientHeight;
      return Array.from(wall.querySelectorAll('.ts__track')).map((t) => ({
        half: Math.round(t.getBoundingClientRect().height / 2),
        window: Math.round(h),
      }));
    })(),
    /* La copia decorativa dev'essere marcata: tante card nascoste all'assistiva
       quante visibili, e nessun link della copia raggiungibile da tastiera.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    tsDup: {
      visibili: document.querySelectorAll('.tc:not([aria-hidden])').length,
      nascoste: document.querySelectorAll('.tc[aria-hidden="true"]').length,
      linkTabbabiliNellaCopia: document.querySelectorAll(
        '.tc[aria-hidden="true"] a:not([tabindex="-1"])'
      ).length,
    },
    /* Il colore risolto della frase che prende la parola, col fondo su cui
       poggia: serve per l'invariante di contrasto (mai un hex negli assert —
       vedi il divieto in CLAUDE.md). Il fondo lo mette l'antenato .ho__in--paper,
       quindi va risalito finche' non si trova un colore non trasparente. */
    tsLoud: (() => {
      const el = q('.ts__loud');
      if (!el) return null;
      let bg = 'rgba(0, 0, 0, 0)';
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) {
          bg = c;
          break;
        }
      }
      return { color: getComputedStyle(el).color, bg: bg };
    })(),
    /* §70 CTA. Le quattro righe entrano in cascata (M14) e il gruppo azioni
       DOPO di loro; il glow del bottone è invece l'unica animazione in LOOP
       della sezione, quindi si sonda il suo conteggio di iterazioni — che sotto
       reduced-motion la regola globale di global.css deve portare a 1.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    ctaLineOpacities: Array.from(document.querySelectorAll('.cta__line')).map(
      (el) => getComputedStyle(el).opacity
    ),
    ctaActionsOpacity: q('.cta__actions') ? getComputedStyle(q('.cta__actions')).opacity : null,
    ctaGlowIterations: q('.cta__glow')
      ? getComputedStyle(q('.cta__glow'), '::before').animationIterationCount
      : null,
    /* Le opacita' delle cinque onde del cielo, lette DUE volte per due
       invarianti opposti: a pagina caricata devono essere tutte a zero (prima
       della partenza il cielo non ha bande — vedi il difetto dei ritardi
       negativi piu' sotto), con movimento ridotto devono essere tutte VISIBILI
       perche' quel fondo non deve sparire a chi chiede meno movimento. La
       regola globale di global.css porta le iterazioni a 1, e il fotogramma
       100% dell'onda e' opacity 0 — cioe' senza il blocco reduce dedicato in
       CTASection il cielo diventerebbe nero vuoto. Qui si misura che non lo sia.
       NB: nessun backtick in questo commento, sta dentro un template literal. */
    ctaWaveOpacities: Array.from(document.querySelectorAll('.cta__wave')).map(
      (el) => getComputedStyle(el).opacity
    ),
  };
})()`;

const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

/**
 * "Il filetto è steso per intero", indipendentemente da come ci è arrivato.
 *
 * Accetta sia `none` sia una matrice con scaleX 1: senza `html.js-anim` (JS
 * spento, reduced-motion) il ::after non ha alcuna `transform` dichiarata, che è
 * lo stato finale corretto — pretendere la matrice lo farebbe fallire proprio
 * nei rami in cui il filetto DEVE essere già disegnato.
 */
const steso = (tf) => tf === 'none' || /^matrix\(1,\s*0,\s*0,/.test(tf || '');

/* ---- 1. Movimento consentito ------------------------------------------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, sid);
await load(URL_);
let p = await evaluate(PROBE);
console.log('--- movimento consentito ---');
console.log(JSON.stringify(p, null, 2));

ok('classe js-anim aggiunta', p.jsAnimClass === true);
ok('boot eseguito (animReady)', p.animReady === true);
// html.lenis = Lenis agganciato. NON si controlla `lenis-smooth`: quella classe
// esiste solo MENTRE uno scroll fluido è in corso (lenis.mjs: la aggiunge se
// isScrolling === 'smooth'), quindi a riposo è assente per definizione.
ok('Lenis agganciato (html.lenis)', p.lenisClass === true);

// Test COMPORTAMENTALE dello smooth scroll: un wheel event non deve spostare la
// pagina di colpo, ma interpolare su più frame guidati da gsap.ticker.
const smooth = await evaluate(`(async () => {
  const samples = [];
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 120));
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 900, cancelable: true, bubbles: true }));
  for (let i = 0; i < 8; i++) {
    await new Promise(r => requestAnimationFrame(r));
    samples.push(Math.round(window.scrollY));
  }
  await new Promise(r => setTimeout(r, 600));
  samples.push(Math.round(window.scrollY));
  return samples;
})()`);
ok(
  'smooth scroll interpolato su più frame',
  Array.isArray(smooth) && smooth.at(-1) > 0 && smooth.at(-1) > smooth[0] && smooth[0] < smooth.at(-1) * 0.9,
  'scrollY: ' + (smooth || []).join(' → ')
);
ok('SplitText ha spezzato le righe', p.splitLineDivs >= 2, `${p.splitLineDivs} div`);
ok('SplitText NON aggiunge aria-label (proibito su p/div)', p.splitAriaLabel === false);
ok(
  'SplitText non perde ne duplica caratteri',
  p.splitTextLen > 0 && p.splitTextLen === p.splitLinesLen,
  `${p.splitLinesLen} caratteri nelle righe / ${p.splitTextLen} nell'elemento`
);
ok('titolo hero SEMPRE opaco (regola LCP)', p.heroLineOpacities.every((o) => o === '1'), p.heroLineOpacities.join(','));

// Il manifesto è molto sotto la piega: a pagina appena caricata NON deve essere
// già acceso, altrimenti la sua animazione non esiste e il controllo che segue
// (disegnato dopo lo scroll) sarebbe verde senza aver misurato niente.
ok(
  'manifesto §04: a riposo il filetto NON è disegnato',
  /^matrix\(0,/.test(p.stRuleTransform || ''),
  p.stRuleTransform
);

/* §04 Dicono, stessa logica: la sezione è molto sotto la piega, quindi a pagina
   appena caricata la cancellatura non può essere già tirata e le card non
   possono essere già entrate. Senza questo, i due controlli "dopo lo scroll"
   sarebbero verdi senza aver misurato nessuna animazione. */
/* ⚠ TRE STATI, NON DUE. La biforcazione muro/righe (sotto) presupponeva che §04
   fosse comunque IN PAGINA, e i due impianti erano le uniche alternative. Ma la
   sezione ha anche un interruttore a monte — `SITE.features.testimonials` — che
   la toglie del tutto, ed è uno stato legittimo e previsto: è la posizione in cui
   sta finché non esistono citazioni vere da pubblicare. Con la sezione spenta
   ogni sonda `.ts__*` tornava `null`/vuoto e NOVE controlli diventavano rossi in
   una volta, senza che si fosse rotto niente — esattamente il difetto che la nota
   qui sotto dichiarava di voler evitare, applicato però solo a metà.
   `assente` non è quindi un fallimento da segnalare: è un ramo da saltare, e da
   dichiarare a voce alta perché nessuno scambi il silenzio per un verde. */
const dicono = p.tsImpianto !== 'assente';

if (dicono) {
  ok(
    '§04 Dicono: a riposo la cancellatura NON è tirata',
    /^matrix\(0,/.test(p.tsCutTransform || ''),
    p.tsCutTransform
  );
} else {
  console.log(
    '  ·  §04 Dicono: sezione spenta (SITE.features.testimonials), 9 assert non applicabili'
  );
}
/* ⚠ DA QUI IN POI §04 SI BIFORCA. Quale impianto sia in scena lo decide il numero
   di citazioni (vedi Testimonials.astro), quindi lo strumento lo LEGGE invece di
   darlo per scontato: asserire le invarianti del muro su una pagina che rende le
   righe editoriali produrrebbe una fila di rossi senza che si sia rotto niente.
   L'impianto viene comunque stampato: un controllo che cambia forma in silenzio
   è peggio di uno che manca. */
const muro = p.tsImpianto === 'muro';
if (dicono) {
  ok(
    `§04 Dicono: impianto in scena — ${p.tsImpianto}`,
    true,
    muro ? 'muro che scorre (≥6 citazioni)' : 'righe editoriali (1-5 citazioni)'
  );
}

if (!dicono) {
  /* niente da asserire: la sezione non è in pagina */
} else if (muro) {
  ok(
    '§04 muro: a riposo le colonne non sono entrate',
    p.tsColOpacities.length > 0 && p.tsColOpacities.every((o) => Number(o) < 0.1),
    `${p.tsColOpacities.length} colonne · ${p.tsColOpacities.join(',')}`
  );
  /* ⚠ M18 — L'INVARIANTE CHE TIENE IN PIEDI IL LOOP. Vedi il commento accanto al
     sondaggio: mezza traccia deve coprire tutta la finestra, o ad ogni giro passa
     un buco. È l'unico difetto di quell'impianto che non si vede guardandolo per
     dieci secondi — quindi è esattamente quello che deve controllare uno
     strumento e non un paio d'occhi. Si controlla a pagina appena caricata perché
     è geometria, non stato: vale anche prima che il muro entri in scena. */
  ok(
    '§04 muro: mezza traccia copre la finestra (nessuna giuntura nel loop)',
    Array.isArray(p.tsWallSeam) &&
      p.tsWallSeam.length > 0 &&
      p.tsWallSeam.every((t) => t.half >= t.window),
    (p.tsWallSeam || []).map((t) => `${t.half}≥${t.window}`).join(' · ')
  );
  /* La copia che rende invisibile il ciclo non deve rendere doppio il contenuto
     per chi non la vede: tante card marcate `aria-hidden` quante visibili, e zero
     link della copia nel giro di tastiera (un `aria-hidden` con dentro qualcosa di
     focalizzabile è una violazione WCAG vera, non una pignoleria). */
  ok(
    '§04 muro: la copia del loop è invisibile ad assistiva e tastiera',
    p.tsDup.visibili > 0 &&
      p.tsDup.nascoste === p.tsDup.visibili &&
      p.tsDup.linkTabbabiliNellaCopia === 0,
    `${p.tsDup.visibili} reali / ${p.tsDup.nascoste} copie · ${p.tsDup.linkTabbabiliNellaCopia} link tabbabili nella copia`
  );
} else {
  ok(
    '§04 righe: a riposo le righe non sono entrate',
    p.tsItemOpacities.length > 0 && p.tsItemOpacities.every((o) => Number(o) < 0.1),
    `${p.tsItemOpacities.length} righe · ${p.tsItemOpacities.join(',')}`
  );
  /* ⚠ L'invariante geometrica di questo impianto NON si misura qui, si misura
     dopo lo scroll — vedi più sotto. A riposo le righe sono ancora traslate di
     26px dal proprio stato d'ingresso, e quella traslazione entra nello
     `scrollHeight`: misurata adesso darebbe un debordo di 26px inesistente. È il
     primo risultato che questo controllo ha prodotto, ed era un difetto suo. */
}

/* A pagina appena caricata le tracce devono essere IN PAUSA: girano solo da
   quando il muro è in vista. Stesso controllo (e stessa ragione) del cielo della
   CTA: tre colonne alte il doppio della viewport che traslano durante il
   caricamento sono costo puro per un effetto che nessuno sta guardando. */
if (muro) {
  const wallAtRest = await evaluate(`(async () => {
    const el = document.querySelector('.ts__track');
    if (!el) return 'elemento assente';
    const a = getComputedStyle(el).transform;
    await new Promise((r) => setTimeout(r, 700));
    return a === getComputedStyle(el).transform ? 'in pausa' : 'GIA IN MOTO';
  })()`);
  ok('§04 muro: a pagina caricata è in pausa (budget LCP)', wallAtRest === 'in pausa', wallAtRest);
}
/* §70 CTA, stessa logica: è l'ultima sezione della pagina, quindi a pagina
   appena caricata le sue righe non possono essere già entrate. Le quattro righe
   devono essere TUTTE spente, non "almeno una": una cascata in cui la prima è
   già visibile non è una cascata. */
ok(
  '§70 CTA: a riposo le quattro righe non sono entrate',
  p.ctaLineOpacities.length === 4 && p.ctaLineOpacities.every((o) => Number(o) < 0.1),
  `${p.ctaLineOpacities.length} righe · ${p.ctaLineOpacities.join(',')}`
);

/* A pagina appena caricata le onde devono essere IN PAUSA: girano solo da quando
   la sezione è stata raggiunta (`animation-play-state`, vedi CTASection). È il
   controllo che protegge il budget dell'LCP — cinque strati grandi quanto la
   viewport che animano durante il caricamento sono costo puro per un effetto
   che nessuno sta guardando. */
const waveAtRest = await evaluate(`(async () => {
  const el = document.querySelector('.cta__wave');
  if (!el) return 'elemento assente';
  const a = getComputedStyle(el).transform;
  await new Promise((r) => setTimeout(r, 700));
  return a === getComputedStyle(el).transform ? 'in pausa' : 'GIA IN MOTO';
})()`);
ok(
  '§70 CTA: a pagina caricata le onde sono in pausa (budget LCP)',
  waveAtRest === 'in pausa',
  waveAtRest
);
/* ⚠ E IN PAUSA DEVONO ESSERE ANCHE INVISIBILI, che è un invariante DIVERSO da
   "sono ferme" e nasce da un difetto reale visto a schermo: con i ritardi
   negativi della prima versione la pausa congelava ogni onda a un fotogramma
   qualsiasi del proprio ciclo, quindi arrivando alla sezione si trovavano cinque
   bande immobili sparse a mezzo schermo che poi ripartivano da lì — descritto
   così: "sembra che l'animazione sia già partita e sia in pausa ad aspettare che
   parta". Fermo NON basta: prima della partenza il cielo non deve avere bande.
   Si misura l'opacità e non il ritardo perché è l'opacità ciò che si vede: un
   domani i valori dei ritardi possono cambiare, questo invariante no. */
ok(
  '§70 CTA: prima della partenza nessuna onda è visibile',
  p.ctaWaveOpacities.length === 5 && p.ctaWaveOpacities.every((o) => Number(o) < 0.02),
  `onde ${p.ctaWaveOpacities.join(',')}`
);

/**
 * Scorre con eventi wheel REALI passati da CDP.
 *
 * Non si usa `window.scrollTo`: Lenis intercetta lo scroll e, se sta già
 * interpolando verso un bersaglio (per esempio dopo il test dello smooth scroll
 * qui sopra), il suo loop rAF sovrascrive la posizione impostata a mano e la
 * pagina non arriva dove si crede. Una rotellina è invece esattamente ciò che
 * Lenis si aspetta.
 */
async function wheelTo(ticks, delta = 500) {
  for (let i = 0; i < ticks; i++) {
    await send(
      'Input.dispatchMouseEvent',
      { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY: delta },
      sid
    );
    await sleep(70);
  }
  await sleep(1100);
}

// Scorrimento normale fino in fondo: alla fine TUTTI i data-reveal devono essere
// visibili, perché li si è attraversati uno per uno.
await wheelTo(26);

/* ⚠ ATTESA EXTRA, e serve per una ragione aritmetica, non per prudenza.
   Le soglie M14 delle sezioni in fondo scattano negli ULTIMI tick di rotellina,
   e l'elemento più lento della pagina è il timbro del manifesto §04: 700ms di
   durata sopra 1900ms di ritardo, cioè 2600ms dalla propria soglia. `wheelTo`
   lascia solo 1100ms di quiete, quindi il campione cadeva MENTRE la transizione
   era ancora in corso: misurato 0.9027 e 0.9717 su due run consecutive, cioè a
   filo della soglia di 0.9 dell'assert — verde o rosso a caso, sullo stesso
   codice. Un controllo che sfarfalla insegna a ignorare l'esito dell'intero
   strumento esattamente come uno sempre rosso.
   2000ms portano la quiete totale a ~3100ms, sopra i 2600 richiesti. Se un
   giorno un ritardo cresce oltre ~1400ms, questo numero va rifatto con quel
   conto. */
await sleep(2000);
const after = await evaluate(PROBE);
ok(
  'data-reveal visibili dopo lo scroll',
  after.revealOpacities.length > 0 && after.revealOpacities.every((o) => Number(o) > 0.9),
  after.revealOpacities.join(',')
);
ok('filetto disegnato (scaleX 1)', /matrix\(1,/.test(after.ruleScaleX || ''), after.ruleScaleX);
ok(
  'manifesto §04: filetto, timbro e parola-fantasma accesi dopo lo scroll',
  steso(after.stRuleTransform) &&
    Number(after.stStampOpacity) > 0.9 &&
    Number(after.stGhostOpacity) > 0.9,
  `filetto ${after.stRuleTransform} · timbro ${after.stStampOpacity} · fantasma ${after.stGhostOpacity}`
);
const entrati = muro ? after.tsColOpacities : after.tsItemOpacities;
if (dicono) {
  ok(
    `§04 Dicono: cancellatura tirata e ${muro ? 'colonne' : 'righe'} entrate dopo lo scroll`,
    steso(after.tsCutTransform) && entrati.length > 0 && entrati.every((o) => Number(o) > 0.9),
    `cancellatura ${after.tsCutTransform} · ${entrati.join(',')}`
  );
}
/* ...e ORA il muro deve scorrere: raggiunta la sezione, `is-in` è arrivata e
   `animation-play-state` è passata a `running`. Come per il cielo della CTA, è
   un'animazione che non dipende né dallo scroll né da un tween: senza questo
   controllo un errore nei keyframes la lascerebbe ferma senza che niente diventi
   rosso. Si campiona la traccia di UNA colonna: se una gira girano tutte, la
   regola che le accende è la stessa.
   ⚠ Solo per il muro: il registro a righe non ha NIENTE in loop, ed è una
   decisione dichiarata (vedi TestimonialsFocus) — lì il movimento non avrebbe
   niente da dire e sarebbe decorazione. */
if (!dicono) {
  /* sezione spenta: né muro da far scorrere né righe da misurare */
} else if (muro) {
  const wallMotion = await evaluate(`(async () => {
    const el = document.querySelector('.ts__track');
    if (!el) return 'elemento assente';
    const a = getComputedStyle(el).transform;
    await new Promise((r) => setTimeout(r, 700));
    return a === getComputedStyle(el).transform ? 'FERMO ' + a : 'in moto';
  })()`);
  ok('§04 muro: raggiunta la sezione, scorre', wallMotion === 'in moto', wallMotion);
} else {
  /* ⚠ L'INVARIANTE DEL REGISTRO A RIGHE, gemella di quella del loop: là il
     rischio è un buco nel ciclo, qui è del testo che sborda oltre lo spazio
     calcolato per lui. Non c'è nessun ritaglio, quindi il testo in eccesso non
     sparisce — si sovrappone alla riga sotto, che è un difetto che si nota solo
     andandolo a cercare.
     ⚠ VA MISURATA QUI E NON A RIPOSO, e la prima stesura sbagliava proprio
     questo: prima dell'ingresso le righe portano `translate: 0 26px`, che entra
     nello `scrollHeight` e produce un debordo di 26px che non esiste. Il
     controllo era rosso su un layout corretto — il tipo di errore che, se non lo
     si insegue, finisce per far allentare la soglia invece del controllo.
     La tolleranza di 2px assorbe gli arrotondamenti subpixel della griglia a
     righe uguali. */
  const d = after.tsListaDebordo;
  ok(
    '§04 righe: le citazioni stanno nello spazio calcolato',
    d !== null && d.contenuto <= d.finestra + 2,
    d
      ? `contenuto ${d.contenuto} in finestra ${d.finestra} (debordo ${d.contenuto - d.finestra}px)`
      : 'elenco assente'
  );
}

/* ⚠ CONTRASTO, NON HEX. "Ascolta loro:" passa all'accento sulla superficie
   AVORIO, dove `--color-accent` (tarato sul canvas nero) NON passa AA: serve la
   variante deep. Ma asserire quale variante sia vorrebbe dire scrivere un token
   in un test, cioè un controllo che diventa rosso al primo ritocco di palette
   senza che niente si sia rotto (vedi il divieto in CLAUDE.md). L'invariante
   vera è il RAPPORTO misurato sul fondo reale, e sopravvive a qualunque
   cambio di tinta. 4.5:1 e non 3:1: il titolo è grande, ma la soglia larga
   vale solo da 24px/18.66px-bold in su e questa regola deve restare vera anche
   se il titolo si rimpicciolisce su viewport strette. */
const relLum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const tsLum = after.tsLoud ? relLum(after.tsLoud.color) : null;
const tsBgLum = after.tsLoud ? relLum(after.tsLoud.bg) : null;
const tsRatio =
  tsLum === null ? 0 : (Math.max(tsLum, tsBgLum) + 0.05) / (Math.min(tsLum, tsBgLum) + 0.05);
if (dicono) {
  ok(
    "§04 Dicono: l'accento del titolo passa AA sulla superficie che ha davvero",
    tsRatio >= 4.5,
    after.tsLoud
      ? `${after.tsLoud.color} su ${after.tsLoud.bg} — ${tsRatio.toFixed(2)}:1`
      : 'elemento assente'
  );
}

/* ⚠ LA RISALITA, e nessun altro controllo di questo strumento la vedeva.
   Difetto reale (2026-08-08, segnalato da Vlad su §01 e sullo Statement):
   tornando SU sopra un titolo già entrato, righe e parole tornavano di scatto
   nella posa nascosta di partenza, e ripassandoci in discesa l'ingresso si
   rigiocava da capo. Causa: `once: true` uccide uno ScrollTrigger quando si
   raggiunge la sua FINE, non quando l'animazione finisce — e dentro un handoff
   sticky quella fine può non arrivare mai, lasciando vivo un trigger che
   rirende il `from` a progress 0 appena si risale prima del suo start.

   Ogni assert esistente qui misura lo stato SCENDENDO, quindi restava verde
   mentre il difetto era in pagina: è esattamente la classe di guasto che uno
   strumento deve vedere al posto di un paio d'occhi.

   ⚠ Si misura la POSA DIPINTA, non il transform inline. Il fix ripulisce il
   transform (`clearProps`), ma asserire "l'attributo style è vuoto" legherebbe
   il controllo a COME è stato risolto invece che a cosa deve essere vero — e
   diventerebbe rosso al primo modo diverso di ottenere lo stesso risultato.
   L'invariante vera: ogni frammento di SplitText deve stare allineato al
   proprio wrapper mascherato. Se è spinto giù di una frazione sensibile della
   propria altezza, o è nascosto o sta rianimando; in entrambi i casi è il
   difetto. */
const SPLIT_POSE = `
  (() => {
    const out = {};
    for (const [key, sel] of [['widTitle', '.wid__title'], ['stText', '.st__text']]) {
      const el = document.querySelector(sel);
      if (!el) { out[key] = null; continue; }
      const frammenti = Array.from(el.querySelectorAll('div > div'));
      if (!frammenti.length) { out[key] = null; continue; }
      let peggiore = 0;
      for (const f of frammenti) {
        const w = f.parentElement.getBoundingClientRect();
        const r = f.getBoundingClientRect();
        const scarto = Math.abs(r.top - w.top) / Math.max(1, w.height);
        if (scarto > peggiore) peggiore = scarto;
      }
      out[key] = Math.round(peggiore * 1000) / 1000;
    }
    return out;
  })()
`;

/* ⚠ E SERVE UNA PAGINA FRESCA, FERMANDOSI A META'. La prima stesura di questo
   controllo riusava lo stato lasciato da `wheelTo(26)` qui sopra — cioè il
   fondo pagina — ed era verde ANCHE con il difetto in produzione, verificato
   disattivando il fix e ricostruendo. Motivo: arrivare in fondo fa superare
   anche la posizione di FINE dei due trigger, che a quel punto `once` uccide
   davvero; il difetto sparisce da solo proprio perché si è scorso troppo.
   Va riprodotto il gesto vero — scendere QUANTO BASTA a far entrare il titolo,
   fermarsi mentre è ancora in vista, e risalire. Un controllo che non diventa
   rosso sul codice rotto non è un controllo. */
await load(URL_);

const topDi = (sel) =>
  evaluate(
    `(() => { const e = document.querySelector('${sel}'); return e ? Math.round(e.getBoundingClientRect().top) : 99999; })()`
  );

// Si scende a misura, non a numero di tick: la posizione dello statement
// dipende da quante sezioni ci sono sopra, che cambia di continuo.
for (let i = 0; i < 24; i++) {
  await wheelTo(3);
  if ((await topDi('.st__text')) < 400) break;
}
await sleep(1600); // l'ingresso delle parole finisce (0.7s + stagger)

const posaIntegra = (v) => v !== null && v < 0.15;
const entrato = await evaluate(SPLIT_POSE);
ok(
  'M1/M2: fermandosi a meta pagina, gli ingressi sono giocati',
  posaIntegra(entrato.widTitle) && posaIntegra(entrato.stText),
  `scarto max — §01 ${entrato.widTitle} · statement ${entrato.stText}`
);

// Ora il gesto del difetto: tornare su, sopra lo start dei due trigger.
await wheelTo(30, -600);
await sleep(1200);
const risalito = await evaluate(SPLIT_POSE);
ok(
  'M1/M2: risalendo, un ingresso già giocato NON torna alla posa nascosta',
  posaIntegra(risalito.widTitle) && posaIntegra(risalito.stText),
  `scarto max — §01 ${risalito.widTitle} · statement ${risalito.stText} (nascosto ≈ 1.0)`
);

/* Scenario del SALTO, su una pagina appena caricata (Lenis a riposo, altrimenti
   sovrascrive la posizione). Tasto Fine, link ancora, ripristino dello scroll al
   reload: la fascia d'ingresso viene attraversata in un solo update, quindi
   nessun evento di ingresso scatta. Senza la rete di sicurezza in reveal.ts gli
   elementi resterebbero invisibili PER SEMPRE — anche continuando a scorrere.
   È il difetto più grave possibile, ed è il più banale da innescare. */
await load(URL_);
await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight); true`);
await sleep(2400);
const jumped = await evaluate(PROBE);
const jumpedY = await evaluate('Math.round(window.scrollY)');
ok(
  'salto in fondo: nessun contenuto resta invisibile',
  jumpedY > 1000 && jumped.revealOpacities.every((o) => Number(o) > 0.9),
  `scrollY ${jumpedY} · ${jumped.revealOpacities.join(',')}`
);
/* Stesso scenario, sul manifesto: `is-instant` deve azzerare durata E ritardo.
   Il filetto ha 900ms di durata + 1150ms di ritardo e il timbro 700+1900: senza
   l'azzeramento, dopo un salto resterebbero a metà per oltre due secondi — il
   difetto già trovato via CDP su §01 e §02, qui verificato invece che sperato. */
ok(
  'manifesto §04: salto in fondo, i tre elementi già allo stato finale',
  steso(jumped.stRuleTransform) &&
    Number(jumped.stStampOpacity) > 0.9 &&
    Number(jumped.stGhostOpacity) > 0.9,
  `filetto ${jumped.stRuleTransform} · timbro ${jumped.stStampOpacity} · fantasma ${jumped.stGhostOpacity}`
);
/* Stesso scenario su §04 Dicono. Qui il ritardo in gioco è ancora più lungo
   dello statement — la cancellatura ha 760ms di durata dopo 1250ms di attesa,
   tarati per arrivare DOPO che le 16 parole di M2 si sono posate: senza
   `is-instant` che azzera durata E ritardo, dopo un salto la frase resterebbe
   mezza barrata per due secondi, e le card mezze trasparenti. */
if (dicono) {
  ok(
    '§04 Dicono: salto in fondo, cancellatura e colonne già allo stato finale',
    steso(jumped.tsCutTransform) &&
      (muro ? jumped.tsColOpacities : jumped.tsItemOpacities).length > 0 &&
      (muro ? jumped.tsColOpacities : jumped.tsItemOpacities).every((o) => Number(o) > 0.9),
    `cancellatura ${jumped.tsCutTransform} · ${(muro ? jumped.tsColOpacities : jumped.tsItemOpacities).join(',')}`
  );
}
/* §70 CTA sul salto, ed è lo scenario che conta di più per questa sezione: è
   l'ULTIMA della pagina, quindi "salto in fondo" è esattamente dove atterra chi
   premé Fine o ricarica con lo scroll ripristinato. Il conto senza `is-instant`
   sarebbe pesante: le azioni hanno 900ms di durata sopra 560ms di ritardo, cioè
   un bottone mezzo trasparente per un secondo e mezzo — su un bersaglio
   cliccabile, non su una decorazione.
   ⚠ Il ramo "dopo lo scroll normale" NON viene asserito qui di proposito: 26
   tick di rotellina non arrivano con certezza fino all'ultima sezione, e un
   assert che dipende da quanto lontano arriva lo scroll è un assert flaky —
   lo stesso difetto appena corretto sul timbro del manifesto. */
ok(
  '§70 CTA: salto in fondo, righe e azioni già allo stato finale',
  jumped.ctaLineOpacities.length === 4 &&
    jumped.ctaLineOpacities.every((o) => Number(o) > 0.9) &&
    Number(jumped.ctaActionsOpacity) > 0.9,
  `righe ${jumped.ctaLineOpacities.join(',')} · azioni ${jumped.ctaActionsOpacity}`
);
/* ...e ORA le onde devono propagarsi E vedersi: la sezione è stata raggiunta,
   quindi `is-on` è arrivata e `animation-play-state` è passata a `running`. Va
   provato qui e non a pagina appena caricata (dove i due controlli di sopra
   pretendono l'opposto): come il muro di §04, è un'animazione che non dipende né
   dallo scroll né da un tween, quindi senza questo un errore nei keyframes la
   lascerebbe ferma senza che niente diventi rosso.
   ⚠ SI ASPETTA IL RITARDO DI PARTENZA PRIMA DI CAMPIONARE (500ms + margine): il
   ritardo si conta da quando lo stato passa a `running`, quindi campionare
   subito leggerebbe due volte la posa di attesa e riporterebbe "FERMA" per il
   motivo sbagliato. È lo stesso difetto di campionamento già corretto sul timbro
   del manifesto §04.
   ⚠ E SI VERIFICA ANCHE CHE SIA VISIBILE, non solo che si muova: con lo stato
   di attesa a `opacity: 0`, un'animazione che gira senza mai accendersi sarebbe
   in moto e invisibile — cioè verde qui e nera a schermo. */
const waveMotion = await evaluate(`(async () => {
  const el = document.querySelector('.cta__wave');
  if (!el) return 'elemento assente';
  await new Promise((r) => setTimeout(r, 900));
  const a = getComputedStyle(el).transform;
  await new Promise((r) => setTimeout(r, 700));
  if (a === getComputedStyle(el).transform) return 'FERMA ' + a;
  const vis = Array.from(document.querySelectorAll('.cta__wave'))
    .some((w) => Number(getComputedStyle(w).opacity) > 0.05);
  return vis ? 'in moto' : 'IN MOTO MA INVISIBILE';
})()`);
ok(
  '§70 CTA: raggiunta la sezione, le onde partono e si vedono',
  waveMotion === 'in moto',
  waveMotion
);

/* ---- §-1 IL VELO DI PRIMA VISITA (Loader.astro) --------------------------
   Tre invarianti, e la prima è l'unica che conta davvero: UN VELO CHE NON SE
   NE VA È UN SITO INACCESSIBILE. È l'unico elemento del sito che copre tutto
   e che solo il JS sa togliere — la classe di guasto peggiore che questo
   repo possa produrre, molto più di un'animazione che non parte.

   ⚠ Si azzera `vc:seen` e si ricarica, invece di fidarsi di essere al primo
   caricamento della sessione: il velo si mostra UNA VOLTA PER DISPOSITIVO,
   quindi in un profilo già usato dai controlli precedenti non comparirebbe e
   questi assert diventerebbero verdi per assenza di bersaglio — cioè inutili,
   che è il difetto contro cui esiste metà di questo file. */
await evaluate(`try { localStorage.removeItem('vc:seen'); } catch (e) {} true`);

/* ⚠ NON si usa `load()` qui, ed è il punto: quell'aiutante aspetta 2600ms dopo
   la navigazione, mentre il velo su una cache calda vive ~1,8s (DOMContentLoaded
   + MIN_SHOW 1100ms + dissolvenza 520ms). Sondando dopo `load()` il velo se n'è
   già andato e l'assert diventa verde per assenza di bersaglio — successo
   davvero, alla prima stesura. Qui serve guardare MENTRE è in vita. */
await send('Page.navigate', { url: URL_ }, sid);
await sleep(700);

const veloDurante = await evaluate(`
  (() => {
    const v = document.querySelector('[data-loader]');
    const img = document.querySelector('.hero__img');
    return {
      inScena: !!v && getComputedStyle(v).display !== 'none',
      ldOn: document.documentElement.classList.contains('ld-on'),
      heroPlay: img ? getComputedStyle(img).animationPlayState : null,
    };
  })()
`);
ok(
  '§-1 velo: alla prima visita è in scena e TRATTIENE la coreografia della hero',
  veloDurante.inScena && veloDurante.ldOn && veloDurante.heroPlay === 'paused',
  `in scena ${veloDurante.inScena} · ld-on ${veloDurante.ldOn} · hero ${veloDurante.heroPlay}`
);

/* Oltre il MAX_WAIT di loader.ts (4s) più la dissolvenza: da qui in poi non
   esiste nessuno scenario in cui il velo sia ancora legittimamente in piedi. */
await sleep(5200);
const veloDopo = await evaluate(`
  (() => {
    const v = document.querySelector('[data-loader]');
    const img = document.querySelector('.hero__img');
    return {
      nelDom: !!v,
      ldOn: document.documentElement.classList.contains('ld-on'),
      heroPlay: img ? getComputedStyle(img).animationPlayState : null,
      seen: (() => { try { return localStorage.getItem('vc:seen'); } catch (e) { return null; } })(),
    };
  })()
`);
ok(
  '§-1 velo: se ne va, esce dal DOM e LIBERA la coreografia',
  !veloDopo.nelDom && !veloDopo.ldOn && veloDopo.heroPlay === 'running',
  `nel DOM ${veloDopo.nelDom} · ld-on ${veloDopo.ldOn} · hero ${veloDopo.heroPlay}`
);

// Seconda visita: gli asset sono in cache, non c'è più niente da coprire.
await load(URL_);
const veloSeconda = await evaluate(`
  (() => {
    const v = document.querySelector('[data-loader]');
    return {
      visibile: !!v && getComputedStyle(v).display !== 'none',
      ldOn: document.documentElement.classList.contains('ld-on'),
    };
  })()
`);
ok(
  '§-1 velo: alla seconda visita non si rivede (una volta per dispositivo)',
  !veloSeconda.visibile && !veloSeconda.ldOn,
  `visibile ${veloSeconda.visibile} · ld-on ${veloSeconda.ldOn} · seen=${veloDopo.seen}`
);

/* ---- 2. Reduced motion -------------------------------------------------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
/* ⚠ `vc:seen` va azzerato di nuovo QUI: lo scenario del velo qui sopra l'ha
   riscritto uscendo di scena, e senza questo l'assert sul velo nel ramo reduce
   sarebbe verde perché "già visto" invece che perché il movimento è ridotto —
   verde per il motivo sbagliato, cioè un controllo che non controlla niente. */
await evaluate(`try { localStorage.removeItem('vc:seen'); } catch (e) {} true`);
await load(URL_);
const r = await evaluate(PROBE);
console.log('\n--- prefers-reduced-motion: reduce ---');
console.log(JSON.stringify({ jsAnimClass: r.jsAnimClass, lenisSmooth: r.lenisSmooth, splitLineDivs: r.splitLineDivs, revealOpacities: r.revealOpacities }, null, 2));
ok('reduce: nessuna classe js-anim', r.jsAnimClass === false);
/* Il velo è tempo di attesa costruito, e chi chiede meno movimento non deve
   attraversarlo: lo script inline in <head> non aggiunge `ld-on` in questo
   ramo. `vc:seen` è stato azzerato apposta appena sopra, quindi qui si misura
   davvero il gate del movimento e non il ricordo di una visita precedente. */
const veloReduce = await evaluate(`
  (() => {
    const v = document.querySelector('[data-loader]');
    return !!v && getComputedStyle(v).display !== 'none';
  })()
`);
ok('reduce: il velo di prima visita non compare mai', veloReduce === false, `visibile ${veloReduce}`);
ok('reduce: Lenis NON istanziato', r.lenisSmooth === false);
ok('reduce: nessuno split', r.splitLineDivs === 0 || r.splitLineDivs === -1, `${r.splitLineDivs}`);
ok('reduce: contenuto tutto visibile', r.revealOpacities.every((o) => Number(o) > 0.9), r.revealOpacities.join(','));
ok(
  'reduce: manifesto §04 già completo (filetto, timbro, fantasma)',
  steso(r.stRuleTransform) &&
    Number(r.stStampOpacity) > 0.9 &&
    Number(r.stGhostOpacity) > 0.9,
  `filetto ${r.stRuleTransform} · timbro ${r.stStampOpacity} · fantasma ${r.stGhostOpacity}`
);
const rVis = muro ? r.tsColOpacities : r.tsItemOpacities;
if (dicono) {
  ok(
    `§04 Dicono: reduce, cancellatura già tirata e ${muro ? 'colonne' : 'righe'} visibili`,
    steso(r.tsCutTransform) && rVis.length > 0 && rVis.every((o) => Number(o) > 0.9),
    `cancellatura ${r.tsCutTransform} · ${rVis.join(',')}`
  );
}
/* ⚠ L'INVARIANTE CHE IL BLOCCO REDUCE DEDICATO IN Testimonials.astro ESISTE PER
   GARANTIRE, e va provato perché la regola globale di global.css NON basta: quella
   porta `animation-iteration-count` a 1, che per un marquee non è uno stop — è
   "fai un giro solo", cioè quaranta secondi di scorrimento comunque. Chi chiede
   meno movimento non chiede "meno ripetizioni", chiede fermo. Due campioni a
   distanza: la traccia non si deve muovere di un pixel.
   Ed è anche il controllo che sorveglia la trappola di specificità già costata un
   errore sul cielo della CTA: se il blocco reduce non ripete il gate
   `html.js-anim`, perde nella cascata e questo assert diventa rosso. */
if (muro) {
  const wallStill = await evaluate(`(async () => {
    const el = document.querySelector('.ts__track');
    if (!el) return 'elemento assente';
    const a = getComputedStyle(el).transform;
    await new Promise((r) => setTimeout(r, 700));
    return a === getComputedStyle(el).transform ? 'fermo' : 'ANCORA IN MOTO';
  })()`);
  ok('§04 muro: reduce, è fermo', wallStill === 'fermo', wallStill);
}
ok(
  '§70 CTA: reduce, righe e azioni immediatamente visibili',
  r.ctaLineOpacities.length === 4 &&
    r.ctaLineOpacities.every((o) => Number(o) > 0.9) &&
    Number(r.ctaActionsOpacity) > 0.9,
  `righe ${r.ctaLineOpacities.join(',')} · azioni ${r.ctaActionsOpacity}`
);
/* Il glow è l'unica animazione in LOOP della CTA (quarta eccezione dichiarata
   alla regola "ogni animazione una volta sola"), e sotto reduced-motion deve
   fermarsi. Non lo fa una regola del componente: lo fa la regola globale in
   global.css (`animation-iteration-count: 1 !important`). Verificarlo qui
   significa verificare che quella regola COPRA davvero questo caso, invece di
   dare per scontato che valga — è la stessa ragione per cui `.tli__now` non
   dichiara un proprio blocco reduce. */
ok(
  '§70 CTA: reduce, il respiro del glow non va in loop',
  r.ctaGlowIterations === '1',
  `animation-iteration-count: ${r.ctaGlowIterations}`
);
/* ⚠ L'INVARIANTE PIÙ IMPORTANTE DEL CIELO, e il difetto che il blocco reduce
   dedicato in CTASection esiste per impedire: la regola globale porta le
   iterazioni a 1, e il fotogramma finale dell'onda è `opacity: 0`. Senza quel
   blocco, con movimento ridotto la CTA perderebbe interamente il proprio fondo
   e resterebbe un rettangolo nero — cioè l'utente che chiede MENO movimento
   riceverebbe anche MENO design, che non è il patto. Le onde devono essere
   ferme E visibili. */
ok(
  '§70 CTA: reduce, il cielo resta visibile (non collassa a nero)',
  r.ctaWaveOpacities.length === 5 && r.ctaWaveOpacities.every((o) => Number(o) > 0.1),
  `onde ${r.ctaWaveOpacities.join(',')}`
);
const waveStill = await evaluate(`(async () => {
  const el = document.querySelector('.cta__wave');
  if (!el) return 'elemento assente';
  const a = getComputedStyle(el).transform;
  await new Promise((r) => setTimeout(r, 700));
  return a === getComputedStyle(el).transform ? 'ferma' : 'ANCORA IN MOTO';
})()`);
ok('§70 CTA: reduce, le onde sono ferme', waveStill === 'ferma', waveStill);

/* ---- 3. JS disattivato -------------------------------------------------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, sid);
await send('Emulation.setScriptExecutionDisabled', { value: true }, sid);
await load(URL_);
const nj = await evaluate(PROBE); // non eseguirà: usiamo il DOM via CSS
const noJs = await send('Runtime.evaluate', { expression: '1', returnByValue: true }, sid);
// Con JS disabilitato non possiamo valutare: leggiamo l'HTML servito invece.
await send('Emulation.setScriptExecutionDisabled', { value: false }, sid);
const html = await (await fetch(URL_)).text();
ok('senza JS: nessun data-reveal pre-nascosto in HTML', !/style="[^"]*opacity:\s*0/.test(html));
/* ⚠ ERA `html.includes('non scrivo solo')`, che è una riga di WhatIDo (§01) e
   NON lo statement: il controllo era verde da sempre per il motivo sbagliato —
   avrebbe continuato a passare con la sezione statement cancellata dalla pagina.
   Ora si misura ciò che dice di misurare: le due metà del manifesto (premessa
   smorzata + conseguenza) e il timbro editoriale, tutti nell'HTML servito. */
ok(
  "senza JS: il manifesto §04 è tutto nell'HTML",
  html.includes('Non sono il più esperto della stanza.') &&
    html.includes('non smette di studiare') &&
    html.includes('Statement 04'),
  'premessa + accento + timbro'
);
ok('senza JS: il titolo hero è nell\'HTML', html.includes('Ciao.') && html.includes('Entra'));
/* §04 Dicono senza JS: i TRE registri del titolo più il contenuto di una card.
   La frase è l'unica cosa che passa la parola alle testimonianze, quindi se un
   crawler (o un browser con JS rotto) vede le card senza la frase che le
   introduce, la sezione ha perso il suo senso e non solo la sua animazione. */
if (dicono) {
  ok(
    "senza JS: §04 Dicono è tutto nell'HTML",
    html.includes('Se ancora non ti ho convinto') &&
      html.includes('non ascoltare me.') &&
      html.includes('Ascolta loro:') &&
      html.includes('Gli ho descritto il problema male'),
    'titolo (3 registri) + citazione'
  );
} else {
  /* ⚠ L'assert SPECULARE, e non è una formalità: con la sezione spenta il
     requisito si capovolge — quel contenuto non deve stare NELL'HTML, o
     vorrebbe dire che il feature flag nasconde solo via CSS ciò che continua a
     essere servito (e quindi indicizzato, e letto da uno screen reader). */
  ok(
    "senza JS: §04 Dicono spenta non lascia contenuto nell'HTML",
    !html.includes('Ascolta loro:') && !html.includes('Gli ho descritto il problema male'),
    'nessun residuo di testimonianze nel markup servito'
  );
}
/* §70 CTA senza JS: TUTTE E QUATTRO le righe più i quattro canali. La CTA è il
   solo punto della Home da cui si può agire: se il JS non parte e resta un muro
   di testo senza modi di rispondere, la pagina è un vicolo cieco — che è il
   difetto peggiore possibile proprio sull'ultima sezione. */
ok(
  "senza JS: §70 CTA è tutta nell'HTML, canali compresi",
  html.includes('le opzioni sono due:') &&
    html.includes('o ti piace molto come ho fatto questo sito,') &&
    html.includes('una mano con il tuo progetto.') &&
    html.includes('Nel secondo caso, io sono pronto.') &&
    html.includes('Parliamone') &&
    html.includes('mailto:') &&
    html.includes('wa.me/') &&
    html.includes('linkedin.com'),
  '4 righe + form + mailto + WhatsApp + LinkedIn'
);

/* ---- esito -------------------------------------------------------------- */
console.log('\n================ ESITO ================');
let bad = 0;
for (const t of results) {
  if (!t.pass) bad++;
  console.log(`  ${t.pass ? 'OK  ' : 'FAIL'} ${t.name}${t.detail ? '  [' + t.detail + ']' : ''}`);
}
console.log(bad === 0 ? '\nTutti i controlli superati.' : `\n${bad} controlli FALLITI.`);

ws.close();
chrome.kill();
/* ⚠ L'USCITA È RINVIATA DI UN GIRO DI TIMER, e non è scaramanzia: `process.exit()`
   subito dopo `ws.close()` faceva morire questo strumento con
   `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ... src\win\async.c` e
   codice di uscita 9 — SEMPRE, anche con tutti i controlli verdi. La causa è la
   chiusura di libuv ancora in corso su handle asincroni (la stretta di mano del
   WebSocket e il socket keep-alive che `fetch` lascia aperto nel controllo
   "senza JS") interrotta a metà dall'uscita immediata.
   Perché valeva la pena sistemarlo: `npm run verify:anim` riportava un
   fallimento a prescindere dall'esito, e uno strumento che è sempre rosso
   insegna a ignorare quello che dice — la stessa ragione per cui in questi file
   non si asserisce mai il valore di un design token. Un tick di ritardo lascia a
   libuv il tempo di chiudere, e il codice di uscita torna a significare
   qualcosa. */
setTimeout(() => process.exit(bad === 0 ? 0 : 1), 150);
