/**
 * IL FONDALE DELLA HERO DI /portfolio — Lightfall, quello vero.
 *
 * ⚠ QUESTA È LA SECONDA STESURA, E RIBALTA LA PRIMA. Fino al 2026-09-10 il
 * fondale era una simulazione in CSS: nove `<span>` sfocati che cadevano in
 * ventaglio, zero JS e zero WebGL. La nota che stava in `Lightfall.astro`
 * argomentava che «per questo effetto WebGL non serve» — e si sbagliava, ma non
 * per il ragionamento: per il bersaglio. Nove elementi che traslano possono dire
 * «della luce cade»; non possono dire «sono dentro un tunnel di filamenti che
 * precipitano verso di me», che è la cosa che Vlad voleva e che ha chiesto
 * esplicitamente il 2026-09-10, autorizzando `ogl` e revocando la decisione
 * precedente: «la priorità adesso è la fedeltà visiva al vero Lightfall […] NON
 * trasformare di nuovo lo shader in una manciata di div animate».
 *
 * ⚠ `ogl` È STATO INSTALLATO. Rientra nel criterio già fissato con `cobe` (la
 * 404): vanilla, zero dipendenze, nessun runtime da idratare, si importa la sola
 * manciata di classi che serve — `Renderer`, `Program`, `Mesh`, `Triangle`.
 * Quello che resta fuori è, come sempre, React e il wrapper di componenti del
 * riferimento. La ragione per cui era stato escluso DUE volte (stelle della 404,
 * prima stesura di questo fondale) non era «è una libreria» ma «per quell'effetto
 * non serve»: qui serve, quindi entra.
 *
 * ═══ COSA FA LO SHADER, perché non è «linee che scendono» ═══════════════════
 *
 * La matematica è quella del riferimento (react-bits/Lightfall), portata quasi
 * alla lettera. Vale la pena capirla prima di toccarne un parametro:
 *
 * 1. `sceneC()` fa un RAYMARCH di 39 passi contro una SUPERQUADRICA — non una
 *    sfera: `d = 1 - (x⁴+y⁴+z⁴+w⁴)^¼`, cioè la distanza in norma-4, che dà un
 *    solido a spigoli morbidi. Per ogni pixel restituisce DUE coordinate sulla
 *    superficie colpita: `O.x` e l'angolo `atan(O.z, O.y)`.
 *    ⚠ È QUI CHE NASCE IL TUNNEL. Le scie non vivono nello spazio dello schermo,
 *    vivono su quella superficie: la prospettiva, la curvatura delle traiettorie
 *    e il punto di fuga sono conseguenze della proiezione, non cose disegnate.
 *    Nessuna riproduzione in CSS può arrivarci, ed è il motivo di questa stesura.
 * 2. Le scie sono RIPETIZIONE DI DOMINIO su quella superficie: la x è divisa in
 *    celle da 5e-3 (tantissime, da cui la densità) e l'angolo in `angRings`
 *    settori. Ogni cella estrae per hash la propria fase, colore e luminosità.
 * 3. Ogni scia è una TESTA più una CODA: `inner.y` è un punto (peso 3, quindi
 *    satura a bianco), `inner.x` è la distanza da una semiretta modulata da
 *    `exp(tail * Pp.y)` — la coda che si spegne esponenzialmente. Da qui le
 *    «estremità molto luminose» del riferimento.
 * 4. Il fondo NON è una campitura: `uBgColor * 90 * uBgGlow / (1e3*dot(P,P)+6)`
 *    è un bagliore centrato IN ALTO AL CENTRO che decade come 1/r². ⚠ Ecco
 *    perché il `#0A29FF` del riferimento non dipinge una pagina blu: dipinge una
 *    luce blu in alto che sfuma a nero ai bordi. È esattamente la gerarchia che
 *    Vlad ha chiesto («lati quasi neri, grande luce diffusa nella zona alta»), e
 *    rende l'adattamento alla palette del sito una sostituzione di tinta, non un
 *    ridisegno.
 * 5. `sqrt(tanh(...))` è il tone mapping: comprime e alza le basse luci. ⚠ È LUI
 *    a produrre il bianco sulle punte senza che nessun colore bianco esista in
 *    palette — un canale che arriva a 3-6 esce da tanh a ~1. Per questo qui NON
 *    serve un quarto token «bianco freddo»: il bianco è il risultato, non un
 *    ingrediente.
 *
 * ═══ COSA È STATO CAMBIATO DEL RIFERIMENTO ═════════════════════════════════
 *
 * ⚠ I COLORI SI LEGGONO DAI TOKEN CSS A RUNTIME, non si ricopiano. La 404 aveva
 * dovuto ricopiare `--color-accent` come tre float («l'unico punto del sito che
 * ricopia un token invece di leggerlo», dice la sua nota) perché WebGL non
 * accetta una stringa CSS. Non era inevitabile: `getComputedStyle` la stringa la
 * dà, e convertirla costa quattro righe. Qui la palette resta a fonte unica —
 * si cambia `--color-accent` in `global.css` e il fondale cambia con lui.
 *
 * ⚠ NIENTE INTERAZIONE COL PUNTATORE, benché il riferimento ce l'abbia e Vlad
 * l'avesse permessa «molto sottile». Il sito ha una regola esplicita («niente
 * hover come innesco, tranne i link») e lui stesso ha posto il vincolo che conta:
 * «l'effetto fondamentale deve essere bellissimo anche senza muovere il mouse».
 * Se è vero senza, la componente col mouse è un listener, due uniform e del
 * lavoro per fotogramma in cambio di niente — e su touch non esisterebbe
 * comunque. Tolta: uniform, uniform del colore e ramo nello shader.
 *
 * ⚠ `uGuard` È NUOVO E NON STA NEL RIFERIMENTO: un'attenuazione ellittica e
 * morbida attorno al blocco di testo. Vale la pena dire dove agisce, perché è la
 * differenza fra «una scena sola» e «animazione più rettangolo scuro sopra»:
 * moltiplica la radianza PRIMA del tone mapping, quindi si comporta come una
 * sorgente più debole in quella zona, non come un velo appoggiato sopra. Le scie
 * luminose, che a quel punto sono già oltre la saturazione di `tanh`, passano
 * comunque; a cedere è il bagliore diffuso, che è ciò che toglie contrasto al
 * testo. Nessun bordo, perché è una gaussiana.
 */
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { P, TOKEN_SCIE, TOKEN_BAGLIORE, TOKEN_FONDO } from './lightfallParametri';



type RGB = [number, number, number];

/** `#9370f5` → [0.576, 0.439, 0.961]. Accetta anche la forma a 3 cifre. */
function hexToRGB(hex: string, fallback: RGB): RGB {
  const c = hex.trim().replace('#', '');
  const esteso = c.length === 3 ? c[0]! + c[0]! + c[1]! + c[1]! + c[2]! + c[2]! : c;
  if (!/^[0-9a-f]{6}$/i.test(esteso)) return fallback;
  return [
    parseInt(esteso.slice(0, 2), 16) / 255,
    parseInt(esteso.slice(2, 4), 16) / 255,
    parseInt(esteso.slice(4, 6), 16) / 255,
  ];
}

function tokenRGB(stile: CSSStyleDeclaration, nome: string, fallback: RGB): RGB {
  return hexToRGB(stile.getPropertyValue(nome), fallback);
}



const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;

uniform vec3  iResolution;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uBgColor;
uniform vec3  uCanvas;

uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uSoftness;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uBgSpread;
uniform float uBgLift;
uniform float uBgAniso;

uniform float uGuardStrength;
uniform vec2  uGuardCenter;
uniform vec2  uGuardRadius;
uniform float uFloorFade;

/* L'INGRESSO: «l'arrivo» (2026-10-12, seconda stesura). Vedi il blocco nel
   ciclo delle scie e WARP più sotto, nel JS.
   uT       il tempo della scena, già integrato dal JS: durante l'arrivo scorre
            più veloce, poi rallenta fino alla crociera.
   uStretch quanto si allungano le code durante la corsa veloce (1 = normali).
   uGate    1 = vale la regola delle nascite (sempre, tranne col fotogramma
            fermo del movimento ridotto).
   uT0      il tempo della scena all'inizio dell'arrivo.
   uSpanT   in quanto tempo-scena nascono tutte le scie.
   uTop     l'angolo della superficie sul bordo ALTO dello schermo. */
uniform float uT;
uniform float uStretch;
uniform float uGate;
uniform float uT0;
uniform float uSpanT;
uniform float uTop;

varying vec2 vUv;

const float TAU = 6.28318530718;

vec3 palette(float h) {
  int idx = int(floor(clamp(h, 0.0, 0.999999) * 3.0));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  return uColor2;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

/* Il raymarch: 39 passi contro la superquadrica in norma-4. Restituisce le
   coordinate (x, angolo) del punto colpito sulla sua superficie — lo spazio in
   cui vivono le scie. Vedi il punto 1 in testa al file. */
vec2 sceneC(vec2 frag, vec2 r) {
  vec2 Pn = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(Pn, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = uT;
  float angRings = max(1.0, floor(TAU * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, TAU / angRings);

  /* Le derivate della parametrizzazione, a mano: servono ad antialiasare le
     scie con la larghezza giusta in pixel. E' il motivo per cui sceneC() viene
     chiamata TRE volte per pixel: il costo dominante di questo shader. */
  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= TAU * floor(dCx.y / TAU + 0.5);
  dCy.y -= TAU * floor(dCy.y / TAU + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  /* La sorgente. Pb.y si azzera dove sta il nucleo: in alto al centro, cioe' il
     punto di fuga del tunnel.
     ⚠ uBgLift LO SPINGE SOPRA IL BORDO, e non e' una rifinitura: col nucleo
     esattamente sul bordo alto (il riferimento) l'indice "00 · PORTFOLIO" ci
     finiva dentro e scendeva da 5.70:1 su nero a 3.19:1 mediano — misurato.
     Portando la sorgente FUORI si vede solo il suo decadimento: la luce grande e
     diffusa resta (anzi, e' piu' morbida, senza il nucleo bruciato), e sotto ci
     si puo' scrivere. E' lo stesso dispositivo del core della CTA in Home e del
     bagliore della prima stesura di questo fondale, entrambi ancorati fuori dal
     bordo per la stessa ragione. */
  /* ⚠ E uBgAniso NE CAMBIA LA FORMA, che e' la leva che ha risolto davvero.
     Nel riferimento la x e' moltiplicata per 2 e la y per 1: la sorgente e'
     quindi un'ellisse ALTA E STRETTA, un fuso di luce che punta dritto in basso
     — e in questa hero puntava esattamente sull'indice di sezione. Alzando il
     fattore sulla y la luce decade prima in verticale e si distende in
     orizzontale: diventa una fascia larga appoggiata al bordo alto, che e'
     insieme la "grande luce diffusa nella zona alta" chiesta da Vlad e la
     versione che lascia respirare il testo sotto. Intensita' e posizione erano
     le due leve ovvie, e barattavano l'una con l'altra; la forma no. */
  float aspH = r.y / r.x;
  vec2 Pb = vec2(2.0, uBgAniso) * uv0 - vec2(0.0, uBgAniso * (aspH + uBgLift));
  vec4 O = vec4(uBgColor * 90.0 * uBgGlow / (uBgSpread * dot(Pb, Pb) + 6.0), 0.0);

  float zr = 5e-4 * uStreakWidth;
  /* ⚠ QUI VIVE LA SFOCATURA. rr e' l'ampiezza su cui la scia sfuma, e vale un
     pixel per costruzione (fw sono le derivate della parametrizzazione, cioe'
     "quanto e' grande un pixel qui sulla superficie"): moltiplicarla per N
     significa "sfoca di N pixel", esattamente come farebbe una lente fuori
     fuoco. Non e' un velo sopra la scena — l'energia della scia si spalma su
     un'area piu' grande, quindi il nucleo si smorza mentre l'alone si allarga.
     ⚠ E vale la pena sapere che il termine si comporta gia' cosi' da se' verso i
     bordi del tunnel: la' la superficie si volta e le derivate esplodono, per
     cui le scie sfumano da sole. Alzare uSoftness estende quel comportamento —
     lontano piu' morbido di vicino — invece di contraddirlo. */
  vec2 rr = vec2(max(length(fw) * uSoftness, 1e-5));
  float tail = 19.0 / max(uStreakLength * uStretch, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    float scia = dot(sm, vec2(exp(tail * Pp.y), 3.0));

    /* ═══ L'ARRIVO: le scie nascono sopra lo schermo ed entrano dall'alto ═══
       Chiesto da Vlad il 2026-10-12: «non che compaiano a caso, ma che
       scendano da sopra, poche alla volta, poi sempre di più». La prima
       stesura (un fronte con una testa finta che disegnava ogni corsia) l'ha
       bocciata: si vedeva che era un effetto appoggiato sopra.
       Qui non c'è niente di finto. Ogni ISTANZA di scia (corsia × ripetizione
       k lungo la superficie) ha un istante di nascita Tb, e si vede solo se in
       quell'istante la sua testa era ancora SOPRA il bordo alto: allora entra
       da sola, scorrendo, con la sua coda dietro. Quelle che a Tb erano già in
       mezzo allo schermo non si vedono mai — e non ricompaiono: il blocco resta
       acceso per sempre (uGate), e loro escono dal basso da sole.
       Il «poche, poi sempre di più» è la radice: Tb = T0 + span·√hash addensa
       le nascite verso la fine. Il JS intanto fa correre la scena (uT) molto
       più veloce della crociera, perché a velocità normale una scia impiega
       15-30 secondi ad attraversare lo schermo, e poi la fa rallentare. */
    if (uGate > 0.5) {
      /* ⚠ L'angolo va SROTOLATO: è un atan(), e sugli schermi alti il bordo
         basso supera π e ricomincia da −π (390×844: 1,76 in alto, −3,11 in
         basso). Sopra il bordo alto non c'è schermo, quindi un angolo più
         piccolo di uTop può solo essere uno che ha fatto il giro. Aggiungere
         TAU non sposta Pp: TAU è un multiplo esatto del passo Y.y. */
      float cy = C.y < uTop - 0.25 ? C.y + TAU : C.y;
      float sp = 1.0 + ic;
      float kk = floor((cy - T * sp) / Y.y + 0.5);
      float hk = fract(sin(dot(vec3(jf, floor(C.x / Y.x + 0.5), kk), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float tb = uT0 + uSpanT * sqrt(hk);
      float testaAllaNascita = (cy - Pp.y) - (T - tb) * sp;
      scia *= step(tb, T) * step(testaAllaNascita, uTop);
    }

    O.rgb += scia * col * weight;
    C.x += Y.x / 8.0;
  }

  /* ⚠ PRIMA del tone mapping, e non dopo: attenuare qui equivale a una sorgente
     più debole in quella zona (le scie sature passano lo stesso), attenuare dopo
     equivale a stendere un velo grigio sopra la scena. */
  /* ⚠ IL RAGGIO VERTICALE E' IN UNITA' DI MEZZA ALTEZZA, non di larghezza — e
     la prima stesura sbagliava. uv0 e' normalizzato sulla LARGHEZZA, quindi un
     raggio in quelle unita' significa cose diverse a seconda della forma della
     finestra: 0.46 copriva il 74% della semialtezza a 1440x900 e solo il 21% a
     390x844, dove il blocco di testo occupa una fetta verticale molto piu'
     grande. Misurato: su telefono lede e coda finivano fuori dalla protezione.
     Moltiplicando per l'aspetto, lo stesso numero vuol dire la stessa cosa su
     ogni schermo — la normalizzazione che il pavimento qui sotto fa gia'. */
  vec2 gc = vec2(uGuardCenter.x, uGuardCenter.y * aspH);
  vec2 gr = vec2(uGuardRadius.x, uGuardRadius.y * aspH);
  vec2 g = (uv0 - gc) / gr;
  O.rgb *= 1.0 - uGuardStrength * exp(-dot(g, g));

  /* Lo spegnimento verso il basso, in coordinate normalizzate sull'ALTEZZA
     (uv0.y e' normalizzato sulla larghezza: senza dividere per l'aspetto, la
     stessa costante cadrebbe a quote diverse a seconda della finestra). */
  float yn = uv0.y / (r.y / r.x);
  O.rgb *= 1.0 - uFloorFade * smoothstep(0.05, -0.85, yn);

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));

  /* Il pavimento: dove lo shader non arriva si vede il nero del SITO, non il
     nero assoluto. Additivo perche' sulle alte luci colr e' gia' a 1. */
  o = vec4(colr + uCanvas, 1.0);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

/* L'angolo della superficie del tunnel sotto un pixel: la stessa sceneC() dello
   shader, rifatta in JS. Serve UNA volta per resize, per sapere quale angolo
   cade sul bordo alto e quale su quello basso — dipende dalla forma della
   finestra (1440×900: 2,21 in alto, 2,75 in basso). ⚠ Se cambia sceneC() o
   lo zoom nello shader, va cambiata con lei. */
function angoloSuperficie(fx: number, fy: number, rx: number, ry: number): number {
  const px = (2 * fx - rx) / rx;
  const py = (2 * fy - ry) / rx;
  const n = Math.hypot(px, py, P.zoom);
  const dx = px / n;
  const dy = py / n;
  const dz = P.zoom / n;
  let z = 0;
  let d = 1e3;
  let oy = 0;
  let oz = 0;
  for (let k = 0; k < 39 && d > 1e-4; k++) {
    const ox = z * dx;
    oy = z * dy - 4 / 4.5;
    oz = z * dz - 1 / 4.5;
    d = 1 - Math.sqrt(Math.hypot(ox * ox, oy * oy, oz * oz));
    z += d;
  }
  return Math.atan2(oz, oy);
}

/* ═══ L'ARRIVO: quanto corre la scena, secondo per secondo ═══════════════════
   Un moltiplicatore della velocità di crociera: pieno fino a `piena`, poi
   scende a 1 con una smoothstep (pendenza nulla ai due capi: niente scatti
   né all'inizio della frenata né all'arrivo in crociera).
   ⚠ ACCORCIATO il 2026-10-12 su richiesta di Vlad («dura un botto, quasi due
   secondi buoni: falli durare un po' di meno, un po' più veloce»): prima le
   nascite duravano 1,5s e la frenata finiva a 4,6s; ora 0,8s e 2,3s, con la
   corsa più veloce (40× invece di 34×) così le scie arrivano comunque in fondo.
   ⚠ La regola delle nascite NON si spegne mai (`uGate` resta a 1): dopo
   l'arrivo non cambia niente — chi entra dall'alto nasce visibile — e così le
   scie rimaste invisibili, nate a metà schermo, escono dal basso da sole senza
   il rischio di ricomparire di colpo. La prima stesura la spegneva a una soglia
   di tempo-scena, e la soglia era stretta su desktop e SBAGLIATA su telefono,
   dove lo schermo copre 1,4 radianti invece di 0,54. */
const WARP = { max: 40, nascite: 0.8, piena: 0.9, fine: 2.3 };
/** Quando le scritte della hero possono entrare: la corsa è quasi in crociera.
 *  Vlad: «che compaia appena l'animazione si è normalizzata». */
const CALMO = WARP.fine - 0.3;
/** Tempo-scena per secondo, a velocità di crociera (era `0.1 · iTime · uSpeed` nello shader). */
const CROCIERA = 0.1 * P.velocita;
const T0 = 9;

function moltiplicatore(t: number): number {
  const u = Math.min(Math.max((t - WARP.piena) / (WARP.fine - WARP.piena), 0), 1);
  const liscio = u * u * (3 - 2 * u);
  return 1 + (WARP.max - 1) * (1 - liscio);
}
/** Il tempo-scena accumulato fino al secondo `t` dell'arrivo (somma a passi). */
function tempoScena(t: number): number {
  let acc = 0;
  for (let x = 0; x < t; x += 0.01) acc += 0.01 * CROCIERA * moltiplicatore(x);
  return acc;
}
const SPAN_T = tempoScena(WARP.nascite);

function webglDisponibile(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/* «Il fondale ha disegnato»: rende visibile il canvas (Lightfall.astro lo tiene
   nascosto finché è un rettangolo nero mai disegnato). Va acceso su OGNI
   strada d'uscita da qui sotto, o resta il fondale statico. */
const accendi = (): void => document.documentElement.classList.add('lf-acceso');
/* «L'arrivo è finito»: le scritte della hero aspettano questa classe (vedi
   «LE SCRITTE ASPETTANO LE SCIE» in PortfolioHero). Come `accendi`, va data su
   ogni strada d'uscita, o le scritte restano nascoste fino al watchdog. */
const calma = (): void => document.documentElement.classList.add('lf-calmo');

export function initLightfall(): void {
  const host = document.querySelector<HTMLElement>('[data-lightfall]');
  if (!host) return;
  /* ⚠ DOPO il cambio pagina, mai durante: compilare questo shader mentre la
     pagina si rivela faceva saltare la transizione fra documenti (vedi la
     nota su `__dopoRivelazione` in BaseLayout). Nell'attesa resta il fondale
     statico, che è la stessa composizione. */
  const attesa = (window as { __dopoRivelazione?: Promise<unknown> }).__dopoRivelazione;
  (attesa ?? Promise.resolve()).then(() => avviaLightfall(host));
}

function avviaLightfall(host: HTMLElement): void {

  /* Senza WebGL non si crea niente e resta il fondale statico dichiarato in CSS
     dal componente: la hero non dipende dallo shader per essere completa. */
  if (!webglDisponibile()) {
    accendi();
    calma();
    return;
  }

  /* ⚠ CON MOVIMENTO RIDOTTO IL FONDALE RESTA, FERMO — al contrario del globo
     della 404, che in quel ramo non viene creato affatto. La differenza è cosa
     resta senza: lì restava una pagina completa di testo, qui resterebbe un
     rettangolo vuoto al posto del fondale. E un fotogramma singolo di questo
     shader è già una composizione piena (le scie sono ripetizione di dominio,
     non una popolazione che si accumula nel tempo), quindi «fermo» qui non
     significa «a metà». */
  const fermo = !matchMedia('(prefers-reduced-motion: no-preference)').matches;

  const stile = getComputedStyle(document.documentElement);
  const scie = TOKEN_SCIE.map((t, i) =>
    tokenRGB(stile, t, [[0.37, 0.24, 0.88], [0.58, 0.44, 0.96], [0.7, 0.61, 0.98]][i] as RGB)
  );
  const bagliore = tokenRGB(stile, TOKEN_BAGLIORE, [0.37, 0.24, 0.88]);
  const fondo = tokenRGB(stile, TOKEN_FONDO, [0.02, 0.02, 0.02]);

  /* ⚠ DPR LIMITATO, e qui conta più che altrove: questo shader fa 39 passi di
     raymarch TRE volte per pixel, cioè ~117 iterazioni per pixel dipinto.
     Raddoppiare il DPR quadruplica quel conto. A 1.5 il fondale resta nitido (è
     fatto di luce diffusa e code sfocate: non ha bordi duri da rivelare) e il
     costo resta un terzo di quello che sarebbe a DPR 3 su un portatile Retina.
     Su telefono si scende a 1: schermo piccolo, GPU piccola, e la geometria —
     tunnel, punto di fuga, profondità — non dipende dalla risoluzione. */
  const suTelefono = matchMedia('(max-width: 56.24rem)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, suTelefono ? 1 : 1.5);

  const renderer = new Renderer({ dpr, alpha: false, antialias: false, depth: false });
  const gl = renderer.gl;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.className = 'lf__canvas';
  host.appendChild(canvas);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iResolution: { value: [1, 1, 1] },
      uColor0: { value: scie[0] },
      uColor1: { value: scie[1] },
      uColor2: { value: scie[2] },
      uBgColor: { value: bagliore },
      uCanvas: { value: fondo },
      uStreakCount: { value: P.numeroScie },
      uStreakWidth: { value: P.larghezzaScia },
      uStreakLength: { value: P.lunghezzaScia },
      uGlow: { value: P.bagliore },
      uDensity: { value: P.densita },
      uSoftness: { value: P.sfocatura },
      uTwinkle: { value: fermo ? 0 : P.scintillio },
      uZoom: { value: P.zoom },
      uBgGlow: { value: P.sorgenteIntensita },
      uBgSpread: { value: P.sorgenteAmpiezza },
      uBgLift: { value: P.sorgenteAltezza },
      uBgAniso: { value: P.sorgenteForma },
      uGuardStrength: { value: P.guardiaForza },
      uGuardCenter: { value: [0, P.guardiaCentroY] },
      uGuardRadius: { value: [P.guardiaRaggioX, P.guardiaRaggioY] },
      uFloorFade: { value: P.pavimento },
      /* Con movimento ridotto niente ingresso: il fotogramma fermo è pieno. */
      uT: { value: T0 },
      uStretch: { value: 1 },
      uGate: { value: fermo ? 0 : 1 },
      uT0: { value: T0 },
      uSpanT: { value: SPAN_T },
      uTop: { value: 2.2 },
    },
  });
  const mesh = new Mesh(gl, { geometry, program });

  /** Disegna al tempo-scena `t` (vedi WARP). */
  const disegna = (t: number): void => {
    program.uniforms.uT!.value = t;
    renderer.render({ scene: mesh });
  };

  const ridimensiona = (): void => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    const bw = gl.drawingBufferWidth;
    const bh = gl.drawingBufferHeight;
    program.uniforms.iResolution!.value = [bw, bh, 1];
    program.uniforms.uTop!.value = angoloSuperficie(bw / 2, bh, bw, bh);
    // Il primo fotogramma dopo un resize va ridisegnato subito anche da fermi,
    // o resterebbe lo stretch del buffer precedente.
    if (fermo) disegna(T0 + 7.4 * CROCIERA);
  };

  const ro = new ResizeObserver(ridimensiona);
  ro.observe(host);
  ridimensiona();

  if (fermo) {
    /* Un fotogramma solo, a un tempo scelto e non a zero: `iTime = 0` è
       comunque una composizione piena (l'offset `+9.0` dentro lo shader esiste
       apposta), ma un valore lontano dall'origine evita che le fasi delle scie
       cadano tutte sullo stesso allineamento iniziale. */
    disegna(T0 + 7.4 * CROCIERA);
    accendi();
    calma();
    return;
  }

  /* ---- Il ciclo -----------------------------------------------------------
     Due interruttori, per due sprechi diversi: la scheda in secondo piano (il
     browser sospende già `rAF` da sé, ma un ritorno deve ripartire senza salti)
     e la hero fuori dalla viewport — che su questa pagina succede appena si
     scorre ai lavori, cioè quasi subito e per il resto della visita. Senza il
     secondo, lo shader più costoso del sito continuerebbe a girare a schermo
     pieno dietro a una sezione che lo copre. */
  let rafId = 0;
  let inVista = true;
  /* Il tempo che lo shader vede è ACCUMULATO, non `performance.now()`: dopo una
     pausa lunga la differenza si vedrebbe come un salto del campo. */
  let tempo = 0;
  let ultimo = 0;
  /* Il tempo-scena, integrato a ogni fotogramma col moltiplicatore dell'arrivo. */
  let scena = T0;

  let primo = true;
  let calmo = false;
  let inizio = 0;
  const ciclo = (ora: number): void => {
    rafId = requestAnimationFrame(ciclo);
    /* Il tetto a 50ms evita che, dopo una pausa (scheda in secondo piano), il
       campo salti avanti. ⚠ MA DURANTE L'ARRIVO è a 250ms: su un dispositivo
       che fa pochi fotogrammi al secondo, con 50ms l'arrivo da 2,3s durava il
       triplo e le scritte (che aspettano la sua fine) arrivavano dal watchdog
       a 6s — misurato in un Chrome senza GPU. */
    const tetto = tempo < WARP.fine * 1000 ? 250 : 50;
    const dt = ultimo === 0 ? 16 : Math.min(ora - ultimo, tetto);
    ultimo = ora;
    tempo += dt;
    /* L'arrivo usa lo stesso orologio accumulato: se la scheda va in secondo
       piano a metà, riprende da dove era invece di saltare alla fine. */
    const m = moltiplicatore(tempo / 1000);
    scena += (dt / 1000) * CROCIERA * m;
    program.uniforms.uStretch!.value = 1 + 0.035 * (m - 1);
    disegna(scena);
    if (inizio === 0) inizio = ora;
    /* Le scritte entrano a fine frenata OPPURE dopo CALMO secondi veri,
       quale arriva prima: un dispositivo lento non deve far aspettare il testo. */
    if (!calmo && (tempo / 1000 >= CALMO || ora - inizio >= CALMO * 1000)) {
      calmo = true;
      calma();
    }
    /* Si accende DOPO il primo fotogramma disegnato, non all'avvio: è il
       primo `render()` a compilare davvero lo shader, ed è quello il momento
       lento. Il rAF successivo è il primo in cui quel fotogramma è a schermo. */
    if (primo) {
      primo = false;
      requestAnimationFrame(accendi);
    }
  };

  const avvia = (): void => {
    if (rafId !== 0) return;
    ultimo = 0;
    rafId = requestAnimationFrame(ciclo);
  };
  const ferma = (): void => {
    if (rafId === 0) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const aggiorna = (): void => {
    if (inVista && !document.hidden) avvia();
    else ferma();
  };

  /* ⚠ SI GUARDA LA FRAZIONE VISIBILE, NON `isIntersecting`, e la prima stesura
     sbagliava proprio questo (peggiorata da un `rootMargin: 120px` che allargava
     ulteriormente la zona "in vista"). Il motivo e' geometrico e vale solo per
     questa pagina: la hero e' lo schermo USCENTE di un handoff M12, e
     /portfolio finisce PRIMA che quell'handoff si concluda — misurato, a scroll
     massimo la sezione ha ancora 102px dentro la viewport su 864, cioe' il 12%,
     per giunta coperti dalla griglia dei lavori che le e' salita sopra. Con
     `isIntersecting` il ciclo non si sarebbe fermato MAI: lo shader piu' costoso
     del sito avrebbe continuato a girare a schermo pieno dietro a una sezione
     opaca, per tutto il resto della visita.
     La soglia a 0.2 e' sopra quel 12% e molto sotto l'unita': quando meno di un
     quinto della hero e' ancora nel riquadro, quel quinto e' comunque coperto —
     fermarsi li' non e' osservabile. */
  const io = new IntersectionObserver(
    (voci) => {
      const v = voci[voci.length - 1];
      if (v) inVista = v.intersectionRatio >= 0.2;
      aggiorna();
    },
    { threshold: [0, 0.2, 0.5, 1] }
  );
  io.observe(host);
  document.addEventListener('visibilitychange', aggiorna);

  avvia();

  /* Cleanup completo. Non c'è un router che smonti le pagine (il sito è
     statico, ogni navigazione è un documento nuovo), quindi in pratica corre
     solo allo scaricamento — ma un contesto WebGL, un rAF e due observer lasciati
     appesi sono esattamente le cose che un domani con `ClientRouter` diventano
     una perdita silenziosa. */
  const smonta = (): void => {
    ferma();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', aggiorna);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
  window.addEventListener('pagehide', smonta, { once: true });
}
