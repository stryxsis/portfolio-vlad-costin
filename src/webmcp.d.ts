/**
 * Gli attributi del WebMCP dichiarativo (2026-10-17), che i tipi HTML di Astro
 * non conoscono ancora. Li usa il modulo di /contatti: `toolname` e
 * `tooldescription` sul `<form>` lo registrano come strumento per gli agenti
 * AI nel browser, `toolparamdescription` descrive ogni campo.
 *
 * I nomi sono quelli che Chrome legge davvero (verificati via CDP, dominio
 * `WebMCP`, con `--enable-features=WebMCP`), non quelli di una bozza.
 */
declare namespace astroHTML.JSX {
  interface FormHTMLAttributes {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: boolean | string;
  }
  interface HTMLAttributes {
    toolparamdescription?: string;
  }
}
