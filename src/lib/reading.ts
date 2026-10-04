/**
 * Tempo di lettura di un case study, in minuti interi.
 *
 * Conta le parole che si leggono davvero: paragrafi, titoli, citazioni,
 * didascalie e i numeri in evidenza. Fuori gli import, i commenti
 * `{/* … *\/}` (le note DA VERIFICARE) e gli attributi dei componenti, tranne
 * `caption` — il testo alternativo delle immagini non lo legge chi vede la
 * pagina, e contarlo gonfierebbe il numero.
 *
 * 200 parole al minuto, la velocità media di lettura di un testo divulgativo
 * in italiano, più 12 secondi per immagine (la stessa regola di Medium): una
 * schermata di un sito si guarda, non si salta, e senza contarla un case study
 * con cinque figure risultava lungo quanto uno senza.
 */
const WPM = 200;
const SECONDS_PER_FIGURE = 12;

export function readingMinutes(body: string, extra: string[] = []): number {
  const captions = [...body.matchAll(/caption="([^"]*)"/g)].map((m) => m[1]);
  const text = body
    .replace(/^import .*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`>]/g, ' ');
  const words = [text, ...captions, ...extra]
    .join(' ')
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w)).length;
  const figures = (body.match(/<CaseFigure\b/g) ?? []).length;
  return Math.max(1, Math.round(words / WPM + (figures * SECONDS_PER_FIGURE) / 60));
}
