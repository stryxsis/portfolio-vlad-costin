/**
 * Misura il layout reale in Chrome via CDP.
 * Uso: node measure.mjs <url> <width> <height>
 *
 * Serve perché "sembra che vada oltre" non è una diagnosi: qui si leggono
 * scrollWidth, clientWidth e i rect degli elementi che possono sfondare.
 */
import { spawn } from 'node:child_process';

const [url = 'http://localhost:4321/', W = '390', H = '844'] = process.argv.slice(2);
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
await send('Page.navigate', { url }, sid);
await sleep(2500);

const expr = `(() => {
  const de = document.documentElement;
  const out = {
    viewport: innerWidth + 'x' + innerHeight,
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
  for (const sel of ['.hero__grid', '.hero__body', '.hero__title', '.hero__lede', '.hero__figure', '.hero__img', '.hero__actions']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.boxes[sel] = {
      w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
      maxW: cs.maxWidth, fs: cs.fontSize,
    };
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
  const { result: shot } = await send('Page.captureScreenshot', { format: 'png' }, sid);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('\nscreenshot -> ' + shotPath);
}

ws.close();
chrome.kill();
process.exit(0);
