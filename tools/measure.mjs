/**
 * Misura il layout reale in Chrome via CDP.
 * Uso: node measure.mjs <url> <width> <height> [screenshot.png]
 * Selettori da ispezionare: variabile d'ambiente SELECTORS, separati da virgola.
 *   SELECTORS='.tl__rail,.tli__year' node tools/measure.mjs http://... 1440 900
 *
 * Serve perché "sembra che vada oltre" non è una diagnosi: qui si leggono
 * scrollWidth, clientWidth e i rect degli elementi che possono sfondare.
 */
import { spawn } from 'node:child_process';

const [url = 'http://localhost:4321/', W = '390', H = '844'] = process.argv.slice(2);

const DEFAULT_SELECTORS = [
  '.hero__grid',
  '.hero__body',
  '.hero__title',
  '.hero__lede',
  '.hero__figure',
  '.hero__img',
  '.hero__actions',
];
const SELECTORS = process.env.SELECTORS
  ? process.env.SELECTORS.split(',').map((s) => s.trim())
  : DEFAULT_SELECTORS;
const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${W},${H}`,
    '--user-data-dir=' + process.env.TEMP + '/cdp-profile-' + PORT,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome non risponde su CDP');
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

// Attacca una sessione a un target di pagina
const { result: targets } = await send('Target.getTargets');
const page = targets.targetInfos.find((t) => t.type === 'page');
const { result: attached } = await send('Target.attachToTarget', {
  targetId: page.targetId,
  flatten: true,
});
const sid = attached.sessionId;

await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send(
  'Emulation.setDeviceMetricsOverride',
  { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 },
  sid
);

/* REDUCE=1 emula `prefers-reduced-motion: reduce`. Serve per ispezionare una
   pagina intera: nel ramo normale gli elementi `data-reveal` sotto la piega
   sono a opacità 0 in attesa dello scroll, quindi uno screenshot full-page
   mostrerebbe pagina vuota. Nel ramo reduce il JS li rende tutti visibili nella
   posizione finale — che è esattamente lo stato di layout da giudicare. */
if (process.env.REDUCE) {
  await send(
    'Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    sid
  );
}

await send('Page.navigate', { url }, sid);
await sleep(2500);

/* WHEEL=<n> manda n scrollate di rotellina prima di misurare. Serve per gli
   elementi animati allo scroll: `window.scrollTo` non va bene perché Lenis
   intercetta lo scroll e la posizione programmatica litiga con la sua
   interpolazione, mentre un evento wheel è ciò che Lenis si aspetta davvero. */
/* JUMP=<px|bottom> salta la posizione invece di scorrerla. Non è un modo comodo
   di scrollare: è uno SCENARIO da testare a parte, perché succede davvero — link
   ancora, tasto Fine, ripristino della posizione al reload — e un elemento
   ancora a opacità 0 dopo un salto è contenuto invisibile, cioè il peggior modo
   di rompersi. */
if (process.env.JUMP) {
  const target =
    process.env.JUMP === 'bottom' ? 'document.documentElement.scrollHeight' : process.env.JUMP;
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${target})` }, sid);
  await sleep(2200);
}

const wheels = Number(process.env.WHEEL ?? 0);
for (let i = 0; i < wheels; i++) {
  await send(
    'Input.dispatchMouseEvent',
    { type: 'mouseWheel', x: +W / 2, y: +H / 2, deltaX: 0, deltaY: 400 },
    sid
  );
  await sleep(120);
}
if (wheels) await sleep(1200); // lascia finire l'interpolazione di Lenis

const expr = `(() => {
  const de = document.documentElement;
  const out = {
    viewport: innerWidth + 'x' + innerHeight,
    scrollY: Math.round(window.scrollY),
    docHeight: de.scrollHeight,
    docScrollWidth: de.scrollWidth,
    docClientWidth: de.clientWidth,
    overflowX: de.scrollWidth - de.clientWidth,
    offenders: [],
    boxes: {},
  };
  // Chi sfonda a destra?
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > de.clientWidth + 1) {
      out.offenders.push({
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  }
  for (const sel of ${JSON.stringify(SELECTORS)}) {
    // querySelectorAll: per i componenti ripetuti (voci di timeline, card) il
    // dato utile è se TUTTE le occorrenze sono allineate, non solo la prima.
    document.querySelectorAll(sel).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out.boxes[sel + (i ? '[' + i + ']' : '')] = {
        w: Math.round(r.width), h: Math.round(r.height),
        left: Math.round(r.left), right: Math.round(r.right),
        // Offset nel DOCUMENTO, non nella viewport: è quello che serve per
        // sapere a che scroll si trova una sezione.
        docTop: Math.round(r.top + window.scrollY),
        maxW: cs.maxWidth, fs: cs.fontSize,
        // Il transform calcolato: serve per i filetti animati, dove l'altezza
        // misurata è 0 a scaleY(0) e il dato utile è la matrice.
        tf: cs.transform,
        op: cs.opacity,
        vis: cs.visibility,
      };
    });
  }
  return JSON.stringify(out, null, 2);
})()`;

const { result } = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sid);
console.log(result.result.value ?? JSON.stringify(result));

/* Screenshot tramite CDP e non tramite --screenshot: il flag della CLI su
   Windows non applica davvero la viewport di --window-size e restituisce un
   ritaglio di un layout più largo, che simula un overflow inesistente.
   Page.captureScreenshot rispetta setDeviceMetricsOverride. */
const shotPath = process.argv[5];
if (shotPath) {
  const { result: shot } = await send(
    'Page.captureScreenshot',
    // FULLPAGE=1 cattura oltre la viewport: l'intera pagina in un'immagine.
    { format: 'png', captureBeyondViewport: Boolean(process.env.FULLPAGE) },
    sid
  );
  const { writeFileSync } = await import('node:fs');
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('\nscreenshot -> ' + shotPath);
}

ws.close();
chrome.kill();
process.exit(0);
