/**
 * Verifica funzionale delle stage sticky (M12 + stage dei piatti).
 * Uso: node tools/verify-stage.mjs [url] [width] [height]
 *
 * Controlla le cose che un'ispezione statica NON può vedere:
 *  - che nessun pin-spacer sia stato iniettato nel DOM
 *  - che il VINCOLO GEOMETRICO dell'M12 sia rispettato (entrante ≥ uno schermo)
 *  - che lo schermo uscente sia ANCORA incollato mentre la entrante lo copre,
 *    che è la differenza fra un handoff che funziona e due sezioni che
 *    semplicemente combaciano
 *  - che i piatti della stage §30 si scambino davvero scorrendo
 *
 * Usa eventi wheel reali e non `window.scrollTo`: Lenis intercetta lo scroll, e
 * una posizione impostata a mano litiga con la sua interpolazione.
 */
import { spawn } from 'node:child_process';

const [url = 'http://localhost:4321/', W = '1440', H = '900'] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9345;

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${W},${H}`,
    '--user-data-dir=' + process.env.TEMP + '/cdp-stage-' + PORT,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
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
    const my = ++id;
    pending.set(my, res);
    ws.send(JSON.stringify({ id: my, method, params, sessionId }));
  });

const { result: targets } = await send('Target.getTargets');
const page = targets.targetInfos.find((t) => t.type === 'page');
const { result: att } = await send('Target.attachToTarget', {
  targetId: page.targetId,
  flatten: true,
});
const sid = att.sessionId;

await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send(
  'Emulation.setDeviceMetricsOverride',
  { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 700 },
  sid
);
await send('Page.navigate', { url }, sid);
await sleep(3000);

async function evalJson(fnBody) {
  const { result } = await send(
    'Runtime.evaluate',
    { expression: `JSON.stringify((() => {${fnBody}})())`, returnByValue: true },
    sid
  );
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return JSON.parse(result.result.value);
}

async function scrollY() {
  const { result } = await send(
    'Runtime.evaluate',
    { expression: 'window.scrollY', returnByValue: true },
    sid
  );
  return result.result.value;
}

/**
 * Porta lo scroll a una posizione ASSOLUTA con eventi wheel.
 *
 * A colpi ciechi ("n tacche da 400px") si campiona sempre nel punto sbagliato:
 * una transizione M12 dura mezzo schermo, e due tacche la superano. Qui si
 * inseguisce la posizione fino a rientrare nella tolleranza, così ogni controllo
 * misura esattamente il momento che vuole misurare.
 */
async function scrollTo(target) {
  for (let i = 0; i < 300; i++) {
    const y = await scrollY();
    const diff = target - y;
    if (Math.abs(diff) < 24) break;
    await send(
      'Input.dispatchMouseEvent',
      {
        type: 'mouseWheel',
        x: +W / 2,
        y: +H / 2,
        deltaX: 0,
        deltaY: Math.max(-500, Math.min(500, diff)),
      },
      sid
    );
    await sleep(55);
  }
  await sleep(700); // lascia finire l'interpolazione di Lenis
}

const results = [];
const check = (ok, label, extra = '') => results.push({ ok, label, extra });

/**
 * Tolleranza per "incollato in cima".
 *
 * Non è pigrizia: durante il rientro lo schermo ha `scale(0.96)`, e
 * `getBoundingClientRect()` restituisce il rettangolo VISUALE, non quello di
 * layout. Un elemento di 900px scalato a 0.96 è alto 864px e, restando centrato,
 * il suo bordo superiore misurato scende di 18px — pur essendo perfettamente
 * incollato a `top: 0`. Asserire `=== 0` misurerebbe la scala, non lo sticky.
 */
const STUCK_TOLERANCE = 24;

/* ---- 1. struttura a riposo ---------------------------------------------- */
const rest = await evalJson(`
  return {
    pinSpacers: document.querySelectorAll('.pin-spacer').length,
    screens: document.querySelectorAll('[data-screen]').length,
    occluders: document.querySelectorAll('[data-occludes]').length,
    plates: document.querySelectorAll('[data-plate]').length,
    activePlates: document.querySelectorAll('[data-plate].is-active').length,
    positions: [...document.querySelectorAll('[data-screen]')].map(e => getComputedStyle(e).position),
    screenH: [...document.querySelectorAll('[data-screen]')].map(e => Math.round(e.getBoundingClientRect().height)),
    inH: [...document.querySelectorAll('[data-occludes]')].map(e => Math.round(e.getBoundingClientRect().height)),
    travels: Object.fromEntries([...document.querySelectorAll('[data-travel]')]
      .map(e => [e.dataset.travel, Math.round(e.getBoundingClientRect().height)])),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight,
  };
`);

check(rest.pinSpacers === 0, 'nessun pin-spacer nel DOM', String(rest.pinSpacers));
check(
  rest.screens === rest.occluders && rest.screens > 0,
  'ogni schermo ha il suo occlusore',
  `${rest.screens} schermi / ${rest.occluders} occlusori`
);
check(
  rest.positions.every((p) => p === 'sticky'),
  'schermi uscenti in position:sticky',
  rest.positions.join(', ')
);
check(rest.activePlates === 1, 'un solo piatto attivo a riposo', `${rest.activePlates}/${rest.plates}`);
check(rest.overflowX === 0, 'nessun overflow orizzontale', `${rest.overflowX}px`);

/* Uno schermo sticky più ALTO della viewport incolla il proprio bordo superiore,
   e tutto ciò che sfora resta irraggiungibile finché è incollato. Oggi lo sforo
   sarebbe padding vuoto, ma è un difetto latente: appena il contenuto cresce,
   sparisce contenuto vero, e in silenzio. Meglio che lo dica un controllo. */
const tooTall = rest.screenH.filter((h) => h > +H + 2);
check(
  tooTall.length === 0,
  'nessuno schermo sticky supera la viewport',
  `schermi ${rest.screenH.join('/')} vs viewport ${H}`
);

// IL vincolo: se una entrante è più bassa dello schermo, sticky e occlusione
// combaciano invece di sovrapporsi e l'handoff non esiste.
// Si pretende MARGINE, non uguaglianza: a parità esatta l'invariante regge per
// un pelo e un pixel di crescita la ribalta.
const violations = rest.inH.filter((h, i) => h <= rest.screenH[i]);
check(
  violations.length === 0,
  "ogni entrante e' piu' alta del suo schermo (con margine)",
  `entranti ${rest.inH.join('/')} vs schermi ${rest.screenH.join('/')}`
);
check(
  rest.travels.featured > +H,
  'la corsa della stage §30 esiste ed e\' piu\' di uno schermo',
  `featured ${rest.travels.featured}px`
);
// La corsa del handoff finale non serve a una stage: è tempo di LETTURA, perché
// senza il teaser del percorso resterebbe intero per un fotogramma solo.
check(
  rest.travels.closing >= +H * 0.9,
  'il teaser del percorso ha tempo di lettura prima della CTA',
  `closing ${rest.travels.closing ?? 0}px`
);

/* ---- 2. l'handoff in azione ---------------------------------------------
   Posizioni assolute lette dal DOM: la transizione dura mezzo schermo, quindi
   il punto di campionamento va calcolato, non indovinato. */
const geo = await evalJson(`
  const off = (el) => el.getBoundingClientRect().top + window.scrollY;
  const introIn = document.querySelector('[data-occludes="intro"]');
  const featScreen = document.querySelector('[data-screen="featured"]');
  const travel = document.querySelector('[data-travel="featured"]');
  const closingIn = document.querySelector('[data-occludes="closing"]');
  return {
    introInTop: Math.round(off(introIn)),
    featTop: Math.round(off(featScreen.parentElement)),
    travelH: Math.round(travel.getBoundingClientRect().height),
    closingInTop: Math.round(off(closingIn)),
  };
`);

// Metà transizione dell'handoff intro: la entrante ha il bordo superiore a
// metà viewport, cioè scroll = suo offset − H/2.
await scrollTo(geo.introInTop - +H / 2);
const mid = await evalJson(`
  const occ = document.querySelector('[data-occludes="intro"]');
  const scr = document.querySelector('[data-screen="intro"]');
  return {
    occTop: Math.round(occ.getBoundingClientRect().top),
    scrTop: Math.round(scr.getBoundingClientRect().top),
    tf: getComputedStyle(scr).transform,
    op: getComputedStyle(scr).opacity,
    wc: getComputedStyle(scr).willChange,
  };
`);

check(
  mid.occTop > 0 && mid.occTop < +H,
  'intro: la entrante e\' a meta\' copertura',
  `bordo superiore a ${mid.occTop}px`
);
check(
  Math.abs(mid.scrTop) <= STUCK_TOLERANCE,
  'intro: lo schermo e\' ANCORA incollato in cima mentre viene coperto',
  `top ${mid.scrTop}px`
);
check(
  mid.tf !== 'none' && Number(mid.op) < 1,
  'intro: il rientro e\' in corso (scale + opacity)',
  `${mid.tf} · opacity ${mid.op}`
);
check(
  mid.wc.includes('transform'),
  'intro: will-change attivo solo durante la transizione',
  mid.wc
);

/* ---- 3. la stage dei piatti --------------------------------------------
   Sei campioni lungo la corsa invece di tre. L'inseguimento dello scroll ha una
   tolleranza e Lenis può sopravanzare di qualche decina di pixel: con tre soli
   punti presi vicino ai confini di scambio, un campione può cadere dall'altra
   parte del confine e il test fallisce senza che il sito abbia niente di
   sbagliato. Con sei punti si verifica la PROPRIETÀ giusta — ogni piatto ha il
   suo turno, e l'ordine non torna mai indietro — invece di indovinare la
   posizione esatta di ogni scambio. */
const seen = [];
for (const frac of [0.05, 0.2, 0.4, 0.55, 0.75, 0.92]) {
  await scrollTo(geo.featTop + geo.travelH * frac);
  await sleep(700); // le dissolvenze CSS durano 520ms: non campionare a metà
  const s = await evalJson(`
    const ps = [...document.querySelectorAll('[data-plate]')];
    const scr = document.querySelector('[data-screen="featured"]');
    return {
      active: ps.findIndex(p => p.classList.contains('is-active')),
      visible: ps.filter(p => getComputedStyle(p).visibility === 'visible').length,
      scrTop: Math.round(scr.getBoundingClientRect().top),
    };
  `);
  seen.push(s);
}
const actives = seen.map((s) => s.active);
check(
  new Set(actives.filter((i) => i >= 0)).size === rest.plates,
  'ogni piatto ha il suo turno lungo la corsa',
  actives.join(' -> ')
);
check(
  actives.every((v, i) => i === 0 || v >= actives[i - 1]),
  'i piatti avanzano e non tornano indietro',
  actives.join(' -> ')
);
check(
  seen.every((s) => Math.abs(s.scrTop) <= STUCK_TOLERANCE),
  'lo schermo §30 resta incollato per tutta la corsa',
  seen.map((s) => s.scrTop).join(', ')
);
check(
  actives.every((i) => i >= 0),
  "c'e' sempre un piatto attivo",
  actives.join(',')
);
check(
  seen.every((s) => s.visible <= 1),
  'mai due piatti visibili insieme (niente link fantasma nel tab order)',
  seen.map((s) => s.visible).join(',')
);

/* ---- 4. fondo della pagina: la CTA copre il teaser ---------------------
   Un po' OLTRE il bordo: la tolleranza di scrollTo più il residuo di easing di
   Lenis lascerebbero altrimenti la CTA a qualche decina di pixel dal bordo, e il
   controllo misurerebbe la precisione dell'inseguimento invece della copertura. */
await scrollTo(geo.closingInTop + 120);
const end = await evalJson(`
  const occ = document.querySelector('[data-occludes="closing"]');
  const scr = document.querySelector('[data-screen="closing"]');
  return {
    occTop: Math.round(occ.getBoundingClientRect().top),
    bg: getComputedStyle(occ).backgroundColor,
    color: getComputedStyle(occ).color,
    scrOp: getComputedStyle(scr).opacity,
  };
`);
check(end.occTop <= STUCK_TOLERANCE, 'closing: la CTA ha coperto il teaser', `top ${end.occTop}px`);
check(
  Number(end.scrOp) < 0.6,
  'closing: il teaser sotto e\' rientrato (opacity <0.6)',
  `opacity ${end.scrOp}`
);
check(
  end.bg === 'rgb(91, 132, 255)',
  'closing: fondo accento opaco (e\' l\'opacita\' a occludere)',
  end.bg
);
check(
  end.color === 'rgb(11, 11, 12)',
  'closing: tipografia near-black sull\'accento, mai bianca',
  end.color
);

/* ---- 5. senza JS: nessuno sticky, nessuna corsa -----------------------
   Senza JS la stage §30 torna in flusso e la sezione uscente diventa alta
   ~2100px: se restasse sticky, incollerebbe il bordo superiore e due progetti su
   tre diventerebbero irraggiungibili. Quindi l'assenza di sticky qui non è una
   rinuncia, è la garanzia che il contenuto resti raggiungibile. */
await send('Emulation.setScriptExecutionDisabled', { value: true }, sid);
await send('Page.navigate', { url }, sid);
await sleep(2000);
const noJs = await evalJson(`
  return {
    positions: [...document.querySelectorAll('[data-screen]')].map(e => getComputedStyle(e).position),
    travelsShown: [...document.querySelectorAll('[data-travel]')].filter(e => e.getBoundingClientRect().height > 0).length,
    platesVisible: [...document.querySelectorAll('[data-plate]')].filter(e => getComputedStyle(e).visibility === 'visible').length,
    plates: document.querySelectorAll('[data-plate]').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
`);
check(
  noJs.positions.every((p) => p === 'static'),
  'senza JS: nessuno schermo resta sticky',
  noJs.positions.join(', ')
);
check(noJs.travelsShown === 0, 'senza JS: nessuna corsa di scroll a vuoto', `${noJs.travelsShown}`);
check(
  noJs.platesVisible === noJs.plates,
  'senza JS: tutti i piatti sono visibili in flusso',
  `${noJs.platesVisible}/${noJs.plates}`
);
check(noJs.overflowX === 0, 'senza JS: nessun overflow orizzontale', `${noJs.overflowX}px`);
await send('Emulation.setScriptExecutionDisabled', { value: false }, sid);

console.log('\n================ ESITO ================');
let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.label}${r.extra ? `  [${r.extra}]` : ''}`);
}
console.log(bad === 0 ? '\nTutti i controlli superati.' : `\n${bad} CONTROLLI FALLITI.`);

ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
