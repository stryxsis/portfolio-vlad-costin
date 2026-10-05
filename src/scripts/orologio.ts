/**
 * L'ora locale di Colorno nel footer (2026-10-05). Per chi scrive da un altro
 * fuso orario è un'informazione vera («lì adesso sono le 23»), e dice che
 * dall'altra parte c'è una persona.
 *
 * Un aggiornamento al minuto, allineato al cambio del minuto: nessun timer che
 * gira a vuoto ogni secondo. Senza JS la riga mostra solo il luogo.
 */
export function initOrologio(): void {
  const box = document.querySelector<HTMLElement>('[data-ora]');
  const val = box?.querySelector<HTMLElement>('[data-ora-val]');
  if (!box || !val) return;
  const fmt = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  });
  const tick = (): void => {
    val.textContent = fmt.format(new Date());
    window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  tick();
  box.hidden = false;
}
