/**
 * Le regole sugli allegati del modulo contatti, in UN posto solo.
 *
 * Le leggono tre lettori: la pagina (`accept` dell'input e il testo d'aiuto),
 * lo script del modulo (il controllo prima dell'invio) e la funzione Vercel
 * (`api/contatti.ts`, il controllo che conta davvero). Ricopiate in tre posti
 * divergerebbero al primo ritocco, e l'utente vedrebbe un file accettato dalla
 * pagina e rifiutato dal server.
 *
 * ⚠ Questo file NON deve importare niente che dipenda da Astro o da Vite
 * (`import.meta.env`, `astro:assets`…): la funzione Vercel lo importa fuori da
 * Astro, in Node puro.
 */

/**
 * ⚠ 4 MB IN TOTALE, ed è il limite della piattaforma, non una scelta di gusto.
 * Una funzione Vercel accetta al massimo 4,5 MB di corpo della richiesta; il
 * modulo ci aggiunge i campi di testo e l'involucro multipart, quindi 4 MB di
 * file è il massimo che arriva sempre intero. Gmail ne accetterebbe 25: per
 * file più grandi il testo d'aiuto suggerisce un link (Drive, WeTransfer).
 * Alzarlo richiederebbe di caricare i file direttamente su uno storage (Vercel
 * Blob) invece di farli passare dalla funzione.
 */
export const MAX_TOTALE = 4 * 1024 * 1024;
export const MAX_FILE = 10;

/**
 * I tipi ammessi: quelli che si mandano normalmente per posta (documenti,
 * fogli, presentazioni, immagini, grafica, audio/video brevi, archivi).
 * Fuori tutto ciò che Gmail e Resend bloccano come eseguibile (.exe, .js,
 * .bat, .msi, .jar…), che in un modulo di contatto non ha nessun motivo di
 * arrivare. Si controlla l'ESTENSIONE e non il tipo MIME: il MIME lo dichiara
 * il browser del mittente, e per molti formati (.pages, .key, .heic) è vuoto.
 */
export const ESTENSIONI = [
  // Documenti
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages',
  // Fogli e presentazioni
  'xls', 'xlsx', 'ods', 'csv', 'numbers', 'ppt', 'pptx', 'odp', 'key',
  // Immagini
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg',
  // Grafica
  'ai', 'eps', 'psd', 'fig', 'sketch', 'xd',
  // Audio e video (brevi: il tetto dei 4 MB vale anche qui)
  'mp3', 'm4a', 'wav', 'mp4', 'mov', 'webm',
  // Archivi
  'zip', 'rar', '7z',
] as const;

/** Per l'attributo `accept` dell'input. */
export const ACCEPT = ESTENSIONI.map((e) => `.${e}`).join(',');

export function estensione(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i < 0 ? '' : nome.slice(i + 1).toLowerCase();
}

export function ammesso(nome: string): boolean {
  return (ESTENSIONI as readonly string[]).includes(estensione(nome));
}

/** «1,2 MB», «340 KB»: per il testo, non per i conti. */
export function peso(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  // «4 MB» e non «4,0 MB»: lo zero decimale è rumore.
  return `${(byte / (1024 * 1024)).toFixed(1).replace(/\.0$/, '').replace('.', ',')} MB`;
}
