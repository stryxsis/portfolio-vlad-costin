/**
 * Il cielo di /contatti (2026-10-05). Un canvas 2D, nessuna libreria.
 *
 * Vlad: «a tema spazio, uno sfondo che si muove dietro, componenti che si
 * muovono, qualcosa che interagisca con l'utente — ma non troppo pesante, deve
 * girare anche sui telefoni, e niente stile da nerd o da gaming».
 *
 * Cosa c'è, dal fondo in avanti:
 *   1. le stelle, su tre profondità: le lontane piccole e lente, le vicine più
 *      grandi. Si spostano di poco con lo scroll e (su desktop) col puntatore:
 *      la parallasse è ciò che dà profondità, non il numero di punti;
 *   2. la metà posteriore di un'orbita, e il satellite quando ci passa sopra;
 *   3. il pianeta (un'immagine preparata a ogni ridimensionamento, non
 *      ridisegnata a ogni fotogramma), che copre ciò che gli sta dietro;
 *   4. la metà anteriore dell'orbita, e il satellite quando passa davanti;
 *   5. le stelle cadenti, rare.
 *
 * L'INTERAZIONE, ed è il motivo per cui il cielo è un canvas e non un SVG come
 * le stelle della 404:
 *   - il puntatore illumina le stelle vicine (una torcia, niente linee fra i
 *     punti: le costellazioni tracciate sono esattamente lo stile «da nerd» da
 *     evitare);
 *   - ogni parola scritta nel messaggio accende una stella nuova
 *     (`spazio:parola`, lo manda contatti.ts);
 *   - all'invio riuscito parte una scia dal bottone (`spazio:lancio`).
 *
 * IL COSTO: ~100-240 sprite disegnati con `drawImage` per fotogramma, su un
 * canvas grande quanto la VIEWPORT (non quanto la pagina: sta in un contenitore
 * sticky). DPR limitato a 1,5. Il ciclo si ferma quando la sezione esce di
 * vista o la scheda è nascosta, e su schermi touch gira a 30 fotogrammi.
 * Con `prefers-reduced-motion` si disegna UN fotogramma e basta: il cielo
 * resta, fermo — è il fondo, non l'animazione.
 */

type Stella = { x: number; y: number; z: number; r: number; a: number; sp: number; ph: number; viola: boolean };
type Nuova = Stella & { nato: number };
type Cadente = { x: number; y: number; vx: number; vy: number; len: number; vita: number; t: number; forte: boolean };

const TAU = Math.PI * 2;
/** Quanto sale l'atmosfera sopra la sommità del pianeta, in px. */
const ALONE = 140;

function colore(nome: string, riserva: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || riserva;
}

/** Uno sprite rotondo e sfumato: disegnarlo scalato costa meno di un `arc` con
 *  un'ombra, ed è identico a schermo. */
function sprite(rgb: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.22, `rgba(${rgb},0.85)`);
  gr.addColorStop(0.5, `rgba(${rgb},0.18)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return c;
}

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function initSpazio(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-spazio]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const sezione = canvas.closest<HTMLElement>('section') ?? canvas;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  const fondo = colore('--color-canvas', '#050505');
  const accento = hexRgb(colore('--color-accent', '#9370f5'));
  const accentoHi = hexRgb(colore('--color-accent-hi', '#b39cfa'));
  const SP_BIANCO = sprite('255,255,255');
  const SP_VIOLA = sprite(accentoHi);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let stelle: Stella[] = [];
  const nuove: Nuova[] = [];
  const cadenti: Cadente[] = [];
  let pianeta: HTMLCanvasElement | null = null;
  let orizzonte = 0; // y della sommità del pianeta

  /* L'orbita: un'ellisse inclinata appoggiata all'orizzonte. */
  const orbita = () => ({
    cx: W * 0.5,
    cy: orizzonte + H * 0.05,
    rx: W * (touch ? 0.7 : 0.56),
    ry: H * 0.1,
    rot: -0.07,
  });

  const genera = () => {
    const n = Math.round(Math.min(240, Math.max(90, (W * H) / 6200)));
    stelle = Array.from({ length: n }, () => {
      const z = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;
      return {
        x: Math.random(),
        y: Math.random() * 0.92,
        z,
        r: [0.7, 1.05, 1.5][z]! * (0.75 + Math.random() * 0.5),
        a: [0.35, 0.55, 0.8][z]! * (0.6 + Math.random() * 0.4),
        sp: 0.4 + Math.random() * 1.4,
        ph: Math.random() * TAU,
        viola: Math.random() < 0.14,
      };
    });
  };

  /* Il pianeta si prepara una volta per misura: un cerchio enorme di cui si vede
     la calotta, con il bordo illuminato e un alone d'atmosfera. */
  const preparaPianeta = () => {
    const R = Math.max(W * 1.25, 1300);
    orizzonte = H * (touch ? 0.86 : 0.8);
    const alone = ALONE;
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr);
    c.height = Math.round((H - orizzonte + alone) * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const cx = W / 2;
    const cy = alone + R; // il centro, in coordinate di questo strato
    // L'atmosfera: un anello sfumato appena fuori dal bordo.
    const atm = g.createRadialGradient(cx, cy, R - 4, cx, cy, R + alone);
    atm.addColorStop(0, `rgba(${accento},0.34)`);
    atm.addColorStop(0.25, `rgba(${accento},0.12)`);
    atm.addColorStop(1, `rgba(${accento},0)`);
    g.fillStyle = atm;
    g.fillRect(0, 0, W, H);
    // La superficie: scura, con la luce radente sul bordo.
    const sup = g.createRadialGradient(cx, cy - R * 0.02, R * 0.9, cx, cy, R);
    sup.addColorStop(0, fondo);
    sup.addColorStop(0.82, '#08070f');
    sup.addColorStop(1, `rgba(${accento},0.22)`);
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fillStyle = '#07060d';
    g.fill();
    g.fillStyle = sup;
    g.fill();
    // Il filo di luce sul bordo.
    g.lineWidth = 1.2;
    g.strokeStyle = `rgba(${accentoHi},0.7)`;
    g.stroke();
    pianeta = c;
  };

  const misura = () => {
    const box = canvas.getBoundingClientRect();
    W = Math.max(1, box.width);
    H = Math.max(1, box.height);
    dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    genera();
    preparaPianeta();
  };

  /* ---- Stato dell'interazione ---------------------------------------------- */
  let px = 0; // parallasse attuale, -1..1
  let py = 0;
  let tx = 0; // parallasse obiettivo
  let ty = 0;
  let lx = -9999; // la torcia, in px
  let ly = -9999;
  let luce = 0; // intensità della torcia, sfuma quando il puntatore esce
  let luceT = 0;
  let prossimaCadente = 4 + Math.random() * 6;
  let sat = Math.random() * TAU; // angolo del satellite
  const scia: { x: number; y: number }[] = [];
  const impulsi: { x: number; y: number; t: number }[] = [];

  if (!touch) {
    sezione.addEventListener('pointermove', (e) => {
      const b = canvas.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
      lx = e.clientX - b.left;
      ly = e.clientY - b.top;
      luceT = 1;
    });
    sezione.addEventListener('pointerleave', () => {
      luceT = 0;
      tx = ty = 0;
    });
  }

  document.addEventListener('spazio:parola', () => {
    if (nuove.length > 70) nuove.shift();
    nuove.push({
      x: 0.06 + Math.random() * 0.88,
      y: 0.05 + Math.random() * 0.62,
      z: 1,
      r: 1.3 + Math.random() * 0.6,
      a: 0.85,
      sp: 0.6 + Math.random(),
      ph: Math.random() * TAU,
      viola: Math.random() < 0.5,
      nato: performance.now(),
    });
    if (reduce) disegna(performance.now(), 0);
  });

  document.addEventListener('spazio:lancio', (e) => {
    const d = (e as CustomEvent<{ x: number; y: number }>).detail;
    const b = canvas.getBoundingClientRect();
    const x = d.x - b.left;
    const y = d.y - b.top;
    impulsi.push({ x, y, t: 0 });
    // Su e un po' a destra: «fuori», verso il cielo aperto.
    const ang = -Math.PI / 2 + 0.38;
    const v = 1500;
    cadenti.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, len: 380, vita: 1.3, t: 0, forte: true });
  });

  /* ---- Il fotogramma --------------------------------------------------------- */
  const stella = (s: Stella, oy: number, ora: number, extra = 1) => {
    const prof = [10, 22, 40][s.z]!;
    let x = s.x * W + px * prof;
    let y = s.y * H + py * prof - oy * (s.z + 1);
    y = ((y % H) + H) % H;
    x = ((x % W) + W) % W;
    const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(ora * 0.001 * s.sp + s.ph);
    let a = s.a * tw * extra;
    let r = s.r;
    if (luce > 0.01) {
      const dx = x - lx;
      const dy = y - ly;
      const d2 = dx * dx + dy * dy;
      const R = 170;
      if (d2 < R * R) {
        const k = (1 - Math.sqrt(d2) / R) ** 2 * luce;
        a = Math.min(1, a * (1 + k * 1.8));
        r *= 1 + k * 0.7;
      }
    }
    const lato = r * 7;
    ctx.globalAlpha = a;
    ctx.drawImage(s.viola ? SP_VIOLA : SP_BIANCO, x - lato / 2, y - lato / 2, lato, lato);
  };

  const metaOrbita = (davanti: boolean) => {
    const o = orbita();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx, o.ry, o.rot, davanti ? 0 : Math.PI, davanti ? Math.PI : TAU);
    ctx.strokeStyle = `rgba(${accentoHi},${davanti ? 0.16 : 0.08})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const satellite = (davanti: boolean) => {
    const sin = Math.sin(sat);
    if (davanti !== sin > 0) return;
    const o = orbita();
    const c = Math.cos(o.rot);
    const s = Math.sin(o.rot);
    const ex = o.rx * Math.cos(sat);
    const ey = o.ry * sin;
    const x = o.cx + ex * c - ey * s;
    const y = o.cy + ex * s + ey * c;
    scia.push({ x, y });
    if (scia.length > 26) scia.shift();
    for (let i = 1; i < scia.length; i++) {
      const p = scia[i - 1]!;
      const q = scia[i]!;
      ctx.globalAlpha = (i / scia.length) * 0.35;
      ctx.strokeStyle = `rgb(${accentoHi})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(SP_VIOLA, x - 9, y - 9, 18, 18);
    ctx.drawImage(SP_BIANCO, x - 4, y - 4, 8, 8);
  };

  const disegna = (ora: number, dt: number) => {
    px += (tx - px) * Math.min(1, dt * 3);
    py += (ty - py) * Math.min(1, dt * 3);
    luce += (luceT - luce) * Math.min(1, dt * 4);
    // Con reduced-motion le stelle non seguono lo scroll: niente si muove.
    const scroll = reduce ? 0 : window.scrollY * 0.04;

    ctx.globalAlpha = 1;
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, W, H);

    for (const s of stelle) stella(s, scroll, ora);
    for (const s of nuove) {
      const t = Math.min(1, (ora - s.nato) / 900);
      // Nasce con un piccolo lampo che si posa: scala oltre 1, poi rientra.
      const pop = reduce ? 1 : 1 + Math.sin(t * Math.PI) * 1.6;
      stella({ ...s, r: s.r * pop }, scroll, ora, reduce ? 1 : Math.min(1, t * 2.2));
    }

    metaOrbita(false);
    satellite(false);
    if (pianeta) {
      ctx.globalAlpha = 1;
      ctx.drawImage(pianeta, 0, orizzonte - ALONE, W, pianeta.height / dpr);
    }
    metaOrbita(true);
    satellite(true);

    // Le stelle cadenti: una testa luminosa e una coda che sfuma.
    for (let i = cadenti.length - 1; i >= 0; i--) {
      const c = cadenti[i]!;
      c.t += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const f = c.t / c.vita;
      if (f >= 1) {
        cadenti.splice(i, 1);
        continue;
      }
      const v = Math.hypot(c.vx, c.vy);
      const ex = c.x - (c.vx / v) * c.len;
      const ey = c.y - (c.vy / v) * c.len;
      const gr = ctx.createLinearGradient(c.x, c.y, ex, ey);
      const alfa = Math.sin(f * Math.PI) * (c.forte ? 1 : 0.7);
      gr.addColorStop(0, `rgba(255,255,255,${alfa})`);
      gr.addColorStop(0.15, `rgba(${accentoHi},${alfa * 0.6})`);
      gr.addColorStop(1, `rgba(${accento},0)`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gr;
      ctx.lineWidth = c.forte ? 2 : 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // L'impulso al lancio: un anello che si allarga dal bottone e si spegne.
    for (let i = impulsi.length - 1; i >= 0; i--) {
      const p = impulsi[i]!;
      p.t += dt;
      const f = p.t / 0.9;
      if (f >= 1) {
        impulsi.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = (1 - f) * 0.6;
      ctx.strokeStyle = `rgb(${accentoHi})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 + f * 140, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  /* ---- Il ciclo -------------------------------------------------------------- */
  let raf = 0;
  let prima = 0;
  let attivo = false;
  const passo = touch ? 1000 / 30 : 0;

  const giro = (ora: number) => {
    raf = requestAnimationFrame(giro);
    const dt = prima ? Math.min(0.1, (ora - prima) / 1000) : 0;
    if (passo && ora - prima < passo - 1) return;
    prima = ora;
    sat += dt * (TAU / 70); // un giro ogni 70 secondi
    prossimaCadente -= dt;
    if (prossimaCadente <= 0) {
      prossimaCadente = 7 + Math.random() * 9;
      const x = W * (0.25 + Math.random() * 0.7);
      const y = H * (0.04 + Math.random() * 0.3);
      const ang = Math.PI * (0.78 + Math.random() * 0.1); // giù e a sinistra
      const v = 700 + Math.random() * 300;
      cadenti.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, len: 120 + Math.random() * 90, vita: 0.9, t: 0, forte: false });
    }
    disegna(ora, dt);
  };

  const avvia = () => {
    if (attivo || reduce) return;
    attivo = true;
    prima = 0;
    raf = requestAnimationFrame(giro);
  };
  const ferma = () => {
    attivo = false;
    cancelAnimationFrame(raf);
  };

  misura();
  disegna(performance.now(), 0);

  let visibile = false;
  new IntersectionObserver(([e]) => {
    visibile = !!e?.isIntersecting;
    if (visibile && !document.hidden) avvia();
    else ferma();
  }).observe(sezione);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ferma();
    else if (visibile) avvia();
  });

  let attesa = 0;
  new ResizeObserver(() => {
    clearTimeout(attesa);
    attesa = window.setTimeout(() => {
      misura();
      disegna(performance.now(), 0);
    }, 120);
  }).observe(canvas);
}
