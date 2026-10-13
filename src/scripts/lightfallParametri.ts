/**
 * I parametri del fondale di /portfolio, in un modulo a parte perché li leggono
 * DUE posti: lo shader (`lightfall.ts`) e lo sfondo d'attesa disegnato prima
 * del primo paint (lo script inline in `Lightfall.astro`). Se fossero due copie,
 * al primo ritocco lo sfondo d'attesa e il primo fotogramma dello shader
 * smetterebbero di coincidere, e tornerebbe lo «scatto» che Vlad ha chiesto di
 * togliere il 2026-10-12. Niente import qui dentro: lo legge anche il
 * frontmatter di un componente, a build time.
 */
/* ---- Palette, dai token del sito ------------------------------------------
   L'ordine è la gerarchia che Vlad ha chiesto: indaco profondo → accento →
   lilla freddo. Sono tre luminanze della STESSA famiglia, non tre tinte: è la
   regola dell'accento unico applicata a un fondale, e il bianco delle punte lo
   produce il tone mapping (vedi il punto 5 in testa al file). */
export const TOKEN_SCIE = ['--color-accent-deep', '--color-accent', '--color-accent-hi'] as const;
/** Il bagliore in alto: la sorgente del tunnel. Il tono più profondo della
 *  famiglia, perché è una luce grande e diffusa e non deve competere col testo. */
export const TOKEN_BAGLIORE = '--color-accent-deep';
/** Il nero del sito. Aggiunto come PAVIMENTO al colore finale: senza, il canvas
 *  dipingerebbe `#000000` puro dove lo shader non arriva, cioè una macchia
 *  leggermente più scura del resto della pagina lungo i bordi della sezione. */
export const TOKEN_FONDO = '--color-canvas';

/* ---- I parametri, tarati a schermo -----------------------------------------
   Partono da quelli del riferimento e sono stati spostati guardando la hero a
   1440×900 (vedi la sezione dedicata in CLAUDE.md per il perché di ciascuno). */
export const P = {
  /** Il riferimento sta a 0.5. Più lento: qui sotto ci si legge un titolo, e la
   *  richiesta era esplicita — «elegante e abbastanza lento», non hyperspeed.
   *  ⚠ SCESO ANCORA il 2026-09-10 (era 0.34), su richiesta: «rallenta la loro
   *  velocità, voglio qualcosa di più elegante e meno ipnotico». */
  velocita: 0.2,
  /** Scie per cella di superficie. Il riferimento ne fa 2.
   *  ⚠ ERA 8, ed è la leva principale del «troppo carico» segnalato da Vlad il
   *  2026-09-10. Il giro precedente aveva letto «tantissime scie, non pochi fasci
   *  isolati» come "il più possibile" e aveva superato il punto in cui la densità
   *  smette di essere profondità e diventa rumore: a 8 le scie di celle adiacenti
   *  si toccano, il campo si chiude e il tunnel — che è la cosa da vedere — si
   *  legge peggio, non meglio. A 5 restano centinaia di filamenti distinti.
   *  ⚠ Costa poco: il prezzo di questo shader è il raymarch (117 iterazioni per
   *  pixel), non questo ciclo. Abbassarlo NON è un'ottimizzazione, è estetica. */
  numeroScie: 5,
  larghezzaScia: 1,
  lunghezzaScia: 1.4,
  /** Il moltiplicatore prima del tone mapping: quanto in fretta si satura. Al
   *  valore del riferimento (1.0) le scie diventavano fasci spessi e bianchi —
   *  su un fondo nero, e non blu, satura molto prima. */
  bagliore: 0.38,
  /** Settori angolari: la densità del campo. ⚠ È LA SECONDA METÀ DEL
   *  DIRADAMENTO, e agisce in modo diverso da `numeroScie`: quello dice quante
   *  scie stanno in una cella, questo quante CELLE ci sono attorno al tunnel
   *  (`angRings = round(TAU · densita)`, 9 settori a 1.5 e 7 a 1.1). Muovere solo
   *  il primo dirada dentro i gruppi lasciandone il numero invariato; muovere
   *  entrambi allarga anche lo spazio nero fra un filamento e l'altro, che è
   *  quello che fa sembrare la scena più grande invece che più vuota. */
  densita: 1.1,
  /** La sfocatura: moltiplica l'ampiezza di antialiasing delle scie (`fw`, le
   *  derivate della parametrizzazione — «quanto vale un pixel qui sulla
   *  superficie»). A 1 le scie hanno il bordo netto di un pixel.
   *  ⚠ TOLTA IL 2026-09-11, un giorno dopo averla introdotta: «togli il blur».
   *  Tornata al neutro (1), non rimossa dal parametro — resta la leva pronta
   *  se un giorno la richiesta cambia di nuovo, ed è una moltiplicazione sola
   *  da ritoccare, non uno shader da riscrivere. Vedi CLAUDE.md per la ragione
   *  per cui, quando c'era, non era un `filter: blur()` CSS. */
  sfocatura: 1,
  /** Oscillazione di luminosità per scia. Tenuta sotto il riferimento (1.0):
   *  serve l'irregolarità organica, non un secondo battito che compete. */
  scintillio: 0.55,
  /** L'apertura prospettica del raymarch. ⚠ È IL PARAMETRO PIÙ SENSIBILE DI
   *  TUTTI: sotto il 3 del riferimento il tunnel si allarga, le scie diventano
   *  enormi e la hero passa da fondale a protagonista. La prima stesura stava a
   *  2.35 ed era esattamente quel difetto. */
  zoom: 3.8,
  /** Quanto è forte la sorgente in alto. Sotto il riferimento (0.5) perché lì
   *  il fondo è blu pieno e qui è il nero del sito.
   *  ⚠ SCESA DUE VOLTE IN DUE GIORNI (0.46 → 0.32 → 0.24), entrambe su
   *  richiesta di scurire lo sfondo. È la leva giusta per quella richiesta — è
   *  LA sorgente, cioè il fondo vero e proprio, e abbassarla scurisce senza
   *  toccare le scie (che restano leggibili quanto prima: non sono luce
   *  diffusa, saturano da sole nel tone mapping). */
  sorgenteIntensita: 0.24,
  /** Quanto è LARGA. ⚠ Il riferimento inchioda 1e3 nel denominatore; a quel
   *  valore il nucleo è una macchia piccola e incandescente. 220 lo apre nella
   *  «grande luce diffusa nella zona alta» che era la richiesta, senza alzarne
   *  l'intensità — cioè senza costare contrasto al titolo. */
  sorgenteAmpiezza: 220,
  /** Quanto la sorgente sta SOPRA il bordo alto, in unità di larghezza (0.10 ≈
   *  144px a 1440). Vedi la nota su `uBgLift` nello shader: senza, l'indice di
   *  sezione cade dentro il nucleo. */
  sorgenteAltezza: 0.11,
  /** La FORMA della sorgente: 1 = il fuso alto e stretto del riferimento,
   *  valori sopra = fascia larga appoggiata al bordo. Vedi la nota su uBgAniso. */
  sorgenteForma: 2.1,
  /** L'attenuazione attorno al blocco di testo. Vedi la nota su `uGuard`.
   *  ⚠ IL RAGGIO CONTA PIÙ DELLA FORZA: a raggio stretto (0.62 × 0.30, la prima
   *  taratura) la stessa quantità di luce tolta si legge come una BANDA
   *  orizzontale scura, cioè come il velo appoggiato sopra che si voleva
   *  evitare. Largo e morbido, lo stesso calo si legge come la profondità della
   *  scena. */
  guardiaForza: 0.9,
  guardiaCentroY: 0.19,
  guardiaRaggioX: 1.2,
  guardiaRaggioY: 0.74,
  /** Lo spegnimento verso il fondo, dove comincia la fascia delle card: la luce
   *  viene dall'alto, quindi il basso che si spegne è la cosa che la scena farebbe
   *  da sé. Serve a far staccare le card, che hanno un fondo proprio. */
  pavimento: 0.78,
} as const;
