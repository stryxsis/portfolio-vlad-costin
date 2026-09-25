/**
 * La palette di un case study, e la verifica che la rende sicura da usare.
 *
 * Ogni progetto può dichiarare nel frontmatter la propria atmosfera (vedi
 * `palette` in content.config.ts): il case study la applica come variabili CSS
 * LOCALI all'`<article>`, quindi il resto del sito non ne sa niente.
 *
 * ⚠ IL CONTRASTO SI VERIFICA A BUILD TIME, NON A OCCHIO. Una palette scritta
 * nel frontmatter finisce sotto testo vero (titolo, label mono da 12px,
 * contatore, parole d'accento nel corpo): un accento che su un fondo "sembra
 * leggibile" è esattamente il caso in cui lo si scopre dopo il deploy. Qui una
 * palette sotto soglia è un ERRORE DI BUILD con il rapporto misurato nel
 * messaggio — stessa filosofia del guard dei capitoli in CaseStudyLayout.
 *
 * ⚠ Si verificano le RELAZIONI (rapporti di contrasto), mai gli hex: è la
 * regola già scritta per `tools/verify-*.mjs`.
 */

export interface Palette {
  background: string;
  surface: string;
  accent: string;
  accentSecondary?: string | undefined;
  border: string;
  text: string;
  textMuted: string;
}

/** `#rgb` o `#rrggbb`. Niente alfa: un colore traslucido non ha un contrasto
 *  verificabile leggendo il valore, dipende da cosa c'è sotto. */
export const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

function rgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminanza relativa WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Il canvas del sito: il corpo del case study resta su questo fondo, quindi
 *  l'accento del progetto deve reggere anche lì, non solo nel palco. */
const CANVAS = '#050505';

/**
 * Le coppie che il layout usa davvero, con la soglia che vale per quell'uso.
 * 4.5 per tutto ciò che è testo (le label mono sono 12px: niente eccezione
 * per il "testo grande"); 3 per il bordo della miniatura attiva, che è un
 * indicatore di stato (WCAG 1.4.11) e non testo.
 */
export function paletteProblems(p: Palette): string[] {
  const checks: [string, string, string, number][] = [
    ['text', p.text, 'background', 4.5],
    ['textMuted', p.textMuted, 'background', 4.5],
    ['accent', p.accent, 'background', 4.5],
    ['text', p.text, 'surface', 4.5],
    ['textMuted', p.textMuted, 'surface', 4.5],
    ['accent', p.accent, 'surface', 3],
    ['accent', p.accent, 'canvas', 4.5],
  ];
  const bg: Record<string, string> = { background: p.background, surface: p.surface, canvas: CANVAS };
  const out: string[] = [];
  for (const [name, fg, on, min] of checks) {
    const r = contrast(fg, bg[on]!);
    if (r < min) out.push(`${name} ${fg} su ${on} ${bg[on]} = ${r.toFixed(2)}:1 (serve ${min}:1)`);
  }
  return out;
}

/**
 * Le variabili CSS che il case study legge. Solo quelle dichiarate: ciò che
 * manca ricade sui token del sito tramite il fallback di `var()` nel CSS, così
 * un progetto senza palette si vede con i colori di sempre invece che rotto.
 */
export function paletteStyle(p: Palette | undefined): string | undefined {
  if (!p) return undefined;
  const vars: [string, string | undefined][] = [
    ['--cs-bg', p.background],
    ['--cs-surface', p.surface],
    ['--cs-accent', p.accent],
    ['--cs-accent-2', p.accentSecondary],
    ['--cs-border', p.border],
    ['--cs-text', p.text],
    ['--cs-text-2', p.textMuted],
  ];
  return vars
    .filter((v): v is [string, string] => Boolean(v[1]))
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}
