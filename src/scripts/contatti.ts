/**
 * Il modulo di /contatti (2026-10-05).
 *
 * ⚠ IL MODULO FUNZIONA ANCHE SENZA QUESTO FILE: `action="/api/contatti"`,
 * `multipart/form-data`, la validazione nativa del browser e la risposta 303
 * verso `#inviato` / `#errore` (che la pagina mostra con `:target`). Questo
 * script è un miglioramento: errori sotto i campi invece del fumetto del
 * browser, allegati trascinabili con il loro elenco, invio senza ricaricare,
 * e i due segnali al cielo di spazio.ts.
 */
import { MAX_FILE, MAX_TOTALE, ammesso, estensione, peso } from '../lib/allegati';

export function initContatti(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contatti]');
  if (!form) return;
  const ok = document.querySelector<HTMLElement>('[data-ok]');
  const esito = form.querySelector<HTMLElement>('[data-esito]');
  const invia = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const input = form.querySelector<HTMLInputElement>('input[type="file"]');
  const zona = form.querySelector<HTMLElement>('[data-drop]');
  const lista = form.querySelector<HTMLElement>('[data-files]');
  const misura = form.querySelector<HTMLElement>('[data-files-meter]');
  const avviso = form.querySelector<HTMLElement>('[data-files-note]');
  const msg = form.querySelector<HTMLTextAreaElement>('textarea[name="messaggio"]');

  // Da qui gli errori li mostra lo script, non il fumetto del browser.
  form.noValidate = true;
  const t = form.querySelector<HTMLInputElement>('input[name="t"]');
  if (t) t.value = String(Date.now());

  /* ---- Gli allegati ---------------------------------------------------------- */
  let files: File[] = [];
  const totale = () => files.reduce((s, f) => s + f.size, 0);

  const nota = (testo: string) => {
    if (!avviso) return;
    avviso.textContent = testo;
    avviso.hidden = !testo;
  };

  const disegnaLista = () => {
    if (!lista) return;
    lista.replaceChildren(
      ...files.map((f, i) => {
        const li = document.createElement('li');
        li.className = 'ct__file';
        const ext = document.createElement('span');
        ext.className = 'ct__file-ext';
        ext.textContent = estensione(f.name) || 'file';
        const nome = document.createElement('span');
        nome.className = 'ct__file-name';
        nome.textContent = f.name;
        const kb = document.createElement('span');
        kb.className = 'ct__file-size';
        kb.textContent = peso(f.size);
        const via = document.createElement('button');
        via.type = 'button';
        via.className = 'ct__file-x';
        via.setAttribute('aria-label', `Rimuovi ${f.name}`);
        via.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5"/></svg>';
        via.addEventListener('click', () => {
          files.splice(i, 1);
          nota('');
          disegnaLista();
          zona?.focus();
        });
        li.append(ext, nome, kb, via);
        return li;
      })
    );
    lista.hidden = files.length === 0;
    if (misura) {
      misura.hidden = files.length === 0;
      misura.style.setProperty('--pieno', String(Math.min(1, totale() / MAX_TOTALE)));
      const testo = misura.querySelector('[data-files-total]');
      if (testo) testo.textContent = `${peso(totale())} di ${peso(MAX_TOTALE)}`;
    }
  };

  const aggiungi = (nuovi: Iterable<File>) => {
    const scartati: string[] = [];
    for (const f of nuovi) {
      if (files.some((g) => g.name === f.name && g.size === f.size)) continue;
      if (!ammesso(f.name)) {
        scartati.push(`«${f.name}»: tipo non ammesso`);
        continue;
      }
      if (files.length >= MAX_FILE) {
        scartati.push(`al massimo ${MAX_FILE} file`);
        break;
      }
      if (totale() + f.size > MAX_TOTALE) {
        scartati.push(`«${f.name}» supera i 4 MB totali`);
        continue;
      }
      files.push(f);
    }
    nota(scartati.length ? `Non aggiunto: ${scartati.join('; ')}. Per file grandi, metti un link nel messaggio.` : '');
    disegnaLista();
  };

  input?.addEventListener('change', () => {
    if (input.files) aggiungi(input.files);
    // Svuotato, così si può riscegliere lo stesso file dopo averlo tolto.
    input.value = '';
  });

  if (zona) {
    const ha = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    zona.addEventListener('dragenter', (e) => {
      if (!ha(e)) return;
      e.preventDefault();
      zona.classList.add('is-over');
    });
    zona.addEventListener('dragover', (e) => {
      if (!ha(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    zona.addEventListener('dragleave', (e) => {
      if (!zona.contains(e.relatedTarget as Node | null)) zona.classList.remove('is-over');
    });
    zona.addEventListener('drop', (e) => {
      e.preventDefault();
      zona.classList.remove('is-over');
      if (e.dataTransfer?.files) aggiungi(e.dataTransfer.files);
    });
    /* Un file lasciato cadere FUORI dalla zona aprirebbe il file nel browser e
       farebbe perdere tutto ciò che si è scritto. */
    window.addEventListener('dragover', (e) => {
      if (ha(e)) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      if (ha(e)) e.preventDefault();
    });
    // La zona è un'etichetta dell'input: Invio e Spazio la aprono come un bottone.
    zona.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input?.click();
      }
    });
  }

  /* ---- Ogni parola accende una stella --------------------------------------- */
  let ultima = 0;
  msg?.addEventListener('input', (e) => {
    const v = msg.value;
    const ie = e as InputEvent;
    if (ie.inputType?.startsWith('delete')) return;
    if (!/[\s.,;:!?]$/.test(v) || /[\s.,;:!?]{2}$/.test(v)) return;
    const ora = performance.now();
    if (ora - ultima < 120) return; // un incolla lungo non accende cento stelle
    ultima = ora;
    document.dispatchEvent(new CustomEvent('spazio:parola'));
  });

  /* ---- La validazione ------------------------------------------------------- */
  const errori: Record<string, string> = {
    nome: 'Dimmi come ti chiami.',
    email: 'Mi serve un’email valida per risponderti.',
    messaggio: 'Raccontami qualcosa in più (almeno 10 caratteri).',
  };
  const segna = (nome: string, testo: string) => {
    const campo = form.elements.namedItem(nome) as HTMLInputElement | null;
    const err = form.querySelector<HTMLElement>(`[data-err-for="${nome}"]`);
    if (campo && 'setAttribute' in campo) {
      if (testo) campo.setAttribute('aria-invalid', 'true');
      else campo.removeAttribute('aria-invalid');
    }
    if (err) {
      err.textContent = testo;
      err.hidden = !testo;
    }
  };
  const controlla = (nome: string): boolean => {
    const campo = form.elements.namedItem(nome) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!campo) return true;
    const v = campo.value.trim();
    const valido =
      nome === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) : nome === 'messaggio' ? v.length >= 10 : v.length > 0;
    segna(nome, valido ? '' : errori[nome]!);
    return valido;
  };
  // L'errore si toglie appena il campo diventa valido, non al prossimo invio.
  for (const nome of Object.keys(errori)) {
    const campo = form.elements.namedItem(nome) as HTMLElement | null;
    campo?.addEventListener('input', () => {
      if (campo.getAttribute('aria-invalid')) controlla(nome);
    });
    campo?.addEventListener('blur', () => {
      if ((campo as HTMLInputElement).value.trim()) controlla(nome);
    });
  }

  /* ---- Le notifiche a comparsa ---------------------------------------------
     Due schede già nel markup (vedi contatti.astro), una per esito. Si chiudono
     da sole dopo `durata` — più a lungo l'errore, che chiede di fare qualcosa —
     e il tempo si FERMA con il puntatore o il focus sopra: una notifica che
     sparisce mentre la stai leggendo è peggio di nessuna (WCAG 2.2.1). Esc e la
     X la chiudono subito. */
  type Tipo = 'ok' | 'err';
  const schede = {
    ok: document.querySelector<HTMLElement>('[data-toast="ok"]'),
    err: document.querySelector<HTMLElement>('[data-toast="err"]'),
  };
  const DURATA: Record<Tipo, number> = { ok: 6000, err: 10000 };
  let aperta: HTMLElement | null = null;
  let timer = 0;
  let resta = 0;
  let dal = 0;

  const chiudi = () => {
    const el = aperta;
    if (!el) return;
    aperta = null;
    window.clearTimeout(timer);
    el.classList.remove('is-on', 'is-paused');
    // Il tempo dell'uscita (260ms) e poi via dal flusso: `hidden` la toglie
    // anche agli screen reader, che altrimenti la rileggerebbero in giro.
    window.setTimeout(() => {
      if (aperta !== el) el.hidden = true;
    }, 300);
  };
  const avvia = (ms: number) => {
    resta = ms;
    dal = performance.now();
    window.clearTimeout(timer);
    timer = window.setTimeout(chiudi, ms);
  };
  const pausa = () => {
    if (!aperta || aperta.classList.contains('is-paused')) return;
    window.clearTimeout(timer);
    resta -= performance.now() - dal;
    aperta.classList.add('is-paused');
  };
  const riprendi = () => {
    if (!aperta?.classList.contains('is-paused')) return;
    // Il focus è passato da un elemento all'altro DENTRO la scheda: resta ferma.
    if (aperta.matches(':hover, :focus-within')) return;
    aperta.classList.remove('is-paused');
    avvia(Math.max(1500, resta));
  };
  const notifica = (tipo: Tipo, testo: Node[]) => {
    const el = schede[tipo];
    if (!el) return;
    if (aperta && aperta !== el) {
      aperta.classList.remove('is-on', 'is-paused');
      aperta.hidden = true;
    }
    aperta = null;
    el.classList.remove('is-on', 'is-paused');
    el.hidden = false;
    // Il testo si scrive DOPO aver tolto `hidden`: è il cambio di contenuto di
    // una regione `status`/`alert` già visibile a far partire l'annuncio.
    el.querySelector('[data-toast-text]')?.replaceChildren(...testo);
    el.style.setProperty('--tst-t', `${DURATA[tipo]}ms`);
    // Un fotogramma fra `hidden` e `is-on`, o la transizione d'ingresso non parte.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.classList.add('is-on');
        aperta = el;
        avvia(DURATA[tipo]);
      })
    );
  };
  for (const el of Object.values(schede)) {
    if (!el) continue;
    el.querySelector('[data-toast-x]')?.addEventListener('click', chiudi);
    el.addEventListener('pointerenter', pausa);
    el.addEventListener('pointerleave', riprendi);
    el.addEventListener('focusin', pausa);
    el.addEventListener('focusout', () => window.setTimeout(riprendi, 0));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aperta) chiudi();
  });
  const email = document.querySelector<HTMLAnchorElement>('[data-esito] a[href^="mailto:"]');
  const riserva = (): Node[] => {
    const a = document.createElement('a');
    a.href = email?.href ?? '';
    a.textContent = email?.textContent ?? '';
    return email
      ? [document.createTextNode(' Riprova tra poco, oppure scrivimi a '), a, document.createTextNode('.')]
      : [document.createTextNode(' Riprova tra poco.')];
  };

  const mostraEsito = (testo: string) => {
    if (!esito) return;
    esito.querySelector('[data-esito-testo]')!.textContent = testo;
    esito.hidden = false;
  };

  /* ---- L'invio --------------------------------------------------------------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (esito) esito.hidden = true;
    const validi = Object.keys(errori).map(controlla);
    const primo = Object.keys(errori).find((_, i) => !validi[i]);
    if (primo) {
      (form.elements.namedItem(primo) as HTMLElement | null)?.focus();
      return;
    }

    const dati = new FormData(form);
    dati.delete('allegati');
    for (const f of files) dati.append('allegati', f, f.name);

    form.classList.add('is-sending');
    if (invia) invia.disabled = true;
    try {
      const r = await fetch(form.action, {
        method: 'POST',
        body: dati,
        headers: { accept: 'application/json' },
      });
      const j = (await r.json().catch(() => null)) as {
        ok?: boolean;
        conferma?: boolean;
        errore?: string;
        campo?: string;
      } | null;
      if (!r.ok || !j?.ok) {
        if (j?.campo && j.campo !== 'allegati') segna(j.campo, j.errore ?? '');
        mostraEsito(j?.errore ? `${j.errore} ` : 'Non sono riuscito a inviare il messaggio. ');
        notifica('err', [
          document.createTextNode(j?.errore ?? 'Il messaggio non è partito.'),
          ...riserva(),
        ]);
        return;
      }
      notifica('ok', [
        document.createTextNode(
          j.conferma
            ? 'È arrivato senza errori. Ti ho mandato una conferma via email.'
            : 'È arrivato senza errori. Ti rispondo appena posso.'
        ),
      ]);
      // Partito: la scia dal bottone, poi il pannello di conferma.
      if (invia) {
        const b = invia.getBoundingClientRect();
        document.dispatchEvent(
          new CustomEvent('spazio:lancio', { detail: { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
        );
      }
      const nome = String(dati.get('nome') ?? '').trim().split(/\s+/)[0] ?? '';
      const saluto = ok?.querySelector('[data-ok-nome]');
      if (saluto) saluto.textContent = nome ? `Grazie, ${nome}.` : 'Grazie.';
      form.classList.add('is-sent');
      window.setTimeout(() => {
        /* La conferma prende l'altezza del modulo che sostituisce: senza, il
           pannello si accorciava di colpo, la pagina saltava e la conferma
           finiva sotto la navbar con un vuoto sotto (visto nei fotogrammi). */
        if (ok) ok.style.minHeight = `${form.offsetHeight}px`;
        form.hidden = true;
        ok?.classList.add('is-on');
        ok?.focus({ preventScroll: true });
      }, 420);
    } catch {
      mostraEsito('Non sono riuscito a inviare il messaggio. ');
      notifica('err', [
        document.createTextNode('Il messaggio non è partito: sembra un problema di connessione.'),
        ...riserva(),
      ]);
    } finally {
      form.classList.remove('is-sending');
      if (invia) invia.disabled = false;
    }
  });

  // «Scrivi un altro messaggio»: torna al modulo vuoto.
  ok?.querySelector('[data-ok-again]')?.addEventListener('click', () => {
    form.reset();
    files = [];
    disegnaLista();
    if (t) t.value = String(Date.now());
    ok.classList.remove('is-on');
    ok.style.minHeight = '';
    form.classList.remove('is-sent');
    form.hidden = false;
    (form.elements.namedItem('nome') as HTMLElement | null)?.focus();
  });
}
