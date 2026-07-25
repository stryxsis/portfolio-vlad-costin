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

  /* ---- Morph a due stati -------------------------------------------------
     UN solo ScrollTrigger, un solo toggle di classe, nessuno scrub: il costo
     è una transizione CSS quando si supera la soglia, non lavoro per frame. */
  ScrollTrigger.create({
    start: 'top+=80 top',
    end: 99999,
    onToggle: (self) => root.classList.toggle('nav-compact', self.isActive),
  });

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