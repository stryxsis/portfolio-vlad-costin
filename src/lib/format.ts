/**
 * Formattazione date e periodi in italiano.
 * Un solo posto, così non compaiono formati diversi in pagine diverse.
 *
 * `timeZone: 'UTC'` non è un dettaglio: le date senza ora (`2017-09`,
 * `2025-01-15` nel frontmatter) vengono interpretate da JS come mezzanotte UTC,
 * e un formatter che usa il fuso locale le sposta al giorno prima su qualsiasi
 * offset negativo. La build gira in UTC su Vercel e in Europe/Rome in locale:
 * senza questo, lo stesso dato produrrebbe "ago 2017" in un posto e
 * "set 2017" nell'altro.
 */
const MONTH_YEAR = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_YEAR_SHORT = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const FULL = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "marzo 2025" */
export const monthYear = (d: Date): string => MONTH_YEAR.format(d);

/** "14 marzo 2025" */
export const fullDate = (d: Date): string => FULL.format(d);

/** Attributo `datetime` di <time>: sempre ISO, indipendente dalla lingua.
 *  È questo che rende la data leggibile dalle macchine. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** "2017-09" -> "set 2017". Accetta anche "2017-09-01". */
export const monthYearShort = (iso: string): string => MONTH_YEAR_SHORT.format(new Date(iso));

/**
 * Le due metà di un periodo, ognuna con la sua etichetta leggibile.
 *
 * Restituisce le parti separate invece di una stringa unica perché ogni metà
 * diventa un `<time datetime>` distinto: `datetime` non ammette intervalli, e
 * due <time> sono l'unico modo corretto di marcare "da / a". Un'unica stringa
 * "set 2017 — giu 2022" costringerebbe a scegliere quale delle due date mettere
 * nell'attributo.
 */
export function periodParts(
  from: string,
  to?: string
): { from: { iso: string; label: string }; to: { iso: string; label: string } | null } {
  return {
    from: { iso: from, label: monthYearShort(from) },
    to: to ? { iso: to, label: monthYearShort(to) } : null,
  };
}