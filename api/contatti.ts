/**
 * POST /api/contatti — il modulo della pagina contatti, spedito con Resend.
 *
 * ⚠ È UNA FUNZIONE VERCEL «NUDA» (cartella `api/` nella radice), NON una rotta
 * Astro con l'adapter. Il sito resta statico al 100%: l'adapter `@astrojs/vercel`
 * cambierebbe l'output di tutta la build e non supporta `astro preview`, su cui
 * si appoggiano tutti gli strumenti di verifica del repo (`tools/*.mjs`).
 * Vercel costruisce da sé le funzioni in `api/` accanto all'output statico.
 * Conseguenza: in `npm run dev` / `preview` questa rotta NON esiste (il modulo
 * mostra l'errore con l'email di riserva). Per provarla in locale: `vercel dev`.
 *
 * ⚠ NESSUNA DIPENDENZA: niente SDK di Resend, una `fetch` alla sua API REST.
 *
 * VARIABILI D'AMBIENTE (su Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   obbligatoria. Senza, la funzione risponde 500 e il modulo
 *                    propone l'email diretta.
 *   CONTACT_TO       facoltativa. Dove arrivano i messaggi. Default: l'email di
 *                    lavoro di Vlad (la stessa di `SITE.author.email`).
 *   CONTACT_FROM     facoltativa. Il mittente. Finché il dominio non è
 *                    verificato su Resend vale solo `onboarding@resend.dev`, che
 *                    può scrivere SOLO all'email dell'account Resend. Dopo la
 *                    verifica: es. `Sito Vlad Costin <modulo@vladcostin-developer.com>`.
 *   CONTACT_CONFIRM  facoltativa, `1` per mandare anche una conferma a chi
 *                    scrive. Richiede il dominio verificato (si scrive a
 *                    indirizzi qualunque), quindi è spenta di default.
 *
 * Due modi di rispondere, perché il modulo funziona anche senza JavaScript:
 *   - con `Accept: application/json` (lo script del modulo) → JSON;
 *   - altrimenti (invio HTML nudo) → 303 verso /contatti#inviato o #errore, che
 *     la pagina mostra con `:target`, in CSS puro.
 */
import { MAX_FILE, MAX_TOTALE, ammesso } from '../src/lib/allegati.ts';

/* La stessa di `SITE.author.email`. Non importata da `site.ts` perché quel file
   legge `import.meta.env`, che fuori da Astro non esiste. */
const EMAIL_DEFAULT = 'info@vladcostin-developer.com';
const FROM_DEFAULT = 'Sito Vlad Costin <onboarding@resend.dev>';

const BISOGNI = ['Un sito nuovo', 'Rifare un sito', 'Un’app o un gestionale', 'Ancora non lo so'];

/* `conferma`: la ricevuta a chi scrive è partita davvero. La legge la notifica
   del modulo per dirlo — solo se è vero. */
type Esito = { ok: true; conferma?: boolean } | { ok: false; errore: string; campo?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function rispondi(req: Request, status: number, esito: Esito): Response {
  const vuoleJson = (req.headers.get('accept') ?? '').includes('application/json');
  if (vuoleJson) {
    return new Response(JSON.stringify(esito), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const dove = esito.ok ? '/contatti#inviato' : '/contatti#errore';
  return new Response(null, { status: 303, headers: { location: dove } });
}

async function inBase64(f: File): Promise<string> {
  return Buffer.from(await f.arrayBuffer()).toString('base64');
}

async function resend(chiave: string, corpo: unknown): Promise<boolean> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${chiave}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) console.error('[contatti] Resend', r.status, await r.text().catch(() => ''));
  return r.ok;
}

export async function POST(req: Request): Promise<Response> {
  let dati: FormData;
  try {
    dati = await req.formData();
  } catch {
    return rispondi(req, 400, { ok: false, errore: 'Richiesta non valida.' });
  }
  const testo = (k: string, max: number) => String(dati.get(k) ?? '').trim().slice(0, max);

  /* Le trappole per i bot. `sito` è un campo nascosto che una persona non vede
     e un bot compila; `t` è l'istante in cui la pagina è stata aperta (lo
     scrive lo script): sotto i 3 secondi nessuno ha scritto un messaggio vero.
     A un bot si risponde «ok», così non impara a girarci intorno. */
  if (testo('sito', 200)) return rispondi(req, 200, { ok: true });
  const t = Number(dati.get('t'));
  if (Number.isFinite(t) && t > 0 && Date.now() - t < 3000) return rispondi(req, 200, { ok: true });

  const nome = testo('nome', 120);
  const email = testo('email', 200);
  const azienda = testo('azienda', 160);
  const messaggio = testo('messaggio', 6000);
  const bisogni = dati
    .getAll('bisogno')
    .map(String)
    .filter((b) => BISOGNI.includes(b));

  if (!nome) return rispondi(req, 422, { ok: false, errore: 'Manca il nome.', campo: 'nome' });
  if (!EMAIL_RE.test(email))
    return rispondi(req, 422, { ok: false, errore: 'L’email non sembra valida.', campo: 'email' });
  if (messaggio.length < 10)
    return rispondi(req, 422, { ok: false, errore: 'Il messaggio è troppo corto.', campo: 'messaggio' });

  const file = dati.getAll('allegati').filter((f): f is File => f instanceof File && f.size > 0);
  if (file.length > MAX_FILE)
    return rispondi(req, 413, { ok: false, errore: `Al massimo ${MAX_FILE} allegati.`, campo: 'allegati' });
  if (file.reduce((s, f) => s + f.size, 0) > MAX_TOTALE)
    return rispondi(req, 413, { ok: false, errore: 'Gli allegati superano i 4 MB.', campo: 'allegati' });
  const rifiutato = file.find((f) => !ammesso(f.name));
  if (rifiutato)
    return rispondi(req, 415, {
      ok: false,
      errore: `Il tipo di «${rifiutato.name}» non è ammesso.`,
      campo: 'allegati',
    });

  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) {
    console.error('[contatti] RESEND_API_KEY mancante');
    return rispondi(req, 500, { ok: false, errore: 'Il modulo non è ancora collegato.' });
  }
  const a = process.env.CONTACT_TO || EMAIL_DEFAULT;
  const da = process.env.CONTACT_FROM || FROM_DEFAULT;

  const righe: [string, string][] = [
    ['Nome', nome],
    ['Email', email],
    ...(azienda ? ([['Azienda', azienda]] as [string, string][]) : []),
    ...(bisogni.length ? ([['Cerca', bisogni.join(', ')]] as [string, string][]) : []),
    ...(file.length ? ([['Allegati', file.map((f) => f.name).join(', ')]] as [string, string][]) : []),
  ];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#111">
<table style="border-collapse:collapse;margin-bottom:20px">${righe
    .map(
      ([k, v]) =>
        `<tr><td style="padding:3px 16px 3px 0;color:#666;vertical-align:top">${k}</td><td style="padding:3px 0">${esc(v)}</td></tr>`
    )
    .join('')}</table>
<div style="white-space:pre-wrap;border-top:1px solid #ddd;padding-top:16px">${esc(messaggio)}</div>
</div>`;
  const text = `${righe.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${messaggio}`;

  const inviato = await resend(chiave, {
    from: da,
    to: [a],
    reply_to: email,
    subject: `Nuovo contatto dal sito — ${nome}`,
    html,
    text,
    attachments: await Promise.all(
      file.map(async (f) => ({ filename: f.name.slice(0, 180), content: await inBase64(f) }))
    ),
  });
  if (!inviato) return rispondi(req, 502, { ok: false, errore: 'L’invio non è riuscito.' });

  let conferma = false;
  if (process.env.CONTACT_CONFIRM === '1') {
    /* La conferma a chi scrive (attivata da Vlad il 2026-10-13, dominio
       verificato). Dice solo che il messaggio è arrivato e come aggiungere
       qualcosa: rispondendo, la risposta va a Vlad (`reply_to`).
       ⚠ NON ripete il testo del messaggio né gli allegati, ed è una difesa, non
       una dimenticanza: il destinatario è un indirizzo SCRITTO DA CHI COMPILA,
       quindi un modulo che rispedisce il testo ricevuto diventa un modo per
       mandare email qualunque a chiunque, dal dominio del sito. Per lo stesso
       motivo il nome nel saluto è accorciato.
       Se fallisce, il messaggio a Vlad è comunque partito: non si dice
       all'utente che qualcosa è andato storto. */
    const sito = new URL(req.url).origin;
    const saluto = nome.split(/\s+/)[0]?.slice(0, 40) || nome.slice(0, 40);
    conferma = await resend(chiave, {
      from: da,
      to: [email],
      reply_to: a,
      subject: 'Ho ricevuto il tuo messaggio',
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px">
<p style="margin:0 0 16px">Ciao ${esc(saluto)},</p>
<p style="margin:0 0 16px">grazie per avermi scritto: il tuo messaggio è arrivato. Lo leggo e ti rispondo appena posso, a questo indirizzo.</p>
<p style="margin:0 0 24px">Se vuoi aggiungere qualcosa, basta rispondere a questa email.</p>
<p style="margin:0">Vlad Costin<br><a href="${sito}" style="color:#5f3ce0">${esc(new URL(sito).host)}</a></p>
<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#777">Ricevi questa email perché hai usato il modulo di contatto del sito. Se non sei stato tu, puoi ignorarla.</p>
</div>`,
      text: `Ciao ${saluto},\n\ngrazie per avermi scritto: il tuo messaggio è arrivato. Lo leggo e ti rispondo appena posso, a questo indirizzo.\n\nSe vuoi aggiungere qualcosa, basta rispondere a questa email.\n\nVlad Costin\n${sito}\n\n—\nRicevi questa email perché hai usato il modulo di contatto del sito. Se non sei stato tu, puoi ignorarla.`,
    });
  }

  return rispondi(req, 200, { ok: true, conferma });
}

/* Tutto il resto non è previsto. */
export function GET(): Response {
  return new Response('Metodo non consentito', { status: 405, headers: { allow: 'POST' } });
}
