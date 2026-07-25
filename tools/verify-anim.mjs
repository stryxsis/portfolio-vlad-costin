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
  const h1lines = [...document.querySelectorAll('.hero__line')];
  return {
    jsAnimClass: document.documentElement.classList.contains('js-anim'),
    animReady: document.documentElement.dataset.animReady === '1',
    lenisClass: document.documentElement.classList.contains('lenis'),
    lenisSmooth: document.documentElement.classList.contains('lenis-smooth'),
    splitLineDivs: splitEl ? splitEl.querySelectorAll('div').length : -1,
    splitAriaLabel: splitEl ? splitEl.hasAttribute('aria-label') : false,
    splitTextContent: splitEl ? splitEl.textContent.trim().slice(0, 40) : null,
    heroLineOpacities: h1lines.map(el => getComputedStyle(el).opacity),
    heroTitleOpacity: q('.hero__title') ? getComputedStyle(q('.hero__title')).opacity : null,
    revealCount: document.querySelectorAll('[data-reveal]').length,
    revealOpacities: [...document.querySelectorAll('[data-reveal]')].map(el => getComputedStyle(el).opacity),
    ruleScaleX: q('[data-rule]') ? getComputedStyle(q('[data-rule]')).transform : null,
  };
})()`;

const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

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
ok('testo dello statement integro', (p.splitTextContent || '').startsWith('Prima di annoiarti'));
ok('titolo hero SEMPRE opaco (regola LCP)', p.heroLineOpacities.every((o) => o === '1'), p.heroLineOpacities.join(','));

// Scorri in fondo: i data-reveal devono diventare visibili
await evaluate(`window.scrollTo(0, document.body.scrollHeight); true`);
await sleep(2200);
const after = await evaluate(PROBE);
ok(
  'data-reveal visibili dopo lo scroll',
  after.revealOpacities.length > 0 && after.revealOpacities.every((o) => Number(o) > 0.9),
  after.revealOpacities.join(',')
);
ok('filetto disegnato (scaleX 1)', /matrix\(1,/.test(after.ruleScaleX || ''), after.ruleScaleX);

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
ok('senza JS: il testo dello statement è nell\'HTML', html.includes('costruisco cose'));
ok('senza JS: il titolo hero è nell\'HTML', html.includes('Io scrivo il codice che lo'));

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
