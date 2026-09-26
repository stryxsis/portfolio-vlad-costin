/**
 * Il palco dei lavori in /portfolio (WorksStage.astro).
 *
 * Il cambio di progetto, come nel riferimento video:
 *   1. la card scelta SI ALLARGA dalla sua posizione fino a coprire tutta la
 *      sezione, e diventa il fondo;
 *   2. le altre card scorrono al loro posto nuovo (FLIP), e il progetto appena
 *      lasciato rientra in coda alla fila;
 *   3. il testo vecchio esce verso l'alto, il titolo nuovo sale da sotto la
 *      propria maschera, poi descrizione e bottone;
 *   4. contatore e linea di avanzamento si aggiornano subito.
 *
 * Solo Web Animations API: nessuna libreria. Un solo elemento anima la propria
 * geometria (la card che si allarga), per ~700ms.
 *
 * ⚠ NIENTE AVANZAMENTO AUTOMATICO. Cambia solo quando lo si chiede.
 * ⚠ CLIC RAPIDI: un cambio nuovo chiude all'istante quello in corso (stato
 * finale, nessuna animazione a metà) e parte da lì. Nessuna coda.
 */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const T_GROW = 700;
/** Il testo nuovo entra quando la card ha quasi finito di allargarsi: sopra il
 *  testo c'è la card stessa (come nel riferimento), quindi prima non si
 *  vedrebbe. */
const T_TEXT = 620;

export function initWorks(): void {
  const root = document.querySelector<HTMLElement>('[data-works]');
  if (!root) return;

  const bgs = [...root.querySelectorAll<HTMLElement>('[data-bg]')];
  const slides = [...root.querySelectorAll<HTMLElement>('[data-slide]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-card]')];
  const count = root.querySelector<HTMLElement>('[data-count]');
  const fill = root.querySelector<HTMLElement>('[data-fill]');
  const live = root.querySelector<HTMLElement>('[data-live]');
  const cards = root.querySelector<HTMLElement>('[data-cards]');
  const n = bgs.length;

  // Con un progetto solo non c'è niente da scegliere: fila e comandi spariscono.
  if (n < 2) {
    root.querySelector<HTMLElement>('.wk__rail')?.setAttribute('hidden', '');
    root.querySelector<HTMLElement>('.wk__ctrl')?.setAttribute('hidden', '');
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const title = (i: number) => slides[i]?.querySelector('.wk__title-in')?.textContent?.trim() ?? '';
  const pad = (i: number) => String(i + 1).padStart(2, '0');

  let cur = 0;
  /** Il cambio in corso, se c'è: `commit()` lo porta subito allo stato finale. */
  let pending: { commit: () => void } | null = null;

  /** La fila mostra gli ALTRI progetti, a partire da quello dopo il corrente. */
  const layout = () => {
    items.forEach((li, i) => {
      li.style.order = String((i - cur - 1 + n) % n);
      li.classList.toggle('is-current', i === cur);
    });
  };

  const showSlide = (i: number) => {
    slides.forEach((s, k) => {
      s.hidden = k !== i;
      s.classList.toggle('is-on', k === i);
    });
  };
  const showBg = (i: number) => bgs.forEach((b, k) => b.classList.toggle('is-on', k === i));

  const updateMeta = (i: number) => {
    if (count) count.textContent = pad(i);
    if (fill) fill.style.transform = `scaleX(${(i + 1) / n})`;
    if (live) live.textContent = `Progetto ${i + 1} di ${n}: ${title(i)}`;
  };

  function go(j: number): void {
    if (j === cur) return;
    pending?.commit();

    const prev = cur;
    const card = items[j]?.querySelector<HTMLElement>('.wk__card');
    const rootBox = root!.getBoundingClientRect();
    const cardBox = card?.getBoundingClientRect();

    // FLIP, prima: dove stanno adesso le card che resteranno in vista.
    const before = new Map<HTMLElement, number>();
    items.forEach((li, i) => {
      if (i !== j && i !== prev) before.set(li, li.getBoundingClientRect().left);
    });

    cur = j;
    updateMeta(j);
    layout();
    // Su telefono la fila scorre in orizzontale: dopo il riordino torna
    // all'inizio, dove adesso c'è il progetto successivo.
    cards?.scrollTo({ left: 0 });

    if (reduce || !cardBox || cardBox.width === 0) {
      showBg(j);
      showSlide(j);
      return;
    }

    const anims: Animation[] = [];

    /* 1. La card che si allarga. È un clone dell'immagine di fondo (stesso
          srcset, di solito già in cache), con un velo che si scurisce mentre
          cresce: così quando diventa il fondo non c'è uno scatto di luce. */
    const fly = document.createElement('div');
    fly.className = 'wk__fly';
    fly.setAttribute('aria-hidden', 'true');
    const pic = bgs[j]!.firstElementChild?.cloneNode(true);
    if (pic) fly.append(pic);
    const shade = root!.querySelector('.wk__shade')!.cloneNode() as HTMLElement;
    shade.classList.add('wk__fly-shade');
    fly.append(shade);
    /* La card nella fila mostra il logo, il fondo lo screenshot del sito: la
       card che cresce parte dal logo e si dissolve nel fondo, o al primo
       fotogramma si vedrebbe l'immagine cambiare di colpo. */
    const tile = card?.querySelector('picture')?.cloneNode(true) as HTMLElement | undefined;
    if (tile) {
      tile.classList.add('wk__fly-tile');
      fly.append(tile);
    }
    Object.assign(fly.style, {
      position: 'absolute',
      zIndex: '3',
      overflow: 'hidden',
      pointerEvents: 'none',
      left: '0',
      top: '0',
      width: `${rootBox.width}px`,
      height: `${rootBox.height}px`,
    });
    root!.append(fly);

    const from = {
      left: `${cardBox.left - rootBox.left}px`,
      top: `${cardBox.top - rootBox.top}px`,
      width: `${cardBox.width}px`,
      height: `${cardBox.height}px`,
      borderRadius: getComputedStyle(card!).borderRadius,
    };
    const to = { left: '0px', top: '0px', width: `${rootBox.width}px`, height: `${rootBox.height}px`, borderRadius: '0px' };
    anims.push(fly.animate([from, to], { duration: T_GROW, easing: EASE, fill: 'both' }));
    anims.push(shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T_GROW, easing: EASE, fill: 'both' }));
    if (tile) {
      anims.push(tile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T_GROW * 0.6, easing: 'ease-in', fill: 'both' }));
    }
    /* La card nella fila è nitida, lo sfondo è sfocato (vedi WorksStage): la
       sfocatura cresce insieme alla card, o al primo fotogramma la card
       diventerebbe sfocata di colpo. */
    const flyImg = fly.querySelector('img');
    if (flyImg) {
      anims.push(
        flyImg.animate(
          [
            { filter: 'blur(0px) saturate(1) brightness(1)', transform: 'scale(1)' },
            { filter: 'blur(14px) saturate(1.1) brightness(0.55)', transform: 'scale(1.08)' },
          ],
          { duration: T_GROW, easing: EASE, fill: 'both' }
        )
      );
    }

    /* 2. Le altre card scorrono al loro posto nuovo. */
    before.forEach((left, li) => {
      const dx = left - li.getBoundingClientRect().left;
      if (dx) anims.push(li.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 600, easing: EASE }));
    });
    // Il progetto appena lasciato rientra in coda alla fila.
    anims.push(
      items[prev]!.animate(
        [{ opacity: 0, transform: 'translateX(48px)' }, { opacity: 1, transform: 'none' }],
        { duration: 500, delay: 250, easing: EASE, fill: 'backwards' }
      )
    );

    /* 3. Il testo: il vecchio esce, il nuovo entra. */
    const oldSlide = slides[prev]!;
    const newSlide = slides[j]!;
    newSlide.hidden = false;
    newSlide.classList.add('is-on');
    oldSlide.classList.remove('is-on');
    const out = oldSlide.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }],
      { duration: 220, easing: 'ease-in', fill: 'forwards' }
    );
    out.onfinish = () => {
      oldSlide.hidden = true;
      out.cancel();
    };
    anims.push(out);

    const rise = newSlide.querySelector<HTMLElement>('.wk__title-in');
    if (rise) {
      anims.push(
        rise.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], {
          duration: 560,
          delay: T_TEXT,
          easing: EASE,
          fill: 'backwards',
        })
      );
    }
    newSlide.querySelectorAll<HTMLElement>('.wk__label, .wk__sub, .wk__cta').forEach((el, k) => {
      anims.push(
        el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], {
          duration: 480,
          delay: T_TEXT + 80 + k * 60,
          easing: EASE,
          fill: 'backwards',
        })
      );
    });

    /* 4. Fine: la card allargata diventa il fondo vero, e sparisce. */
    const done = () => {
      showBg(j);
      fly.remove();
      pending = null;
    };
    anims[0]!.onfinish = done;

    pending = {
      commit: () => {
        anims.forEach((a) => a.cancel());
        showSlide(j);
        done();
      },
    };
  }

  /* Con il JS le card smettono di essere link e diventano comandi del palco.
     Un clic con Cmd/Ctrl o col tasto centrale apre ancora il case study in
     una nuova scheda: lì il browser fa quello che ci si aspetta. */
  items.forEach((li, i) => {
    const a = li.querySelector<HTMLAnchorElement>('[data-card-link]');
    if (!a) return;
    a.setAttribute('role', 'button');
    a.setAttribute('aria-label', `Mostra ${title(i)}`);
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const hadFocus = document.activeElement === a;
      go(i);
      // La card cliccata sparisce dalla fila: il focus non deve cadere nel vuoto.
      if (hadFocus) slides[i]?.querySelector<HTMLElement>('.wk__cta a')?.focus({ preventScroll: true });
    });
  });

  root.querySelector('[data-prev]')?.addEventListener('click', () => go((cur - 1 + n) % n));
  root.querySelector('[data-next]')?.addEventListener('click', () => go((cur + 1) % n));

  layout();
  updateMeta(0);
  if (live) live.textContent = '';
}
