/**
 * Verifica funzionale delle stage sticky (M12, il mazzo M16 di §30 e la
 * vetrina M17 dentro le sue card).
 * Uso: node tools/verify-stage.mjs [url] [width] [height]
 *
 * Controlla le cose che un'ispezione statica NON può vedere:
 *  - che nessun pin-spacer sia stato iniettato nel DOM
 *  - che il VINCOLO GEOMETRICO dell'M12 sia rispettato (entrante ≥ uno schermo)
 *  - che lo schermo uscente sia ANCORA incollato mentre la entrante lo copre,
 *    che è la differenza fra un handoff che funziona e due sezioni che
 *    semplicemente combaciano
 *  - che le card di §30 si accatastino davvero scorrendo, senza tornare indietro
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
  /* ⚠ CONVERGERE UNA VOLTA NON BASTA, e questa è la causa di quasi tutta la
     "flakiness" storica di questo strumento.

     Il loop legge `window.scrollY`, che è la posizione ANIMATA da Lenis, non il
     bersaglio interno di Lenis. Uscendo appena la lettura entra in tolleranza si
     esce mentre l'interpolazione è ancora in corso: misurato via CDP, lo scroll
     arrivava a 2478 e poi Lenis lo riportava indietro con la sua curva fino a
     2170 — 300px altrove — e il campione veniva preso lì. Da qui il primo
     campione di §30 sempre fuori posto e il `closing` che arrivava corto.

     La correzione è aspettare la QUIETE invece di un tempo fisso: si converge,
     si attende che due letture consecutive coincidano (Lenis ha finito), e se
     nel frattempo è derivato fuori tolleranza si riconverge. Un `sleep` fisso
     non può funzionare, perché la durata dell'easing dipende dalla distanza. */
  for (let round = 0; round < 4; round++) {
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

    let prev = -1;
    let still = 0;
    for (let i = 0; i < 70; i++) {
      const y = await scrollY();
      if (y === prev) {
        if (++still >= 3) break; // fermo per tre letture: l'easing è esaurito
      } else {
        still = 0;
      }
      prev = y;
      await sleep(60);
    }

    if (Math.abs(target - prev) < 24) return; // fermo E nel punto giusto
  }
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
    cards: document.querySelectorAll('[data-stack-card]').length,
    /* Quante battute ha il trascritto di M17. Si CONTA nel DOM invece di
       scrivere 4 qui: il numero vive nell'array TURNS del componente, e
       duplicarlo renderebbe il test rosso al primo scambio aggiunto. */
    turns: document.querySelectorAll('.fp__turn').length,
    /* A riposo il mazzo è chiuso: la prima card in posizione, TUTTE le altre
       parcheggiate sotto il bordo inferiore dello stack. Si misura la posizione
       reale invece della classe: M16 non commuta classi, scrive transform. */
    parked: (() => {
      const cs = [...document.querySelectorAll('[data-stack-card]')];
      if (cs.length === 0) return -1;
      /* Riferimento: il GENITORE della card, cioe' il contenitore che la
         clippa. NON [data-stack], che sta sulla sezione: la sezione e' alta uno
         schermo intero mentre le card vivono in un contenitore piu' basso e
         spostato in basso, quindi confrontarle col bordo della sezione misura
         la cosa sbagliata. Costato due giri di falso negativo. */
      return cs.filter(
        (c, i) => i > 0 && c.getBoundingClientRect().top >= c.parentElement.getBoundingClientRect().bottom - 2
      ).length;
    })(),
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
check(
  rest.cards > 1 && rest.parked === rest.cards - 1,
  'a riposo il mazzo e\' chiuso: solo la prima card in scena',
  `${rest.parked} parcheggiate / ${rest.cards - 1} attese`
);
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

/* ---- 3. il mazzo di §30 (M16) -------------------------------------------
   Sei campioni lungo la corsa invece di tre. L'inseguimento dello scroll ha una
   tolleranza e Lenis può sopravanzare di qualche decina di pixel: con tre soli
   punti presi vicino ai confini, un campione può cadere dall'altra parte e il
   test fallisce senza che il sito abbia niente di sbagliato. Con sei punti si
   verificano le PROPRIETÀ giuste — il mazzo si compone, non torna indietro, e
   arriva in fondo — invece di indovinare la posizione esatta di ogni arrivo.

   Si misura `arrived`: quante card hanno il bordo superiore DENTRO lo stack
   (cioè hanno finito di salire da sotto). È l'invariante di M16, e non duplica
   nessun valore del CSS o della timeline: se domani si ritoccano LEAD, STEP o
   la durata, questo controllo resta valido. */
const seen = [];
for (const frac of [0.05, 0.2, 0.4, 0.55, 0.75, 0.98]) {
  await scrollTo(geo.featTop + geo.travelH * frac);
  await sleep(700); // lo scrub ha un catch-up: non campionare a metà
  const s = await evalJson(`
    const cs = [...document.querySelectorAll('[data-stack-card]')];
    const scr = document.querySelector('[data-screen="featured"]');
    return {
      // Arrivata = ha finito di salire, cioe' il suo bordo superiore e' rientrato
      // dentro il contenitore che la clippa (vedi la nota su 'parked').
      arrived: cs.filter(c => c.getBoundingClientRect().top < c.parentElement.getBoundingClientRect().bottom - 2).length,
      // Le card sepolte devono essere RIENTRATE: scale < 1 su tutte tranne
      // l'ultima arrivata, o la sovrapposizione non legge come profondità.
      scales: cs.map(c => +(new DOMMatrixReadOnly(getComputedStyle(c).transform).a).toFixed(3)),
      // Firma completa della posa del mazzo (scala + traslazione di ogni card).
      // Serve per la CODA FERMA: due campioni con la stessa firma = niente si e'
      // mosso fra i due.
      sig: cs.map(c => { const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return m.a.toFixed(2)+'/'+Math.round(m.f); }).join(' '),
      scrTop: Math.round(scr.getBoundingClientRect().top),
      /* M17 — la vetrina. Per ogni card, la traslazione verticale dei suoi reel
         e la corsa massima disponibile (altezza del reel meno quella della
         finestra che lo clippa). Si campiona qui invece di fare un secondo giro
         di scroll: ogni passata di scrollTo costa secondi. */
      reelY: cs.map(c => [...c.querySelectorAll('[data-reel]')]
        .map(r => Math.round(new DOMMatrixReadOnly(getComputedStyle(r).transform).f))),
      reelRun: cs.map(c => [...c.querySelectorAll('[data-reel]')]
        .map(r => Math.round(r.getBoundingClientRect().height - r.parentElement.clientHeight))),
      callIn: (() => { const k = document.querySelector('[data-call]'); return k ? k.classList.contains('is-in') : null; })(),
      turnsOn: (() => { const k = document.querySelector('[data-call]'); return k
        ? [...k.querySelectorAll('.fp__turn')].filter(t => +getComputedStyle(t).opacity > 0.9).length : null; })(),
    };
  `);
  seen.push(s);
}
const arrived = seen.map((s) => s.arrived);
/* ⚠ NON si pretende `arrived[0] === 1`. Ci ho sbattuto: quell'assert obbliga il
   primo campione a cadere in una finestra di poche decine di pixel all'inizio
   della corsa, e con Lenis di mezzo la posizione reale puo' scostarsi
   abbastanza da far partire la seconda card — test rosso senza che il sito
   abbia niente di sbagliato. L'invariante vero e' piu' debole e piu' utile: a
   inizio corsa il mazzo NON e' ancora completo, a fine corsa lo e'. */
check(
  arrived[0] < rest.cards && arrived[arrived.length - 1] === rest.cards,
  'il mazzo si compone lungo la corsa (incompleto all inizio, completo alla fine)',
  arrived.join(' -> ')
);
check(
  arrived.every((v, i) => i === 0 || v >= arrived[i - 1]),
  'le card si accatastano e non tornano indietro',
  arrived.join(' -> ')
);
check(
  seen.every((s) => Math.abs(s.scrTop) <= STUCK_TOLERANCE),
  'lo schermo §30 resta incollato per tutta la corsa',
  seen.map((s) => s.scrTop).join(', ')
);
/* A mazzo composto la profondità deve esistere: le card sotto sono rientrate e
   in ordine (la prima è la più piccola). Senza questo, una sovrapposizione
   piatta passerebbe il controllo qui sopra senza leggersi come mazzo. */
const last = seen[seen.length - 1].scales;
check(
  last.every((s, i) => i === 0 || s >= last[i - 1]) && last[0] < last[last.length - 1],
  'a mazzo composto le card sepolte sono rientrate, in ordine',
  last.join(' < ')
);

/* LA CODA FERMA — l'ultimo schermo di corsa in cui il mazzo e' composto e NON si
   muove piu', mentre la sezione resta incollata. Senza, l'ultima card si posava
   nell'istante esatto in cui lo Statement iniziava a coprirla e il mazzo finito
   non si vedeva mai.
   DUE CAMPIONI DEDICATI, non quelli della serie qui sopra: la coda vale gli
   ultimi ~31% della corsa, e 0.75 cade troppo vicino al confine in cui l'ultima
   card si sta ancora posando — misurato, ci finiva dentro. 0.86 e 0.995 stanno
   entrambi ben dentro, con margine per un'imprecisione di convergenza.
   Si verifica l'IDENTITA' delle pose, non la lunghezza della coda: se domani
   cambia il `travel`, il controllo resta valido finche' la coda esiste. */
const hold = [];
for (const frac of [0.86, 0.995]) {
  await scrollTo(geo.featTop + geo.travelH * frac);
  const s = await evalJson(`
    const cs = [...document.querySelectorAll('[data-stack-card]')];
    return {
      sig: cs.map(c => { const m = new DOMMatrixReadOnly(getComputedStyle(c).transform); return m.a.toFixed(2)+'/'+Math.round(m.f); }).join(' '),
      arrived: cs.filter(c => c.getBoundingClientRect().top < c.parentElement.getBoundingClientRect().bottom - 2).length,
    };
  `);
  hold.push(s);
}
check(
  hold[0].sig === hold[1].sig && hold[1].arrived === rest.cards,
  'coda ferma: nell ultimo tratto di corsa il mazzo composto non si muove',
  hold[0].sig === hold[1].sig
    ? `posa identica [${hold[0].sig}]`
    : `si muove ancora: ${hold[0].sig}  ->  ${hold[1].sig}`
);

/* ---- 3b. M17 — la vetrina dentro le card --------------------------------
   Si verifica il MECCANISMO, non i valori: che la pagina dentro gli schermi
   scorra, che scorra in una sola direzione, che arrivi in fondo alla propria
   corsa, e che il trascritto si accenda una volta sola senza dis-dirsi. Nessun
   assert duplica una durata o una soglia del CSS o di stage.ts. */
const reelPaths = [];
for (let c = 0; c < rest.cards; c++) {
  const n = seen[0].reelRun[c]?.length ?? 0;
  for (let k = 0; k < n; k++) {
    reelPaths.push({
      label: `card ${c + 1} / reel ${k + 1}`,
      run: Math.max(...seen.map((s) => s.reelRun[c][k])),
      ys: seen.map((s) => s.reelY[c][k]),
    });
  }
}
check(
  reelPaths.length > 0,
  'M17: le card dei siti hanno un reel da scorrere',
  `${reelPaths.length} reel trovati`
);
/* Monotono NON CRESCENTE (la pagina scende, quindi y diventa più negativo). La
   tolleranza di 4px assorbe l'arrotondamento della matrice, non un rimbalzo. */
const notBack = reelPaths.filter((r) => !r.ys.every((v, i) => i === 0 || v <= r.ys[i - 1] + 4));
check(
  notBack.length === 0,
  'M17: la pagina dentro gli schermi scorre in avanti e non rimbalza',
  notBack.length ? notBack.map((r) => `${r.label}: ${r.ys.join(' -> ')}`).join(' | ') : reelPaths.map((r) => r.ys.at(-1)).join(' / ')
);
/* Arriva in fondo: |y| finale ≥ 90% della corsa disponibile. Se un domani il
   reel diventa uno screenshot vero con proporzioni diverse, questo regge — è
   una frazione della corsa MISURATA, non un numero di pixel. */
const short = reelPaths.filter((r) => r.run > 0 && Math.abs(Math.min(...r.ys)) < r.run * 0.9);
check(
  short.length === 0,
  'M17: ogni reel percorre la sua pagina fino in fondo',
  short.length
    ? short.map((r) => `${r.label}: ${Math.abs(Math.min(...r.ys))}/${r.run}px`).join(' | ')
    : reelPaths.map((r) => `${Math.abs(Math.min(...r.ys))}/${r.run}`).join(' · ')
);
/* Il trascritto: spento all'inizio della corsa, acceso e completo in fondo. È
   l'invariante di M14 riusata — la classe si aggiunge e non si toglie mai. */
check(
  seen[0].callIn === false && seen[seen.length - 1].callIn === true,
  'M17: il trascritto della chiamata parte spento e si accende lungo la corsa',
  `inizio ${seen[0].callIn} -> fine ${seen[seen.length - 1].callIn}`
);
check(
  seen[seen.length - 1].turnsOn === rest.turns,
  'M17: a fine corsa tutte le battute della conversazione sono leggibili',
  `${seen[seen.length - 1].turnsOn}/${rest.turns} battute`
);
/* E RISALENDO NON SI DIS-DICE. È il motivo per cui il trascritto non è
   scrubbato: una conversazione che si riavvolge annulla l'appuntamento e
   rientra le parole. Costava un bug reale in M14 (lo squiggle e i loghi gated
   su `.is-active`), quindi qui si controlla. */
await scrollTo(geo.featTop + Math.round(geo.travelH * 0.12));
const rewound = await evalJson(`
  const k = document.querySelector('[data-call]');
  return {
    isIn: k.classList.contains('is-in'),
    turnsOn: [...k.querySelectorAll('.fp__turn')].filter(t => +getComputedStyle(t).opacity > 0.9).length,
  };
`);
check(
  rewound.isIn === true && rewound.turnsOn === rest.turns,
  'M17: risalendo la pagina la conversazione NON si dis-dice',
  `is-in ${rewound.isIn}, ${rewound.turnsOn}/${rest.turns} battute leggibili`
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
  end.bg === 'rgb(147, 112, 245)',
  'closing: fondo accento opaco (e\' l\'opacita\' a occludere)',
  end.bg
);
/* ⚠ ERA `end.color === 'rgb(18, 20, 26)'`, cioè #12141A inchiodato nel test:
   il near-black blu-ardesia che --color-canvas aveva all'epoca. Quando il canvas
   è passato a #050505 questo controllo è diventato rosso senza che nulla si
   fosse rotto — la tipografia sull'accento era ancora near-black, solo di un
   near-black diverso. Un test che duplica il valore di un token invece di
   verificare l'invariante fallisce a ogni ritocco di palette, e un controllo che
   "è sempre rosso e si sa perché" è peggio di nessun controllo: insegna a
   ignorare l'esito.

   L'invariante vera è duplice, e nessuna delle due metà dipende da un hex
   specifico: il testo deve essere SCURO (mai la variante bianca, che è la
   combinazione che non passa AA sul viola pieno) e deve stare sopra 4.5:1 sul
   fondo accento. Entrambe si misurano. */
const relLum = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const lumText = relLum(end.color);
const lumBg = relLum(end.bg);
const ratio = (Math.max(lumText, lumBg) + 0.05) / (Math.min(lumText, lumBg) + 0.05);
check(
  lumText < 0.1 && ratio >= 4.5,
  "closing: tipografia near-black sull'accento, mai bianca",
  `${end.color} su ${end.bg} — ${ratio.toFixed(2)}:1`
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
    /* Senza JS le card devono essere visibili E in flusso: opacita' piena (il
       parcheggio di M16 le mette a 0 sotto html.js-anim, classe che senza JS
       non viene mai aggiunta) e position static, o resterebbero sovrapposte a
       tre a tre in un punto solo.
       NB: niente backtick in questo commento — sta DENTRO un template literal
       e lo chiuderebbe in anticipo. Costato un SyntaxError. */
    cardsVisible: [...document.querySelectorAll('[data-stack-card]')].filter(e => {
      const s = getComputedStyle(e);
      return s.visibility === 'visible' && +s.opacity === 1 && s.position === 'static';
    }).length,
    cards: document.querySelectorAll('[data-stack-card]').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    /* M17 senza JS: i reel devono stare in CIMA e senza transform (uno
       screenshot dentro un device) e il trascritto deve essere GIA' COMPLETO.
       E' l'invariante di M14 "spento non e' mai invisibile": senza JS non
       esiste nessuno stato in cui manca del contenuto. */
    reelsUntouched: [...document.querySelectorAll('[data-reel]')]
      .filter(r => { const tf = getComputedStyle(r).transform; return tf === 'none' || tf === 'matrix(1, 0, 0, 1, 0, 0)'; }).length,
    reels: document.querySelectorAll('[data-reel]').length,
    turnsOn: [...document.querySelectorAll('.fp__turn')].filter(t => +getComputedStyle(t).opacity > 0.9).length,
    turns: document.querySelectorAll('.fp__turn').length,
  };
`);
check(
  noJs.positions.every((p) => p === 'static'),
  'senza JS: nessuno schermo resta sticky',
  noJs.positions.join(', ')
);
check(noJs.travelsShown === 0, 'senza JS: nessuna corsa di scroll a vuoto', `${noJs.travelsShown}`);
check(
  noJs.cardsVisible === noJs.cards && noJs.cards > 0,
  'senza JS: tutte le card sono visibili in flusso',
  `${noJs.cardsVisible}/${noJs.cards}`
);
check(noJs.overflowX === 0, 'senza JS: nessun overflow orizzontale', `${noJs.overflowX}px`);
check(
  noJs.reelsUntouched === noJs.reels && noJs.reels > 0,
  'senza JS: i reel restano in cima, senza transform',
  `${noJs.reelsUntouched}/${noJs.reels}`
);
check(
  noJs.turnsOn === noJs.turns && noJs.turns > 0,
  'senza JS: il trascritto della chiamata e\' gia\' completo',
  `${noJs.turnsOn}/${noJs.turns} battute`
);
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
