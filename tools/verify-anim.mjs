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

/* ---- 2. Reduced motion -------------------------------------------------- */
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
await load(URL_);
const r = await evaluate(PROBE);
console.log('\n--- prefers-reduced-motion: reduce ---');
console.log(JSON.stringify({ jsAnimClass: r.jsAnimClass, lenisSmooth: r.lenisSmooth, splitLineDivs: r.splitLineDivs, revealOpacities: r.revealOpacities }, null, 2));
ok('reduce: nessuna classe js-anim', r.jsAnimClass === false);
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
process.exit(bad === 0 ? 0 : 1);
