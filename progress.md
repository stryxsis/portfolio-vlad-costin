# Progress — Portfolio Vlad Costin

Riepilogo per macro-step di quanto fatto finora. Per il dettaglio di ogni decisione, il file di riferimento resta `CLAUDE.md`.

## Step 1 — Fondamenta del progetto
Astro 7 statico, zero client-side framework ("zero islands"), un solo accento colore, coreografia di scroll su `position: sticky` (mai `pin: true`). Sito interamente in italiano. `src/lib/site.ts` come unica fonte di verità per nome/bio/contatti/feature flag. Sistema visivo a token in `global.css` (Tailwind v4, niente `tailwind.config.js`).

## Step 2 — Meccanismo centrale di scroll (M12 — Handoff)
Costruito il sistema di transizione fra sezioni: la sezione uscente resta sticky, l'entrante la occlude scorrendole sopra. Zero paint per frame. Vincoli geometrici verificati via CDP (`verify-stage.mjs`).

## Step 3 — Design della Home, sezione per sezione
- **§01/§02** (Cosa faccio / Dove): passate da superficie chiara a `.theme-slate`; loghi con accensione differenziata desktop/touch; logo Reggiana Packaging da wordmark a SVG vero.
- **§03 In evidenza**: sostituito il vecchio carosello con un mazzo di card sovrapposte (M16) e una vetrina viva dentro ogni card (M17); gestione robusta da 1 a N card.
- **§04 Statement**: da riga singola a manifesto in tre registri tipografici + parola-fantasma + timbro editoriale.
- **§04 Dicono**: doppio impianto automatico (Focus per 1-5 testimonianze / Muro a scorrimento per 6+), scelto in base al numero di citazioni.
- **§05 Percorso**: teaser della timeline, aggiunta l'esperienza JEParma, rispettato il vincolo di un solo schermo.
- **§07 CTA**: passata da fondo ad accento pieno a fondo scuro con un cielo di onde animate.
- **§-1 Loader**: velo di prima visita che copre solo il primo caricamento della Home.
- **§00 Avviso**: banda "cantiere aperto" con chrome ristrutturata in un unico contenitore.
- **§80 Footer**: ridisegnato con un bagliore che continua la luce della CTA, tre canali di contatto.

## Step 4 — Correzioni trasversali di animazione
Risolti bug strutturali nel motore di reveal (`reveal.ts`): titoli che "despawnavano" risalendo la pagina (problema di `ScrollTrigger` con `once: true`), introduzione del vocabolario one-shot generico M14 (`data-activate`/`is-in`/`is-on`/`is-instant`) e dello split per carattere M15, riusati su più sezioni.

## Step 5 — Pagina 404
Pagina intera nuova: fondo con globo 3D (`cobe`, libreria vanilla installata), cielo di stelle generato via SVG statico, segnaposto su Parma, testo in prima persona. Rimosso in un secondo momento il comando di pausa del globo su richiesta esplicita (debito WCAG dichiarato).

## Step 6 — Pagina /chi-sono
- **Hero**: bug della bio invisibile risolto (`settleSplits`); nuovo titolo a due registri, lede in prima persona (`bioIo`), pannello "Adesso" con 4 informazioni correnti (lavoro/studio/dove vivo/disponibilità); hero portata a schermo intero; bug dell'avviso che spostava la hero risolto in modo definitivo.
- **Fascia del metodo**: nuova sezione "Il Superpotere" (citazione pura + parole d'accento animate + alone di sfondo), iterata in quattro giri di feedback.
- **Timeline**: aggiunte due voci-momento (bivio, primo sito online), coda finale animata, titolo e lede riscritti.

## Step 7 — Infrastruttura e telemetria
Montati `@vercel/analytics` e `@vercel/speed-insights` in `BaseLayout.astro`, riconosciuti come telemetria di piattaforma e non come eccezione alla regola "zero islands".

## Step 8 — Contenuti in sospeso (segnaposto)
Testimonianze, progetti 02/03 e due loghi nascosti temporaneamente in attesa di contenuti veri, dietro decisione esplicita di Vlad, reversibile in ogni momento.

---

## Stato attuale
**In pausa** sul resto del piano (M8 — Portfolio/Contatti — e Lighthouse) finché Vlad non la revoca a voce. Il lavoro in corso è design iterativo, una sezione alla volta, non avanzamento di nuove milestone.

## Prossimi step aperti
1. Sbloccare M8 (Portfolio/Contatti) quando la pausa verrà revocata.
2. Sostituire i segnaposto con contenuti veri (testimonianze, progetti, loghi, testi timeline).
3. Decidere sull'esperimento aperto delle onde CTA triggerate da §05 invece che dalla CTA stessa.
4. Eventualmente richiudere il debito d'accessibilità del comando di pausa rimosso in /404.
5. Rieseguire Lighthouse quando la pausa sarà revocata.
