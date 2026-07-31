/**
 * Navbar: il morph a due stati e il menu mobile.
 *
 * Il menu mobile è un <details> nativo, quindi funziona già senza JS. Qui si
 * aggiunge solo ciò che l'HTML non può fare: fermare Lenis mentre il pannello è
 * aperto e chiudere con Escape.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getLenis } from './scroll';

export function initNav(): void {
  const root = document.documentElement;

  /* ---- Morph a due stati, TRIGGERATO non scrubbato -----------------------
     Una versione precedente legava le stesse proprietà 1:1 allo scroll
     (scrub:true): a ogni tick ricalcolava un `calc()` su proprietà di LAYOUT
     (larghezza, gap, padding, altezza) — non solo transform/opacity — e con
     Lenis che spedisce eventi ad alta frequenza era più lavoro per frame di
     quanto sembri. Qui invece UNA classe, accesa da un solo ScrollTrigger
     `onToggle` al PRIMO pixel di scroll (soglia 4px, non 80px: deve partire
     "appena scrollo", non dopo un tratto), e una transizione CSS a durata
     fissa la porta a termine DA SOLA — che si scrolli di mezzo pixel o di
     mille, l'animazione non resta mai a metà: parte e finisce. Tornando a
     top 0 la classe si spegne e la stessa transizione va a rovescio. */
  ScrollTrigger.create({
    start: 'top+=4 top',
    end: 99999,
    onToggle: (self) => root.classList.toggle('nav-compact', self.isActive),
  });

  /* ---- La larghezza di arrivo della pillola, misurata ---------------------
     ⚠ QUESTO ESISTE PER UN MOTIVO PRECISO, non per comodità.
     Lo stato compatto vuole una pillola larga quanto il suo contenuto, cioè
     `width: fit-content`. Ma `fit-content` è una PAROLA CHIAVE, non una
     lunghezza: CSS non sa interpolare `100%` → `fit-content`, quindi la
     larghezza — la proprietà di gran lunga più visibile del morph — saltava
     al valore finale in UN SOLO FRAME mentre raggio, altezza e fondo
     animavano regolarmente. Il risultato era esattamente "la pillola c'è già,
     e poi si arrotonda": nessun rimpicciolimento visibile.

     Qui la si misura e la si scrive in `--nav-compact-w` come valore in px,
     che è una lunghezza vera e quindi interpolabile. La misura va presa con
     le metriche dello stato COMPATTO applicate (gap e padding cambiano fra i
     due stati, quindi misurare da steso darebbe un numero troppo grande):
     si accende `nav-compact` per un istante, con le transizioni disattivate
     da `nav-measuring` perché nulla di tutto questo si deve vedere. */
  const bar = document.querySelector<HTMLElement>('.nav__bar');
  if (bar) {
    const measure = (): void => {
      const wasCompact = root.classList.contains('nav-compact');
      root.classList.add('nav-measuring', 'nav-compact');
      bar.style.width = 'fit-content';

      const width = bar.getBoundingClientRect().width;

      bar.style.width = '';
      root.classList.toggle('nav-compact', wasCompact);
      // Lettura forzata: sincronizza il ripristino PRIMA di riabilitare le
      // transizioni, altrimenti il ritorno allo stato vero verrebbe animato.
      void bar.offsetWidth;
      root.classList.remove('nav-measuring');

      // Arrotondato per eccesso: un sub-pixel in meno manderebbe i link a capo.
      bar.style.setProperty('--nav-compact-w', `${Math.ceil(width)}px`);
    };

    measure();
    // La larghezza del contenuto dipende dai font: a font non ancora caricati
    // la misura è quella dei fallback metric-matched, vicina ma non identica.
    document.fonts?.ready.then(measure).catch(() => {});
    // Solo il breakpoint desktop ha la pillola, ma la misura dipende anche
    // dalla scala tipografica fluida: si rifà a ogni cambio di larghezza.
    gsap.matchMedia().add('(min-width: 56.25rem)', () => {
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    });
  }

  /* ---- Menu mobile ------------------------------------------------------- */
  const details = document.querySelector<HTMLDetailsElement>('[data-nav-mobile]');
  if (!details) return;

  const sync = () => {
    const lenis = getLenis();
    if (details.open) {
      // lenis.stop() e non overflow:hidden sul body: quest'ultimo farebbe
      // sparire la scrollbar causando un salto di layout, e litigherebbe con
      // Lenis per il controllo dello scroll.
      lenis?.stop();
    } else {
      lenis?.start();
    }
  };

  details.addEventListener('toggle', sync);

  // Chiudere con Escape è un requisito di tastiera, non un extra.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && details.open) {
      details.open = false;
      details.querySelector<HTMLElement>('summary')?.focus();
    }
  });

  // Navigare a una pagina nuova con il pannello aperto lascerebbe Lenis fermo.
  details.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a');
    if (link) details.open = false;
  });

  // Passando alla larghezza desktop il pannello va chiuso, altrimenti Lenis
  // resta bloccato senza che nulla lo mostri.
  gsap.matchMedia().add('(min-width: 56.25rem)', () => {
    details.open = false;
    getLenis()?.start();
  });
}