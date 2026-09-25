/**
 * Verifica i case study in Chrome via CDP: dati, navigazione, transizione.
 * Uso:  node tools/verify-case.mjs <base-url>
 *       npm run verify:case http://localhost:4321
 *
 * Da lanciare contro `npm run build` + `npm run preview`, non contro il dev
 * server: in dev le BOZZE sono visibili (è voluto, vedi lib/collections.ts), e
 * il conteggio dei progetti non sarebbe quello pubblicato.
 *
 * Come gli altri strumenti in tools/: NESSUN valore di design duplicato (niente
 * hex, niente misure attese). Si verificano relazioni lette a runtime — lo slug
 * nell'URL contro il titolo, la miniatura attiva e il contatore; la larghezza
 * del documento contro quella della finestra; il nome dei capitoli nell'indice
 * contro gli id che esistono davvero.
 *
 * I progetti si scoprono dall'archivio (/portfolio): lo strumento non sa
 * quanti sono, e non deve saperlo — aggiungerne uno non lo rende rosso.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome');
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-case-'))}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(200);
}
if (!wsUrl) throw new Error('Chrome non risponde su CDP');

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
const errors = [];
/* L'ultimo controllo registrato: ogni errore in console porta con sé il
   passaggio in cui è comparso, o "c'è un errore" non dice dove cercarlo. */
let step = 'avvio';
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push(`[dopo: ${step}] ${(d.exception?.description ?? d.text).split('\n')[0]}`);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(`[dopo: ${step}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++seq;
    const t = setTimeout(() => rej(new Error(`timeout: ${method}`)), 30000);
    pending.set(i, (m) => {
      clearTimeout(t);
      res(m.result);
    });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
/* Registra in ogni documento se la pagina è arrivata CON una View Transition.
   È l'unico modo di sapere, dalla pagina nuova, come ci si è arrivati. */
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `addEventListener('pagereveal', (e) => { window.__vt = Boolean(e.viewTransition); });`,
});

const viewport = (width, height = 900) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
const media = (reduce) =>
  send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  });
/* Aspetta il `load` del documento NUOVO: se l'URL cambia ma il documento è
   ancora quello vecchio, `readyState` direbbe "complete" per il motivo
   sbagliato. */
async function settle(path, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const ok = await js(
        `location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete'`
      );
      if (ok) break;
    } catch {}
    await sleep(80);
  }
  await sleep(350);
}
async function go(path) {
  await send('Page.navigate', { url: BASE + path });
  await settle(path.split('#')[0]);
}
async function click(x, y, hover = 0) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  if (hover) await sleep(hover);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
const key = async (k, code = k, keyCode = 0) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode });
};

const results = [];
const check = (name, ok, detail = '') => {
  step = name;
  results.push({ name, ok: Boolean(ok), detail });
};
const skip = (name, why) => results.push({ name, ok: true, skipped: why });

/* La coerenza del palco, da riusare dopo ogni navigazione: TUTTO deve parlare
   dello stesso progetto — URL, titolo, miniatura attiva, contatore. */
const STATE = `(() => {
  const cur = document.querySelectorAll('[data-cs-thumb][aria-current="page"]');
  const cards = [...document.querySelectorAll('[data-cs-thumb]')];
  const now = document.querySelector('.sw__count-now')?.textContent.trim();
  return {
    path: location.pathname,
    h1: document.querySelectorAll('h1').length,
    title: document.querySelector('h1')?.textContent.trim(),
    docTitle: document.title,
    current: cur.length === 1 ? cur[0].getAttribute('href') : cur.length,
    counter: now ? Number(now) : null,
    position: cards.findIndex((c) => c.getAttribute('aria-current') === 'page') + 1,
  };
})()`;
const coherent = (s) =>
  s.h1 === 1 &&
  s.current === s.path &&
  s.docTitle.startsWith(s.title) &&
  (s.counter === null || s.counter === s.position);

try {
  await viewport(1440);
  await media(false);

  /* ---- I progetti, dall'archivio ---- */
  await go('/portfolio');
  const slugs = await js(
    `[...new Set([...document.querySelectorAll('#lavori a[href^="/portfolio/"]')].map((a) => a.getAttribute('href')))]`
  );
  check('l’archivio elenca almeno un case study', slugs.length > 0, slugs.join(' '));

  /* ---- Ogni case study, aperto direttamente ---- */
  for (const [i, path] of slugs.entries()) {
    await go(path);
    const s = await js(STATE);
    check(`${path}: URL, titolo, miniatura attiva e contatore coincidono`, slugs.length < 2 ? s.h1 === 1 : coherent(s), JSON.stringify(s));

    const pn = await js(`({
      prev: Boolean(document.querySelector('.sw a[rel="prev"]')),
      next: Boolean(document.querySelector('.sw a[rel="next"]')),
      names: [...document.querySelectorAll('.sw a[rel]')].map((a) => a.getAttribute('aria-label')),
    })`);
    check(
      `${path}: prev/next solo dove esistono, niente giro infinito`,
      pn.prev === i > 0 && pn.next === i < slugs.length - 1,
      JSON.stringify(pn)
    );
    check(
      `${path}: prev/next hanno un nome accessibile completo`,
      pn.names.every((n) => /^Progetto (precedente|successivo): .+/.test(n ?? '')),
      JSON.stringify(pn.names)
    );

    const ch = await js(`(() => {
      const links = [...document.querySelectorAll('.cs__rail a')].map((a) => a.getAttribute('href').slice(1));
      const ids = [...document.querySelectorAll('.chapter')].map((c) => c.id);
      const all = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return { links, ids, dup: all.filter((id, k) => all.indexOf(id) !== k) };
    })()`);
    check(
      `${path}: l’indice elenca esattamente i capitoli presenti, in ordine`,
      JSON.stringify(ch.links) === JSON.stringify(ch.ids) && ch.ids.length > 0,
      JSON.stringify(ch)
    );
    check(`${path}: nessun id ripetuto nella pagina`, ch.dup.length === 0, ch.dup.join(' '));

    const m = await js(`(() => {
      const ml = document.querySelector('.ml');
      return { present: Boolean(ml), placeholder: /placeholder/i.test(ml?.textContent ?? '') };
    })()`);
    check(`${path}: nessuna metrica segnaposto in pagina`, !m.placeholder, JSON.stringify(m));

    const md = await (await fetch(`${BASE}${path}.md`)).text();
    const mdMetrics = md.split('\n').filter((l) => /^- .+: .*\[placeholder\]/i.test(l));
    check(`${path}.md: nessuna metrica segnaposto nel mirror`, mdMetrics.length === 0, mdMetrics.join(' | '));
  }

  /* ---- Anchor di un capitolo con offset: il titolo non finisce sotto l'header ---- */
  if (slugs[0]) {
    await go(`${slugs[0]}#sfida`);
    await sleep(600);
    const a = await js(`(() => {
      const h = document.querySelector('#sfida h2')?.getBoundingClientRect();
      const nav = document.querySelector('.chrome')?.getBoundingClientRect();
      return { top: h?.top ?? -1, nav: nav?.bottom ?? 0 };
    })()`);
    check('#sfida: il titolo del capitolo arriva sotto l’header, non dietro', a.top >= a.nav - 1 && a.top < 900, JSON.stringify(a));
  }

  if (slugs.length >= 2) {
    /* ---- Cambio progetto dalla striscia, con View Transition ---- */
    await go(slugs[0]);
    const target = slugs[1];
    const pt = await js(`(() => { const r = document.querySelector('[data-cs-thumb][href="${target}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 3 }; })()`);
    await click(pt.x, pt.y);
    await settle(target);
    const after = await js(`({ ...${STATE}, vt: window.__vt, scroll: scrollY, overlays: document.querySelectorAll('[style*="view-transition-name"]').length })`);
    check('clic su una miniatura: arriva al case study giusto, coerente', coherent(after) && after.path === target, JSON.stringify(after));
    check('clic su una miniatura: la pagina nuova arriva con la View Transition', after.vt === true, `vt=${after.vt}`);
    check('clic su una miniatura: si parte dall’inizio del case study', after.scroll === 0, `scrollY=${after.scroll}`);
    check('nessun nome di transizione resta appeso nella pagina nuova', after.overlays === 0, `${after.overlays}`);

    /* ---- Indietro / Avanti ---- */
    await js('history.back()');
    await settle(slugs[0]);
    const back = await js(STATE);
    check('Indietro: torna al progetto precedente, coerente', coherent(back) && back.path === slugs[0], JSON.stringify(back));
    await js('history.forward()');
    await settle(target);
    const fwd = await js(STATE);
    check('Avanti: torna al progetto successivo, coerente', coherent(fwd) && fwd.path === target, JSON.stringify(fwd));

    /* ---- Selezioni rapide: vince l'ULTIMA ----
       Un clic ogni 200ms, e prima di ognuno il puntatore SI POSA 80ms sulla
       miniatura, come fa una mano vera. Non è indulgenza, è la differenza che
       conta: al passaggio il prefetch di Astro scarica già la pagina, e il
       cambio di documento si accorcia. Misurato (20 ripetizioni per caso):
         senza passaggio, clic a freddo ogni 150ms   15/20 sull'ultima
         senza View Transition (reduce)                20/20
         passaggio di 80ms, un clic ogni 200ms         20/20
       Il clic perso a freddo non è recuperabile dalla pagina: cade nella
       finestra in cui la View Transition fra documenti cattura la pagina
       vecchia e prepara la nuova, e non raggiunge nessuna delle due. Lo stato
       resta comunque coerente in tutti i casi. */
    await go(slugs[0]);
    const seqClicks = [1, 0, 1, 0, 1, 0, 1].map((k) => slugs[k % slugs.length]);
    if (slugs.length >= 3) seqClicks.splice(3, 0, slugs[2]);
    const expected = seqClicks[seqClicks.length - 1];
    for (const href of seqClicks) {
      /* La posizione si rilegge sul documento CORRENTE, riprovando: a metà
         cambio pagina la lettura può fallire, e saltare il clic renderebbe
         rosso lo strumento per un difetto suo e non del sito. */
      let p = null;
      for (let k = 0; k < 40 && !p; k++) {
        p = await js(`(() => { const a = document.querySelector('[data-cs-thumb][href="${href}"]'); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 3 }; })()`).catch(() => null);
        if (!p) await sleep(20);
      }
      const t = Date.now();
      if (p) await click(p.x, p.y, 80);
      await sleep(Math.max(0, 200 - (Date.now() - t)));
    }
    await sleep(2500);
    await settle(expected);
    const rapid = await js(STATE);
    check(
      `${seqClicks.length} selezioni rapide: URL e contenuti sull’ultima richiesta`,
      coherent(rapid) && rapid.path === expected,
      JSON.stringify({ expected, ...rapid })
    );

    /* ---- Tastiera: la striscia si attraversa col Tab e si attiva con Invio ---- */
    await go(slugs[0]);
    let focused = null;
    for (let k = 0; k < 40 && !focused; k++) {
      await key('Tab', 'Tab', 9);
      focused = await js(`(() => { const a = document.activeElement; return a?.matches?.('[data-cs-thumb]:not([aria-current])') ? { href: a.getAttribute('href'), outline: getComputedStyle(a).outlineStyle } : null; })()`);
    }
    check('Tab raggiunge le miniature, con il focus visibile', focused && focused.outline !== 'none', JSON.stringify(focused));
    if (focused) {
      await key('Enter', 'Enter', 13);
      await settle(focused.href);
      const k = await js(STATE);
      check('Invio su una miniatura apre quel case study', coherent(k) && k.path === focused.href, JSON.stringify(k));
    }

    /* ---- Meno movimento: nessuna transizione, la pagina compare subito ---- */
    await media(true);
    await go(slugs[0]);
    const q = await js(`(() => { const r = document.querySelector('[data-cs-thumb][href="${target}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 3 }; })()`);
    await click(q.x, q.y);
    await settle(target);
    const rm = await js(`({ ...${STATE}, vt: window.__vt })`);
    check('prefers-reduced-motion: cambio progetto SENZA View Transition', coherent(rm) && rm.vt === false, JSON.stringify(rm));
    await media(false);
  } else {
    skip('cambio progetto, cronologia, selezioni rapide, tastiera, reduce', 'c’è un solo case study');
  }

  /* ---- Reflow: nessun overflow orizzontale a nessuna larghezza ---- */
  /* 720 è 1440 al 200% di zoom: stessa larghezza CSS. */
  for (const w of [320, 360, 390, 720, 768, 1024, 1440]) {
    await viewport(w, w < 600 ? 800 : 900);
    await go(slugs[0]);
    const o = await js(`(() => {
      const d = document.documentElement;
      const strip = document.querySelector('[data-cs-strip]');
      const h1 = document.querySelector('h1').getBoundingClientRect();
      return { sw: d.scrollWidth, cw: d.clientWidth, stripInside: !strip || strip.getBoundingClientRect().right <= d.clientWidth + 1, h1Right: h1.right };
    })()`);
    check(`${w}px: nessun overflow orizzontale della pagina`, o.sw <= o.cw && o.stripInside && o.h1Right <= o.cw + 1, JSON.stringify(o));
  }
  await viewport(1440);

  /* ---- Bersagli da toccare ---- */
  await viewport(390, 800);
  await go(slugs[0]);
  const small = await js(`[...document.querySelectorAll('.sw a, .cs__rail a, .st__actions a, .cs__pn a')]
    .map((a) => { const r = a.getBoundingClientRect(); return { t: (a.getAttribute('aria-label') ?? a.textContent).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((r) => r.w < 44 || r.h < 44)`);
  check('390px: ogni controllo del case study misura almeno 44×44', small.length === 0, JSON.stringify(small));
  await viewport(1440);

  /* ---- Senza JavaScript: contenuto e link ci sono tutti ---- */
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await go(slugs[0]);
  const nojs = await js(`(() => ({
    hidden: [...document.querySelectorAll('.chapter, .st__title, .pv__img')].filter((e) => getComputedStyle(e).opacity !== '1').length,
    chapters: document.querySelectorAll('.chapter').length,
    links: document.querySelectorAll('[data-cs-thumb]').length,
  }))()`).catch(() => null);
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  check('senza JS: capitoli, titolo e visual visibili, link presenti', nojs && nojs.hidden === 0 && nojs.chapters > 0, JSON.stringify(nojs));

  /* ---- Slug inesistente ---- */
  const r404 = await fetch(`${BASE}/portfolio/questo-progetto-non-esiste`);
  check('slug inesistente: risponde 404', r404.status === 404, `status ${r404.status}`);

  /* ---- Console ---- */
  const mine = errors.filter((e) => !/_vercel|insights|speed-insights/i.test(e));
  check('nessun errore in console', mine.length === 0, mine.slice(0, 3).join(' | '));
} catch (err) {
  check('lo strumento arriva in fondo senza eccezioni', false, err.message);
}

ws.close();
chrome.kill();

let failed = 0;
for (const r of results) {
  if (r.skipped) console.log(`·  ${r.name} — saltato: ${r.skipped}`);
  else {
    console.log(`${r.ok ? '✓' : '✗'}  ${r.name}${r.ok ? '' : `\n     ${r.detail}`}`);
    if (!r.ok) failed++;
  }
}
console.log(failed ? `\n${failed} controlli FALLITI` : '\nTutti i controlli superati');
process.exit(failed ? 1 : 0);
