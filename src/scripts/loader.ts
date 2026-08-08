/**
 * Il velo di prima visita: quanto resta, cosa aspetta, e come passa la mano.
 *
 * Il disegno sta in Loader.astro. Qui c'è solo il tempo.
 *
 *   aspetta   che il ritratto della hero sia DECODIFICATO
 *   almeno    MIN_SHOW, perché non sia un lampo su una cache calda
 *   al più    MAX_WAIT, perché un'immagine rotta non intrappoli nessuno
 *   poi       passa la mano alla coreografia della hero e sparisce
 */

/** Una volta per DISPOSITIVO, non per sessione — al contrario dell'avviso
 *  §00. La differenza non è di gusto: il velo esiste per coprire il PRIMO
 *  scaricamento degli asset, e dalla seconda visita quegli asset sono nella
 *  cache del browser, quindi non c'è più niente da coprire. Rimostrarlo
 *  sarebbe un'attesa costruita davanti a una pagina che sarebbe già pronta.
 *  ⚠ La stessa chiave è letta dallo script inline in <head> (BaseLayout):
 *  se cambia qui va cambiata anche là, o il velo si mostra per sempre. */
const KEY = 'vc:seen';

/* ⚠ MIN_SHOW non è cortesia verso l'animazione, è il rimedio a un difetto
   opposto: su una cache calda o in locale l'immagine è pronta in poche
   decine di ms, e un velo che appare e sparisce in 80ms è un LAMPO — più
   fastidioso del difetto che doveva coprire. 1100ms lasciano leggere la
   prima parola e vedere un morph, che è il minimo perché il velo sia una
   cosa invece di un artefatto.
   ⚠ MAX_WAIT è la garanzia che nessuno resti chiuso fuori: immagine 404,
   rete che muore a metà, `decode()` che non risolve mai. Oltre questo si
   passa la mano comunque, difetto grafico o no — un velo che non se ne va è
   infinitamente peggio di una foto che entra tardi. (Lo script inline in
   <head> ha a sua volta il PROPRIO watchdog, per il caso in cui questo
   modulo non arrivi affatto.) */
const MIN_SHOW = 1100;
const MAX_WAIT = 4000;

/** Ogni quanto cambia la parola. */
const MORPH_EVERY = 900;

/** Quanto dura la dissolvenza del velo — deve combaciare con la `transition`
 *  di `.ld` in Loader.astro. */
const FADE = 520;

let segnalaRivelato: () => void = () => {};
const rivelato = new Promise<void>((res) => {
  segnalaRivelato = res;
});

/**
 * Si risolve quando la pagina è davvero in mano all'utente.
 *
 * Serve a chi deve contare il tempo A PARTIRE da lì invece che dal boot:
 * oggi l'avviso §00, il cui ritardo d'ingresso è tarato sulla coreografia
 * della hero — che sotto il velo non è ancora cominciata. Senza questo,
 * l'avviso comparirebbe contando da un istante in cui la hero era ancora
 * coperta, cioè quasi subito dopo averla scoperta.
 *
 * Se il velo non c'è (seconda visita, reduced-motion, altra pagina, niente
 * JS) risolve immediatamente: chi la chiama non deve sapere se il velo esista.
 */
export function whenRevealed(): Promise<void> {
  return document.documentElement.classList.contains('ld-on')
    ? rivelato
    : Promise.resolve();
}

export function initLoader(): void {
  const root = document.documentElement;
  const velo = document.querySelector<HTMLElement>('[data-loader]');

  // Nessun velo in scena: questa pagina è già in mano all'utente.
  if (!velo || !root.classList.contains('ld-on')) {
    segnalaRivelato();
    return;
  }

  const t0 = performance.now();

  /* ---- Il filetto ---------------------------------------------------------
     Guidato in JS e non in CSS, per una ragione già costata un difetto altrove
     in questo repo: un'animazione con `fill: both` conclusa continua ad
     applicare il proprio valore finale e VINCE su qualunque transizione che
     provi a completarla (stessa trappola di `hero-in-fade` contro il `top`
     dell'indice). Con una transizione sola non c'è nessun conflitto da
     arbitrare: si va verso il 92% con calma, e al momento buono si chiude. */
  const fill = velo.querySelector<HTMLElement>('[data-loader-fill]');
  if (fill) {
    requestAnimationFrame(() => {
      fill.style.transition = `width ${MAX_WAIT - 400}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      fill.style.width = '92%';
    });
  }

  /* ---- Il morph delle parole --------------------------------------------- */
  const parole = Array.from(velo.querySelectorAll<HTMLElement>('.ld__w'));
  let i = 0;
  const giostra = window.setInterval(() => {
    parole[i]?.classList.remove('is-on');
    i = (i + 1) % parole.length;
    parole[i]?.classList.add('is-on');
  }, MORPH_EVERY);

  /* ---- Cosa si aspetta ----------------------------------------------------
     L'immagine della hero, non `window.load`: aspettare il caricamento
     completo vorrebbe dire aspettare anche gli screenshot dei progetti in
     fondo alla pagina, che nessuno sta guardando — secondi di velo in più per
     niente, e altrettanto ritardo di LCP regalato.
     `decode()` e non l'evento `load`: `load` dice "i byte sono arrivati",
     `decode()` dice "il fotogramma è pronto da dipingere". È la differenza fra
     scoprire il velo su un'immagine che comparirà fra un frame e scoprirlo su
     una che c'è già. */
  const foto = document.querySelector<HTMLImageElement>('.hero__img');
  const prontaLaFoto: Promise<void> = foto
    ? foto
        .decode()
        .catch(() => {}) // srcset non decodificabile, 404, formato rifiutato: si prosegue
    : Promise.resolve();

  let uscito = false;
  const rivela = (): void => {
    if (uscito) return;
    uscito = true;
    window.clearInterval(giostra);

    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* modalità privata o storage pieno: si accetta di rivederlo, non si
         rinuncia a mostrarlo — il velo resta funzionante, solo non ricordato. */
    }

    if (fill) {
      fill.style.transition = 'width 240ms linear';
      fill.style.width = '100%';
    }

    /* ⚠ L'ORDINE QUI È IL PUNTO DELICATO DI TUTTO IL FILE.
       Togliere `ld-on` fa ripartire la coreografia della hero (in global.css
       quella classe la tiene in `animation-play-state: paused`), e va fatto
       QUANDO COMINCIA la dissolvenza, non dopo. Se si aspettasse la fine del
       velo, si scoprirebbe una hero ferma e solo allora la si vedrebbe
       muoversi: due eventi in fila invece di un passaggio di mano. Facendolo
       adesso, i 900ms d'ingresso del ritratto corrono SOTTO i 520ms di
       dissolvenza, e il volto emerge già mentre si risolve. */
    velo.classList.add('is-out');
    root.classList.remove('ld-on');
    segnalaRivelato();

    /* Fuori dal DOM a dissolvenza finita, per la stessa ragione dell'avviso
       §00: un elemento solo trasparente resta un elemento — intercetta il
       fuoco da tastiera e resta nell'albero. `transitionend` NON basta da solo
       (una scheda in background non lo emette, e con `transition: none` sotto
       reduced-motion non arriva mai), quindi c'è anche il tetto. */
    let tolto = false;
    const togli = (): void => {
      if (tolto) return;
      tolto = true;
      velo.remove();
    };
    velo.addEventListener('transitionend', togli, { once: true });
    setTimeout(togli, FADE + 300);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(`[loader] velo tolto dopo ${Math.round(performance.now() - t0)}ms`);
    }
  };

  /* La corsa fra "pronta e vista abbastanza" e il tetto di sicurezza. `race`
     e non `all`: il tetto deve poter VINCERE, o un'immagine che non decodifica
     mai terrebbe il velo in piedi per sempre. */
  const attesaMinima = new Promise<void>((res) => setTimeout(res, MIN_SHOW));
  const tettoDiSicurezza = new Promise<void>((res) => setTimeout(res, MAX_WAIT));

  void Promise.race([
    Promise.all([prontaLaFoto, attesaMinima]),
    tettoDiSicurezza,
  ]).then(rivela);
}
