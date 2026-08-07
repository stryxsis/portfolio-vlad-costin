/**
 * CONTRASTO SUI PIXEL REALI, non sui token.
 *
 * uso:  node tools/sample-px.mjs <url> [w] [h]
 * env:  SELECTORS='.foot__label,.cv__meta'   elementi di cui verificare il testo
 *       POINTS='1300,120;300,120'            punti extra, letti e basta
 *       SCROLL='bottom' | '<px>' | '<sel>'   dove portare la pagina prima di leggere
 *       REDUCE=1                             emula prefers-reduced-motion
 *
 * ⚠ PERCHÉ ESISTE, visto che `verify-anim.mjs` calcola già dei contrasti.
 * Quello legge i COLORI DICHIARATI (`getComputedStyle`) e risale il DOM finché
 * non trova un fondo non trasparente. Funziona finché il fondo è un colore
 * pieno; smette di funzionare nel momento in cui sotto il testo c'è un
 * GRADIENTE, una foto o due strati sovrapposti — casi in cui `background-color`
 * è `transparent` su ogni antenato e il valore che conta non è dichiarato da
 * nessuna parte. Da lì in poi l'unica misura onesta è il pixel dipinto.
 *
 * ⚠ IL PNG LO DECODIFICA CHROME. Lo screenshot torna in base64 da CDP; invece di
 * scrivere un decoder PNG a mano (inflate + un-filter delle scanline) lo si
 * rimanda dentro alla pagina come data URL, si disegna su un <canvas> e si legge
 * `getImageData`. Il decoder più affidabile in circolazione è già lì aperto.
 *
 * ⚠ SI CAMPIONA IL FONDO ACCANTO AL TESTO, NON SOTTO. Sotto ci sono i glifi:
 * un pixel preso a caso dentro la riga può cadere su un'asta e restituire il
 * colore del testo invece che quello del fondo. Si leggono tre punti appena a
 * sinistra della scatola e si tiene il PIÙ CHIARO — cioè il caso peggiore per
 * del testo chiaro su fondo scuro, che è la situazione di tutto questo sito.
 *
 * Nato il 2026-08-07 col bagliore del footer, e in un solo giro ha trovato due
 * difetti veri che a occhio non si vedevano: uno scalino di luminanza di 2,5:1
 * sulla cucitura CTA→footer, e le label del footer scese a 3,38:1 (sotto AA) per
 * colpa del gradiente che ci era finito sotto.
 */
import { spawn } from 'node:child_process';

const URL_ = process.argv[2] ?? 'http://localhost:4321/';
const W = Number(process.argv[3] ?? 1440);
const H = Number(process.argv[4] ?? 900);
const PORT = 9422;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SELECTORS = (process.env.SELECTORS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const POINTS = (process.env.POINTS ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => p.split(',').map(Number));

const chrome = spawn(
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--user-data-dir=' + process.env.TEMP + '/cdp-px-' + PORT,
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
    const n = ++id;
    pending.set(n, (m) => res(m.result));
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });

const { targetInfos } = await send('Target.getTargets');
const page = targetInfos.find((t) => t.type === 'page');
const { sessionId: sid } = await send('Target.attachToTarget', {
  targetId: page.targetId,
  flatten: true,
});
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send(
  'Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 },
  sid
);
if (process.env.REDUCE) {
  await send(
    'Emulation.setEmulatedMedia',
    { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
    sid
  );
}

const ev = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid))
    ?.result?.value;

await send('Page.navigate', { url: URL_ }, sid);
await sleep(3500);

const scroll = process.env.SCROLL;
if (scroll === 'bottom') {
  await ev('window.scrollTo(0, document.documentElement.scrollHeight)');
} else if (scroll && /^\d+$/.test(scroll)) {
  await ev(`window.scrollTo(0, ${scroll})`);
} else if (scroll) {
  /* Posizione STATICA e non `rect.top`: se il bersaglio è sticky, `rect.top`
     resta 0 su un intero intervallo di scroll e converge a metà transizione. */
  await ev(
    `(() => { let el = document.querySelector('${scroll}'), y = 0;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      window.scrollTo(0, y); })()`
  );
}
await sleep(1400);

/* Colore dichiarato, corpo, peso e posizione di ogni bersaglio. Corpo e peso
   servono a scegliere la soglia WCAG giusta: 3:1 vale SOLO per il testo grande
   (≥24px, o ≥18.66px se in grassetto), 4.5:1 per tutto il resto. Applicare 3:1
   a una label mono da 11px è il modo più comune di dichiararsi conformi senza
   esserlo. */
const targets = JSON.parse(
  await ev(`(() => {
    const out = [];
    for (const sel of ${JSON.stringify(SELECTORS)}) {
      document.querySelectorAll(sel).forEach((el, i) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        const cs = getComputedStyle(el);
        out.push({
          sel: sel + (i ? '[' + i + ']' : ''),
          testo: (el.textContent || '').trim().slice(0, 26),
          color: cs.color,
          px: parseFloat(cs.fontSize),
          peso: parseInt(cs.fontWeight, 10) || 400,
          x: Math.round(b.x), y: Math.round(b.y),
          w: Math.round(b.width), h: Math.round(b.height),
        });
      });
    }
    return JSON.stringify(out);
  })()`)
);

const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);

/* Tre sonde per bersaglio, appena fuori dal bordo sinistro. Vedi la nota in
   testa: dentro la scatola si rischia di leggere un glifo. */
const probes = [];
for (const t of targets) {
  for (const dy of [0.25, 0.5, 0.75]) {
    probes.push({ owner: t.sel, x: Math.max(1, t.x - 5), y: Math.round(t.y + t.h * dy) });
  }
}
for (const [x, y] of POINTS) probes.push({ owner: null, x, y });

const letti = JSON.parse(
  await ev(`new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      res(JSON.stringify(${JSON.stringify(probes)}.map((p) => {
        const d = g.getImageData(
          Math.min(Math.max(p.x, 0), c.width - 1),
          Math.min(Math.max(p.y, 0), c.height - 1), 1, 1).data;
        return { ...p, rgb: [d[0], d[1], d[2]] };
      })));
    };
    img.onerror = () => res('[]');
    img.src = 'data:image/png;base64,${shot.data}';
  })`)
);

const srgb = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrasto = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const parseRgb = (s) => (s.match(/\d+/g) ?? [0, 0, 0]).slice(0, 3).map(Number);

console.log(`\n=== CONTRASTO SUI PIXEL REALI — ${URL_} @ ${W}x${H} ===`);
let falliti = 0;
for (const t of targets) {
  const mie = letti.filter((p) => p.owner === t.sel);
  if (mie.length === 0) continue;
  /* Il fondo PIÙ CHIARO fra le sonde: caso peggiore per del testo chiaro. */
  const peggiore = mie.reduce((a, b) => (lum(a.rgb) > lum(b.rgb) ? a : b));
  const grande = t.px >= 24 || (t.px >= 18.66 && t.peso >= 700);
  const soglia = grande ? 3 : 4.5;
  const r = contrasto(parseRgb(t.color), peggiore.rgb);
  const esito = r >= soglia ? 'OK  ' : 'FAIL';
  if (r < soglia) falliti++;
  console.log(
    `  ${esito} ${t.sel.padEnd(22)} "${t.testo}"\n` +
      `       testo ${hex(parseRgb(t.color))} su ${hex(peggiore.rgb)} — ` +
      `${r.toFixed(2)}:1 (serve ${soglia}, ${Math.round(t.px)}px/${t.peso})`
  );
}
const extra = letti.filter((p) => p.owner === null);
if (extra.length > 0) {
  console.log('\n  punti letti:');
  for (const p of extra) console.log(`    (${p.x},${p.y}) ${hex(p.rgb)}  L=${lum(p.rgb).toFixed(4)}`);
}
console.log(
  falliti === 0
    ? '\nNessun contrasto sotto soglia.'
    : `\n${falliti} SOTTO SOGLIA.`
);

ws.close();
chrome.kill();
/* Uscita rinviata di un tick: vedi la nota in fondo a verify-anim.mjs — libuv
   asserisce se `process.exit()` interrompe la chiusura degli handle asincroni. */
setTimeout(() => process.exit(falliti === 0 ? 0 : 1), 150);
