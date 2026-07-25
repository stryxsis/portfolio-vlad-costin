/**
 * Formattazione date e periodi in italiano.
 * Un solo posto, così non compaiono formati diversi in pagine diverse.
 */
const MONTH_YEAR = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const FULL = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** "marzo 2025" */
export const monthYear = (d: Date): string => MONTH_YEAR.format(d);

/** "14 marzo 2025" */
export const fullDate = (d: Date): string => FULL.format(d);

/** Attributo `datetime` di <time>: sempre ISO, indipendente dalla lingua.
 *  È questo che rende la data leggibile dalle macchine. */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** "set 2022 — feb 2025" oppure "gen 2025 — in corso" */
export function period(from: string, to?: string): string {
  return `${from} — ${to ?? 'in corso'}`;
}