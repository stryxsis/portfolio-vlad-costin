/**
 * L'avviso "cantiere aperto": quando entra, quando si ritira, e come si misura.
 *
 * Il disegno e la geometria della spinta stanno in AnnouncementBanner.astro.
 * Qui c'è solo il tempo: tre transizioni di stato, zero animazioni proprie.
 *
 *   entra    ~2,6s dopo il boot, a hero già posata
 *   si ritira   superata la hero, oppure alla ✕
 *   non torna   mai più, per il resto della sessione
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { whenRevealed } from './loader';

/** Una volta per sessione, non per sempre: chi torna domani lo rivede — il
 *  sito domani sarà ancora un cantiere, ma diverso. `sessionStorage` e non
 *  `localStorage` proprio per questo. */
const KEY = 'vc:banner-dismissed';

/* ⚠ 2600ms NON è un numero tondo scelto a occhio: è tarato sulla hero.
   L'ultimo elemento della hero entra a 1050ms di ritardo + 600ms di durata =
   1650ms, e il word-carousel della CTA comincia a girare a 2200ms. Entrare
   prima di 1650 significherebbe spingere giù la navbar mentre il titolo sta
   ancora salendo — due movimenti scoordinati nello stesso secondo. 2600 cade
   dopo che la hero si è posata E dopo la prima battuta del carosello: la
   pagina è ferma, e l'avviso arriva come una cosa che SUCCEDE, non come parte
   dell'ingresso. Se un domani si ritocca la coreografia della hero, questo
   numero va ritoccato con lei. */
const ENTER_DELAY = 2600;

export function initBanner(): void {
  const root = document.documentElement;
  const banner = document.querySelector<HTMLElement>('[data-banner]');
  if (!banner) return;

  /* Già chiuso in questa sessione: non entra proprio. Si toglie dal DOM invece
     di lasciarlo traslato fuori vista — resterebbe leggibile da uno screen
     reader, cioè un avviso che l'utente ha esplicitamente congedato e che
     continua ad annunciarsi a chi non può vedere di averlo chiuso. */
  if (sessionStorage.getItem(KEY) === '1') {
    banner.remove();
    return;
  }

  /* ---- La misura ---------------------------------------------------------
     L'ingresso anima `height` da `0` a `<altezza vera>`, e quell'altezza deve
     essere una LUNGHEZZA VERA: `height: auto` non è interpolabile. Stesso
     problema, e stessa soluzione, di `--nav-compact-w` in nav.ts.

     ⚠ SI MISURA `.ab__inner` (il figlio), NON `.ab` (la banda stessa) — ed è
     il fix di un difetto vero, non una preferenza di stile. `.ab` è quella a
     cui questo file forza `height: 0`/`var(--ab-h)`: misurarla richiederebbe
     un trucco a quattro passi per leggere la sua altezza "vera" mentre è
     forzata (prima versione di questo file, ora rimossa). `.ab__inner` invece
     non ha MAI un'altezza propria dichiarata da nessuna regola: dimensiona
     sempre e solo sul proprio contenuto (dot, titolo, testo, chiusura),
     comunque sia vincolato l'antenato — è già, sempre, la misura che serve,
     senza bisogno di forzare né ripristinare niente.

     ⚠ IL VERO BUG CHE HA COSTRETTO A QUESTO CAMBIO: la versione precedente
     osservava `banner` (cioè `.ab`) con un `ResizeObserver` — LO STESSO
     elemento la cui `height` questo file anima con una transizione CSS. Ogni
     fotogramma della transizione È un cambiamento delle dimensioni di quel
     elemento, quindi l'observer scattava a ripetizione DURANTE la propria
     stessa animazione, interrompendola per rimisurare — decine di volte nei
     suoi 520ms. Risultato osservato: "non c'è più l'animazione fluida, ora
     compare e scompare". `.ab__inner` non soffre di questo: la sua altezza
     NON cambia mai per effetto della transizione del genitore (`overflow:
     clip` sul genitore taglia la resa, non ridimensiona il figlio), quindi
     osservarlo non si autoalimenta mai. */
  const inner = banner.querySelector<HTMLElement>('.ab__inner');
  if (!inner) return;

  const measure = (): void => {
    root.style.setProperty('--ab-h', `${inner.offsetHeight}px`);
  };
  measure();
  /* I font metric-matched cambiano di poco l'altezza del testo, ma la banda è
     alta ~72px: un paio di pixel di margine sbagliato lascerebbero una fessura
     visibile fra banda e navbar prima dell'ingresso. */
  document.fonts?.ready.then(measure).catch(() => {});
  /* Il testo va a capo diversamente al variare della larghezza, quindi
     l'altezza cambia. `ResizeObserver` e non l'evento `resize`: l'altezza può
     cambiare anche senza che la finestra si ridimensioni (i font che
     arrivano), e osservare l'elemento è più diretto che indovinare le cause. */
  new ResizeObserver(measure).observe(inner);

  let retired = false;
  const retire = (dismissed: boolean): void => {
    if (retired) return;
    retired = true;
    root.classList.remove('banner-in');
    if (dismissed) sessionStorage.setItem(KEY, '1');

    /* Rimosso dal DOM a ritiro finito, per la stessa ragione del ramo "già
       chiuso" qui sopra: una banda solo traslata fuori vista resta leggibile
       da uno screen reader, cioè un avviso congedato che continua ad
       annunciarsi a chi non può vedere di averlo chiuso.

       ⚠ NON basta `transitionend`, e la prima stesura sbagliava proprio qui.
       Il margine negativo che nasconde la banda è gated dietro `html.js-anim`,
       quindi con `prefers-reduced-motion` (dove quella classe non esiste) non
       c'è NESSUNA transizione da terminare: l'evento non arriva mai e la banda
       restava in cima per sempre — fissa, sopra ogni sezione, esattamente il
       difetto per cui si è scelto di farla ritirare. Misurato via CDP con
       `REDUCE=1`. Senza transizione si rimuove subito; con la transizione si
       aspetta, ma con un tetto di sicurezza: `transitionend` non è garantito
       (una scheda in background, o un ritiro che parte da uno stato già
       nascosto, non lo emettono). */
    const animated = root.classList.contains('js-anim');
    if (!animated) {
      banner.remove();
      return;
    }
    let done = false;
    const drop = (): void => {
      if (done) return;
      done = true;
      banner.remove();
    };
    banner.addEventListener('transitionend', drop, { once: true });
    gsap.delayedCall(1, drop); // > --chrome-t (520ms), con margine
  };

  document
    .querySelector<HTMLElement>('[data-banner-close]')
    ?.addEventListener('click', () => retire(true));

  /* ---- Si ritira superata la hero ----------------------------------------
     ⚠ `once: true`, e NON un `onToggle` come quello del morph della navbar.
     Il morph è uno STATO ("sto scorrendo"), quindi è giusto che torni indietro
     risalendo; questo è un avviso, cioè una cosa che si legge una volta. Un
     avviso che ricompare ogni volta che si torna in cima è un popup, e la
     regola del sito è che ogni animazione si esegue una volta sola.

     La soglia è il 90% di uno schermo: tutta la hero è tempo di lettura. Non
     `100%` esatto — a schermo pieno la hero e la soglia coinciderebbero e
     basterebbe l'imprecisione di Lenis per farla scattare mezzo schermo prima
     o dopo. È una funzione, quindi `invalidateOnRefresh` la rimisura al resize
     invece di inchiodare i pixel del primo layout. */
  ScrollTrigger.create({
    start: () => `top+=${Math.round(window.innerHeight * 0.9)} top`,
    end: 99999,
    once: true,
    invalidateOnRefresh: true,
    onEnter: () => retire(false),
  });

  /* ---- L'ingresso --------------------------------------------------------
     ⚠ Chi arriva con lo scroll già ripristinato oltre la soglia (ricarica a
     metà pagina, o un link con ancora) non deve vedersi comparire un avviso
     che nello stesso istante ha già l'ordine di ritirarsi: sarebbe un lampo.
     `ScrollTrigger.isInViewport` non serve — basta guardare dove siamo.

     ⚠ IL CONTO PARTE DALLA RIVELAZIONE, NON DAL BOOT. `ENTER_DELAY` è tarato
     sulla coreografia della hero (vedi la nota in cima), ma alla prima visita
     quella coreografia è TRATTENUTA dal velo (Loader.astro): sotto al velo il
     boot è già avvenuto e la hero non è ancora cominciata. Contando dal boot,
     l'avviso sarebbe comparso pochi decimi dopo aver scoperto la hero —
     addosso al titolo che stava ancora salendo, cioè esattamente il difetto
     che quel numero esiste per evitare. `whenRevealed()` risolve subito dove
     il velo non c'è (seconda visita, reduced-motion, altre pagine), quindi
     questo ramo non ha bisogno di sapere se il velo esista. */
  void whenRevealed().then(() => {
    gsap.delayedCall(ENTER_DELAY / 1000, () => {
      if (retired || window.scrollY > window.innerHeight * 0.9) return;
      root.classList.add('banner-in');
    });
  });
}
