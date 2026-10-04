/**
 * L'indice laterale dei case study: accende il capitolo in cui si trova chi
 * legge (richiesta di Vlad, 2026-10-04).
 *
 * Il capitolo "corrente" è quello che attraversa una linea a un terzo
 * dell'altezza dello schermo — la zona in cui l'occhio sta leggendo, non il
 * bordo alto. I capitoli sono uno sotto l'altro senza vuoti, quindi su quella
 * linea ce n'è sempre esattamente uno.
 *
 * È uno STATO e non un'animazione d'ingresso: deve seguire chi legge in
 * entrambe le direzioni, come l'indice di sezione della Home. Niente
 * ScrollTrigger: un IntersectionObserver con una fascia sottile basta e non
 * costa niente per fotogramma.
 *
 * `aria-current="location"` fa due lavori: il CSS lo usa per il colore, e uno
 * screen reader annuncia quale voce dell'indice corrisponde a dove si è.
 */
export function initCaseRail(): void {
  const rail = document.querySelector<HTMLElement>('[data-case-rail]');
  if (!rail) return;

  const links = new Map<string, HTMLAnchorElement>();
  rail.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    links.set(a.hash.slice(1), a);
  });
  const chapters = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  if (!chapters.length) return;

  let current = '';
  const set = (id: string): void => {
    if (id === current) return;
    current = id;
    links.forEach((a, key) => {
      if (key === id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) set(e.target.id);
    },
    /* Una fascia alta l'1% a un terzo dello schermo: è la "linea di lettura". */
    { rootMargin: '-33% 0px -66% 0px' }
  );
  chapters.forEach((c) => io.observe(c));

  /* Sopra il primo capitolo (hero, copertina, numeri) non si sta leggendo
     nessun capitolo: niente acceso. Sotto l'ultimo resta acceso l'ultimo. */
  const first = chapters[0]!;
  const onScroll = (): void => {
    if (first.getBoundingClientRect().top > window.innerHeight * 0.33) set('');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
