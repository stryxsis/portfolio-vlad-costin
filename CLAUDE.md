# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cos'è

Portfolio personale di Vlad Costin (sviluppatore, studente di Ingegneria Informatica a Parma). Astro 7 statico, zero client-side framework, un unico accento colore, coreografia di scroll costruita su `position: sticky` (mai `pin: true`). Solo italiano. Costruito da un piano dettagliato in `.claude/plans/` (se presente nella sessione) — le decisioni architetturali sotto sono quelle bloccate lì, non improvvisate.

## Comandi

```
npm run dev            # astro dev
npm run build           # astro build (usa tsconfig strictest)
npm run preview         # serve dist/ staticamente — usare questo per misurare, non dev
npm run check            # astro check (0 errori è il requisito, non un obiettivo)
npm run sync              # astro sync — rigenera i tipi delle content collection
npm run verify:anim      http://localhost:4321/          # motore animazioni via CDP
npm run verify:stage     http://localhost:4321/ 1440 900 # invarianti M12/M13 via CDP
npm run measure           http://localhost:4321/ <w> <h> [screenshot.png]  # layout reale via CDP
npx lighthouse http://localhost/index.html --preset=desktop   # contro dist/ buildato, non dev
```

`lighthouserc.json` è il budget assertito: performance ≥0.98, a11y/best-practices/SEO = 1, LCP <1800ms, CLS <0.02, TBT <150ms su preset desktop. Gira contro `staticDistDir: ./dist` — build prima di misurare, mai contro il dev server (HMR e non-minified falsano i numeri).

Gli script `tools/*.mjs` guidano Chrome headless via CDP (non Playwright/Puppeteer): scrollano con eventi `mouseWheel` reali (Lenis intercetta lo scroll, `window.scrollTo` da solo non basta) e leggono `getBoundingClientRect`/`getComputedStyle` reali invece di fidarsi del codice a occhio. Per qualunque modifica a layout, stage sticky o animazioni, questi tre strumenti sono il modo per verificarla — non lo screenshot da solo.

## Architettura

### Zero islands, per scelta esplicita

Non esiste un solo `client:*` in tutto il repo. Ogni interazione (navbar con drawer mobile, form contatti, reveal di testo) è vanilla JS in `src/scripts/*.ts`, bundlato da Astro come modulo ES normale, non un'isola idratata. La navbar (~55 righe) costerebbe ~45 KB gzip come isola React — più di GSAP + ScrollTrigger + SplitText + Lenis messi insieme.

### La regola LCP (non negoziabile)

L'elemento più grande sopra la piega (il ritratto nella hero della Home, oggi a tutto schermo) **non anima mai `opacity`**: Chrome esclude dai candidati LCP un elemento che è stato a opacità zero anche solo per un istante. L'ingresso di quell'elemento usa solo `transform` e `filter: blur()`, che non escludono dal calcolo. Lo stesso vale per qualunque `<h1>` che possa competere per l'LCP. Il pre-hiding dei reveal sotto la piega (`html.js-anim [data-reveal] { opacity:0 }` in `global.css`) è gated dietro `html.js-anim`, aggiunta da uno script inline in `<head>` SOLO se JS gira e `prefers-reduced-motion` lo permette — senza JS, con JS rotto, o per un crawler, tutto il contenuto è visibile e completo da subito.

### M12 — l'overlap-sticky handoff

Il meccanismo centrale della coreografia di scroll, in `src/components/sections/Handoff.astro`. Il cambio di palette fra sezioni non è un'animazione di colore: la sezione uscente resta `position: sticky; top: 0` (gated dietro `html.js-anim` e `≥900px`) e quella entrante, con fondo opaco, le scorre sopra occludendola. Zero paint per frame.

Vincolo geometrico che il componente esiste per far rispettare: l'entrante deve essere **più alta di uno schermo** (`min-height: 104svh`, il 4% è margine deliberato) perché l'occlusione avvenga mentre l'uscente è ancora incollata; la sezione uscente (`.ho__out`) **non deve mai superare la viewport**, o la parte che sfora resta irraggiungibile per sempre mentre è incollata. `tools/verify-stage.mjs` verifica entrambi i vincoli via CDP a ogni modifica — non fidarsi della sola lettura del CSS.

Sotto i 900px (soglia di motion di tutto il sito) o senza JS, niente sticky: le sezioni tornano in fila, tutto in flusso normale, tutto raggiungibile.

### `src/data/` contro Content Collections — perché sono divisi

- `src/content/{progetti,blog}` (via `src/content.config.ts`): prosa, immagini, slug pubblico. Case study e futuri articoli.
- `src/data/*.ts` (timeline, skills, clients, testimonials, statements, backstage): cardinalità fissa, nessun corpo in prosa, riusati nel JSON-LD → vogliono tipi a compile-time, non un loader a glob.

I case study si scrivono duplicando `src/content/progetti/_template.mdx` — non da zero. Il corpo usa `<Chapter id="contesto|sfida|processo|risultato">` (tipo unione: un id sbagliato è un errore di build, non un layout rotto); tutto ciò che il layout deve posizionare, ordinare o riusare altrove (JSON-LD, mirror `.md`, card) sta nel frontmatter, non nel corpo.

### `src/lib/site.ts` — unica fonte di verità

Nome, bio, email, località, feature flag (`SITE.features.testimonials`, `SITE.features.blog`) e il CV vivono lì. Nessun componente scrive a mano un URL, un'email o un nome. L'URL base del sito sta invece in `astro.config.mjs` (`site:`) e si legge da `import.meta.env.SITE` — cambiare dominio è una riga sola, in un solo file.

**Privacy deliberata**: numero di telefono e data di nascita non compaiono da nessuna parte nel sito pubblico. Solo email e form di contatto. Rispettarla in ogni modifica che tocchi `site.ts`, il footer o la pagina contatti.

### Sistema visivo

Tutti i design token (colori, scala tipografica fluida, spaziatura, breakpoint) sono in `src/styles/global.css` dentro `@theme` — Tailwind v4 non ha `tailwind.config.js`. Un solo accento (`--color-accent`) in tutto il sito: per cambiarlo si tocca un token, non si cerca un hex nei componenti. Il pavimento di contrasto per il testo è `--color-text-3`: mai un grigio più scuro di quello per del testo.

**Le tre superfici.** La Home alterna esattamente queste, e non ne esistono altre:

| superficie | token | dove | registro |
|---|---|---|---|
| canvas | `--color-canvas: #050505` | hero, §03 In evidenza, §04 Percorso | nero assoluto |
| slate | `.theme-slate` → `#14141a` | §01 Cosa faccio, §02 Dove | carbone tinto d'indaco |
| paper | `--color-paper: #f0eae0` | Statement §04, CTA §07 | avorio caldo |

**La decisione che tiene insieme la tabella: c'è UN SOLO momento di luce in tutta la Home, ed è il paper.** §01 e §02 erano una superficie chiara (`.theme-light`, un silver `#e2e2e8`) e sono state portate sul carbone. La sequenza è nero → carbone → nero → **avorio**, così il paper dello Statement è un evento e non una delle tante alternanze. Le tre ragioni per cui la versione chiara non funzionava sono scritte per esteso sopra `.theme-slate` in `global.css` — leggerle prima di proporre di tornare indietro.

Corollari da non violare:

- Il canvas **non è più** il blu-ardesia tinto delle prime versioni, è nero assoluto. Un commento che parla di "near-black tinto" descrive lo stato precedente. Il vecchio valore era `#12141a` — praticamente lo slate di oggi, che è quel carbone tornato come superficie autonoma invece che come canvas globale.
- `.theme-slate` ridichiara **solo ciò che cambia davvero** (canvas, superfici, hairline, e `--color-text-3`). `text-1`, `text-2` e l'accento sono già quelli di `:root`: è il senso di restare sul lato scuro, e ridichiararli identici creerebbe due posti da tenere in sync.
- ⚠ **`--color-text-3: #717175` di `:root` è sotto AA e lo è sempre stato**: 4.19:1 su `#050505`, non i ≥4.5 che questo file dichiarava. Porta label mono e metadati, cioè testo da 12-14px, per cui 4.5:1 è obbligatorio. Dentro `.theme-slate` è già corretto (`#85858b`, 5.00:1); **sul canvas nero è ancora da sistemare.**

Per misurare un contrasto non fidarsi a occhio: `--color-accent` su slate è 5.13:1, su canvas 5.70:1, ed entrambi sono margini troppo stretti per stimarli.

`Fonts.astro`/`astro.config.mjs` usano l'API Fonts nativa di Astro (stabile dalla v6): Geist + Geist Mono, self-hostati, fallback metric-matched generati automaticamente. Il mono fa lavoro semantico (numeri indice, label, metadati), non decorazione.

## Divieti espliciti

Questi non sono stile: sono correzioni a errori concreti già commessi o a scorciatoie che sembrano equivalenti e non lo sono.

- **Mai `tailwind.config.js`.** Tailwind v4 non lo usa; se ne esiste uno è stato generato a memoria per la v3 ed è sbagliato.
- **Mai `@astrojs/tailwind`.** È deprecato; l'integrazione corretta è il plugin Vite `@tailwindcss/vite`, già in `astro.config.mjs`.
- **Mai `src/content/config.ts`.** Rimosso in Astro 6; il path corretto è `src/content.config.ts` (vedi sopra).
- **Mai `@font-face` scritti a mano o `<link rel=preload>` manuali per i font.** L'API Fonts di Astro li genera.
- **Mai `pin: true` di ScrollTrigger, mai un pin-spacer nel DOM.** Ogni stage usa `position: sticky` dentro un contenitore alto; ScrollTrigger legge solo il progresso (`scrub`).
- **Mai animare `opacity` sull'elemento più grande sopra la piega** (vedi la regola LCP sopra).
- **Mai `backdrop-filter` fuori dalla navbar** senza una ragione misurata: costa un compositing pass, ed è per questo confinato a un'area di ≤544×48px che non anima mai il raggio di blur.
- **Mai una lista puntata nel sito.** Dove serve enumerare si usa il dispositivo mono `01 / 02 / 03` con filetto.
- **Mai numero di telefono o data di nascita pubblicati** (vedi Privacy sopra).
- **Mai le proprietà CSS indipendenti `translate` / `scale` / `rotate` su un elemento che GSAP anima.** Sembrano il modo pulito di lasciare `transform` libero per GSAP, e non lo sono: GSAP le legge e le ricompila dentro la matrice che scrive su `transform`, quindi il valore CSS finisce applicato **due volte**. Costato una griglia sperimentale (poi rimossa) centrata con `left: 50%` + `translate: -50%`, che si è piazzata a `-712px`, mezza pagina a sinistra. Per centrare un assoluto senza toccare `transform` si usano i margini auto (`inset: 0`, larghezza definita, `margin-inline: auto`).
- **Mai un assert che duplica il valore di un design token** in `tools/verify-*.mjs`. Diventa rosso al primo ritocco di palette senza che nulla si sia rotto, e un controllo sempre rosso insegna a ignorare l'esito dell'intero strumento. Si verifica l'invariante — luminanza, rapporto di contrasto, relazione fra due valori letti a runtime — non l'hex.

## Stato attuale (aggiornato 2026-07-31)

**⏸ IN PAUSA. Non è una pausa "di questa sessione": vale finché non la revoca l'utente a voce, e va riconfermata da lui, non dedotta dal fatto che sembri il momento giusto.**
- **Non eseguire Lighthouse.**
- **Non procedere con M8** (About/Portfolio/Contatti/404).
- Più in generale: **non far avanzare il piano.** La fase corrente è design.

### Cosa si sta facendo davvero

Ri-design visivo della Home, **una sezione alla volta**. Dopo §01/§02 (sotto), il lavoro è passato a **§03 In evidenza** (`FeaturedProjects.astro`): sostituito interamente il vecchio carosello a "piatti" (M9) con un mazzo di card sovrapposte (M16) e una vetrina viva dentro ogni card (M17) — vedi le due sezioni dedicate più sotto. Poi il titolo della sezione è stato riportato in linea con la gerarchia tipografica del resto del sito (era rimasto a `--text-h3`, più piccolo dei titoli che introduce) e affiancato da una CTA vera verso `/portfolio`.

**Difetti trovati e corretti in questo giro, non specifici di una sezione:**
- **`Button.astro` mandava a capo qualunque icona nello slot**, su TUTTI i bottoni del sito (anche "Scarica il CV"), non solo quello nuovo. Causa: `.btn__label` è un flex item di `.btn`, quindi il browser lo blockifica (inline→block, da specifica), e la preflight di Tailwind dichiara `svg { display: block }` — un blocco dentro un blocco prende riga propria, e `white-space: nowrap` non può risolverlo perché non è un problema di ritorno a capo del testo. Fix: `.btn__label { display: inline-flex; align-items: center; gap: 0.5rem }`.
- **Il dev server può servire CSS vecchio in modo silenzioso** — successo più volte in questa sessione, sempre con lo stesso sintomo: una sezione misura alto il triplo/quadruplo di quanto dovrebbe (`docH`/altezza di una riga moltiplicati per un fattore assurdo), pur essendo il codice sorgente corretto. Causa verificata: cache di Vite (`node_modules/.vite`) incoerente con un processo `astro dev` rimasto in piedi da prima di molte modifiche al CSS. **Prima di dire che una sezione "si è rotta", confrontare `npm run build` + `npm run preview` con `npm run dev` sullo stesso identico markup** (stessa `docH`, stesse altezze via CDP) — se divergono, il colpevole è quasi sempre il dev server, non il codice. Il fix è terminare il processo, `rm -rf node_modules/.vite`, e riavviare — non editare nulla finché non si è confermata la divergenza.

### §01/§02 — Fatto in questo giro:

- il blocco è passato da superficie chiara a `.theme-slate` (vedi la tabella delle superfici sopra);
- una griglia blueprint (hairline sui confini delle 12 colonne) e un'affordance in hover sulle tre righe `01/02/03` di §01 sono state **provate e poi tolte su richiesta esplicita** — non farle ricomparire di propria iniziativa;
- i **loghi di §02** si accendono a colori differenziando per dispositivo: su desktop (`hover: hover`) resta il meccanismo originale, solo in hover — un'eccezione deliberata alla regola "niente hover" qui sotto, perché due dei tre loghi sono link veri; su touch (`hover: none`) si accendono UNA VOLTA SOLA via `data-activate`/`is-in` (vedi sotto). Il filtro di riposo è stato comunque corretto a `invert(0.62)` (era `0.3`, tarato per un fondo chiaro che non esiste più): con `0.3` i loghi sarebbero quasi invisibili anche nel ramo hover-only di desktop.
- **M14 — l'accensione**, il vocabolario di reveal one-shot introdotto per `.wid__clauses` e poi generalizzato a `.wid__title` (lo squiggle) e `.sp__logos` (l'ingresso della riga + l'accensione dei loghi su touch). Vedi sotto.

### Regole per le animazioni (dal 2026-07-27, valide su tutto il sito)

Due regole esplicite dell'utente, dopo aver trovato §01/§02 che si ri-attivavano ogni volta che si tornava a scorrere sopra:

1. **Niente hover come trigger**, tranne eccezioni dichiarate tipo i link (i loghi cliccabili di §02). Ogni altra animazione si attiva da sola per una combinazione di fattori (in pratica: posizione di scroll), non al passaggio del mouse.
2. **Ogni animazione si esegue una volta sola**, tranne quelle esplicitamente continue e dichiarate come tali (il word-carousel della hero, l'anello di scroll `ring-spin`, il respiro di "in corso" nella timeline — vedi sotto). Una volta completata, NON deve tornare allo stato di partenza risalendo la pagina.

⚠ **Corollario che ha causato il bug reale: mai gatare un'animazione one-shot su `.is-active`.** Quella classe (vedi `initSectionState` in `reveal.ts`) è lo stato "sto guardando questa sezione ADESSO" — un IntersectionObserver la aggiunge e la toglie ad ogni passaggio, per design, perché serve a `SectionIndex.astro` per risincronizzarsi in tempo reale con la sezione corrente (quello SÌ deve tornare indietro, è uno stato non un'animazione). Sia lo squiggle sotto "tempo, soldi e mal di testa" sia l'accensione dei loghi su touch erano gated su `[data-section].is-active`/`.sp.is-active`: si disegnavano/accendevano, e risalendo la pagina si disfacevano, per poi ridisegnarsi da capo riscendendo. Il fix per entrambi è stato lo stesso: `data-activate` (M14), le cui classi si AGGIUNGONO e non si tolgono mai.

#### M14 — il vocabolario one-shot, generico

`reveal.ts` commuta solo classi, additive e mai rimosse; il CSS del componente marcato fa tutta l'animazione (la cascata fra elementi fratelli è `transition-delay`/`animation-delay` su `nth-child`, quindi non costa un tween per elemento). Qualunque elemento può marcarsi con `data-activate` e usare una, due o tutte e tre le classi:

| classe | soglia | cosa fa |
|---|---|---|
| `is-in` | `top 80%` | prima battuta: l'elemento arriva (a fuoco/visibile), resta leggibile |
| `is-on` | `top 40%` | seconda battuta, opzionale: l'"accensione" vera e propria |
| `is-instant` | — | l'elemento era già stato attraversato in un salto: stato finale, **durata E ritardo** a zero |

⚠ **`is-in` era `top 88%`, portato a `80%` su richiesta esplicita** (l'utente lo voleva più presto, "quando il testo è appena affacciato"). È il default CONDIVISO da tutti gli elementi `data-activate`: prima di introdurre una soglia diversa per un solo elemento, verificare se semplicemente `is-in` o `is-on` (già esistenti) bastano — non serve costruire un valore custom per elemento se uno dei due default già combacia.

Chi lo usa oggi e con quali classi:

- **`.wid__clauses`** (WhatIDo.astro) — entrambe le battute: `is-in` mette a fuoco le righe (scale/translate/blur), `is-on` accende filetti e numeri.
- **`.sp__logos`** (SocialProof.astro) — solo `is-in`: fa entrare la riga (rimpiazzo del vecchio fade di M4) e, su touch, accende i loghi a colori.
- **`.wid__title`** (WhatIDo.astro) — solo `is-in`: disegna lo squiggle sotto "tempo, soldi e mal di testa" una volta sola.
- **`.sp__title`** (SocialProof.astro) — solo `is-in`: il riflesso lettera-per-lettera, vedi M15 sotto.

Decisioni da non disfare senza rileggere il perché:

- **La pausa fra le due battute NON è un `delay`, è la distanza di scroll fra le due soglie** (80% → 40%, non 88% → 65%: la prima versione usava 65%, ~200px a 900px di viewport, attraversabile in un singolo respiro di rotellina — la pausa non si sentiva mai. A 40% sono ~430px, serve un gesto di scroll reale). Un timer fisso da 1s farebbe finire l'ultima riga di `.wid__clauses` ~2,4s dopo l'ingresso, e chi scorre a velocità normale attraversa il blocco in meno di due: sarebbe già oltre.
- **"Spento" non è mai invisibile né sfocato mentre è leggibile.** Il blur di `.wid__clauses` vive solo *dentro* la transizione di `is-in`, mai come stato di attesa. Tenerlo a `opacity: 0` o sotto un blur violerebbe l'invariante che regge la rete di sicurezza sotto.
- **`data-activate` NON VA MAI COMBINATO CON `data-reveal` sullo stesso elemento.** Costato lo stesso bug due volte (prima su `.wid__clauses`, poi quasi ripetuto su `.sp__logos`): se condividono la soglia d'ingresso, il fade generico di M4 — che parte da opacità zero — copre l'istante in cui l'effetto di `data-activate` succede, rendendolo invisibile o indistinguibile dal solito ingresso di ogni sezione. Se un elemento marcato `data-activate` ha bisogno anche di un ingresso "arriva da sotto e sfuma", quell'ingresso va scritto come CSS ancorato a `.is-in` (vedi `.sp__logos`), non delegato a `data-reveal`.
- **`is-instant` deve azzerare `transition-duration` E `transition-delay`, non solo il ritardo.** Trovato via CDP su un salto al fondo pagina: avevo azzerato solo `transition-delay` sullo squiggle (2,5s di durata + 0,8s di ritardo) e sui loghi, e il salto restava a metà disegno/mezza saturazione per secondi prima di completarsi — un'animazione di cui nessuno ha visto l'inizio non deve nemmeno impiegare tempo a finire.

#### M15 — split strutturale per carattere, e il riflesso di `.sp__title`

`data-split="chars"` (in `reveal.ts`) fa fare a SplitText **solo** lo split: uno `<span class="sp__letter">` per lettera, senza nessun tween automatico (a differenza di M1/M2, che invece attaccano subito un reveal a risalita). L'accensione la fa il CSS del componente, gated su `data-activate`/`is-in` dell'antenato — stessa filosofia di M14, riusata.

`.sp__title` in SocialProof.astro ("Ecco chi mi ha già dato fiducia") lo usa per un riflesso che attraversa il titolo lettera per lettera, sinistra→destra: ogni lettera va da `--color-text-3` (spenta) a `--color-text-1` (accesa) con un lampo di `text-shadow` che la supera e si assesta — l'overshoot è la stessa tecnica del LED sui numeri `01/02/03` di WhatIDo, qui su `text-shadow` invece che su `color` (vedi sotto il perché).

Tre vincoli che hanno determinato l'architettura, non gusto:

- **`--i` è un indice GLOBALE, non locale alla parola.** SplitText spacca ogni parola separatamente; senza coordinamento la cascata ripartirebbe da zero ad ogni parola. Ogni `<span class="sp__word" data-split="chars">` porta un `data-i-offset` scritto a mano (il conteggio caratteri di "Ecco chi mi ha già" — 4/3/2/2/3 — è statico, non serve calcolarlo a runtime), e `reveal.ts` assegna `--i = offset + indice locale` a ogni lettera in `onSplit`.
- **"dato" e "fiducia" NON sono spezzate in lettere.** Il loro gradiente diagonale vive su `background-clip: text` (classe `.sp__word--accent`, introdotta risolvendo il bug del gradiente — vedi sopra): spezzarle in lettere-figlie con una propria `opacity` riprodurrebbe esattamente quel bug (un figlio compositato a parte che il genitore non riesce più a clippare). Restano quindi parole intere che si accendono come blocco, continuando la stessa numerazione (`--i: 14` e `--i: 15`).
- **Il bagliore usa `text-shadow`, non `color`, per l'overshoot.** Un overshoot di colore (vedi il LED di WhatIDo: grigio → `accent-hi` più vivido → `accent`) richiede un tono "più luminoso del finale" disponibile in palette; per le lettere bianche del titolo `--color-text-1` è già il bianco più chiaro del sistema, non esiste un "più bianco" a cui sovrascattare. `text-shadow` invece è un canale indipendente da `color`: può lampeggiare e spegnersi senza bisogno di un token "oltre il bianco", e non entra in conflitto con `background-clip: text` sulle due parole gradiente (sono proprietà CSS diverse, coesistono sullo stesso elemento).

⚠ **`.sp__letter` è creato da SplitText via JS: serve `:global()` anche sulla classe, non solo su `html.js-anim`.** Stesso principio di `.sp__logo-svg` (arriva da `set:html`): un elemento senza l'attributo di scope di Astro non viene mai raggiunto da un selettore che lo lascia scopato. Trovato via CDP: la prima versione scriveva `:global(html.js-anim) .sp__letter { color: ... }` — sembra corretto, ma solo `html.js-anim` era dentro `:global()`; `.sp__letter` restava scopato e non incontrava mai nessuna lettera reale, quindi tutte restavano bianche fin dal primo istante invece di partire spente. Corretto in `:global(html.js-anim) :global(.sp__letter)`.

⚠ **La rete di sicurezza di M14 è agganciata all'evento `scroll` del DOM, non a quelli di ScrollTrigger, e non è pignoleria.** Misurato via CDP: con un salto al fondo assoluto del documento (`window.scrollTo(0, scrollHeight)` — tasto Fine, o ripristino della posizione al reload) non arriva **niente**: né `refresh`, né `scrollEnd`, né `onLeave` dei trigger. Il blocco restava a `scale 0.96` e `blur(5px)` per sempre, e bastava un nudge di rotellina da 40px per risolverlo. `scroll` invece è garantito dalle specifiche per qualunque `scrollTo`. L'ascoltatore si stacca da solo appena il blocco è acceso.

⚠ **M11 (`data-rule`) non ha più nessun utente.** L'unico era il filetto di §01, passato a M14 perché lì deve far *parte* dell'accensione e non precederla. Il codice resta (vocabolario valido e riusabile), ma modificarlo oggi non produce effetti visibili da nessuna parte. Il filetto sotto "per loro" nel titolo di §03 (vedi M17 sotto) **sembra** un candidato per M11 ma non lo usa: spiegato nella sua sezione perché.

#### M16 — il mazzo di §03, e M17 — la vetrina dentro ogni card

`FeaturedProjects.astro` + `stage.ts`. M16 sostituisce quello che nel piano originale era un carosello a "piatti" (uno visibile alla volta, commutazione a soglie di scroll): oggi le card restano TUTTE in scena e si accatastano salendo da sotto, in un'unica timeline GSAP in scrub (`[data-stack]` sulla sezione, `[data-stack-card]` su ogni card). M17 è cosa succede DENTRO ogni card mentre è in cima al mazzo: `[data-reel]` per i siti (un wireframe o uno screenshot vero che scorre in scrub, sincronizzato alla stessa timeline) e `[data-call]` per l'agente vocale (un trascritto che si accende UNA VOLTA, a tempo — non in scrub, perché una conversazione che si riavvolge annulla l'appuntamento, il che è inquietante e non ha una versione "bella").

Vincoli che hanno determinato l'architettura, non gusto:

- **Il parcheggio delle card (`PARK`) e l'altezza libera per gli scalini si MISURANO, non si inchiodano.** Con `PARK = 108` fisso (100/0.96 + margine, giusto per tre card) una quarta card avrebbe lasciato un dito visibile in fondo allo stack. Oggi `PARK` si calcola da `holder.clientHeight / cardH` a runtime, e l'altezza della card usa `calc(100% - (var(--fp-cards) - 1) * 2%)` dove `--fp-cards` lo scrive Astro dalla lunghezza reale dell'array.
- **La coda ferma (un intero schermo di scroll a vuoto dopo che il mazzo è composto) non la crea `end` dello ScrollTrigger, la crea `travel` del Handoff** (`index.astro`, oggi 320svh — vedi la nota lunga lì). Allungare solo `end` senza allungare `travel` avrebbe spalmato l'animazione su una corsa più lunga dello sticky, con le card ancora in movimento mentre lo Statement le copre.
- **La vetrina desktop/telefono (M17) usa `container-type: size` + `cqh`, non percentuali dirette**, per il vincolo di altezza: `grid-template-columns: minmax(0,1fr)` + `align-content: center` sul contenitore, MAI `place-content: center` — con `justify-content` la traccia si dimensiona sul contenuto e `width: 100%` diventa circolare (misurato: la vetrina collassava a 2×3px). Il `min(100%, Ncqh)` che limita la larghezza del duo di device è ricavato dal CENTRAGGIO verticale del laptop (che è l'unico figlio in flusso), non dal suo ingombro — e va ritarato ogni volta che l'altezza dell'intro sopra cambia, perché quella stessa formula dipende da quanto spazio resta al mazzo.
- **Il reel con lo screenshot vero usa `height: auto`** (non le percentuali fisse dei wireframe, 260%/340%): l'immagine è catturata a proporzioni già corrette (2,6 schermate desktop, 3,4 mobile) e `width: 100%` dentro lo schermo del device produce da solo l'altezza giusta. `stage.ts` misura la corsa a runtime (`reel.offsetHeight − schermo.clientHeight`), quindi un reel con proporzioni diverse funziona senza toccare una riga.
- **Catturare un sito con un'intro che blocca lo scroll richiede aspettarla**, non scavalcarla a forza rimuovendo overlay a caso: alcuni siti (es. Netlify con preloader) restano a `scrollHeight` fisso finché l'intro non finisce da sola (~20s in un caso reale). Misurare `document.documentElement.scrollHeight` prima di fidarsi di uno screenshot.
- **Un `<span>` decorativo dentro un `<em>` non sopravvive a `data-split="lines"` (M1).** M1 spacca e ricostruisce il DOM del titolo per creare le righe mascherate; un vero elemento figlio agganciato da un `ScrollTrigger` a caricamento perde il riferimento dopo lo split asincrono di SplitText e il suo trigger non scatta mai (misurato: restava a `scaleX(0)` per sempre). Un `::after` non ha questo problema perché non è un nodo del DOM leggero — è generato sull'elemento che lo porta, e SplitText quell'elemento lo SPOSTA, non lo distrugge. È il motivo per cui il filetto sotto "per loro" in §03 è un `::after`, non `data-rule`.
- **In una sezione sticky, le due soglie di M14 (80%/40%) non producono una pausa**, perché il titolo resta fermo in cima alla viewport mentre la si attraversa: le soglie vengono superate quasi nello stesso istante. L'unica pausa disponibile lì è un `transition-delay` esplicito, tarato sulla durata del reveal che lo precede.

⚠ **Entrambi i punti sopra sono risolti**, non più aperti: `verify-anim.mjs` non confronta più una stringa di copy (misura invece che SplitText non perda né duplichi caratteri, indipendente dal testo), e la flakiness storica del primo campione di §30 era `scrollTo` che usciva dal loop leggendo `window.scrollY` — la posizione ANIMATA da Lenis, non il suo bersaglio interno — quindi campionava mentre l'interpolazione era ancora in corso. Riscritto per attendere la QUIETE (due letture consecutive identiche) e riconvergere se deriva. **`verify:stage` è oggi 34/34 stabile su esecuzioni ripetute**, `verify:anim` 23/23 (era 18/18 — le nuove asserzioni sono sul manifesto §04, vedi sotto).

⚠ **`tools/measure.mjs` non emula il touch.** Restringe solo la viewport (`Emulation.setDeviceMetricsOverride`), senza `Emulation.setTouchEmulationEnabled`: per il CSS resta `hover: hover` anche a 390px, quindi non è uno strumento valido per verificare regole gated su `(hover: hover)` / `(hover: none)` — serve un CDP a mano con quel comando in più (o un browser reale).

### §02 Dove — il logo Reggiana Packaging, dal wordmark al vettoriale vero

Il segnaposto tipografico ("REGGIANA PACK" composto in Geist) è stato sostituito col vettoriale reale, e sono servite due correzioni non ovvie oltre al semplice incolla-SVG.

- **`viewBox` RITAGLIATO sul contenuto, non sul canvas dichiarato dal file esportato.** Il file originale (`0 0 838.3 695`) lasciava ~270 unità vuote sotto il logotipo: l'artwork occupava solo y≈222→423, meno di un terzo dell'altezza dichiarata. `.sp__logo-svg` scala su `height`, quindi con il viewBox originale il logo arrivava a ~29% dell'altezza dei loghi vicini — sembrava piccolo perché era piccolo DENTRO la sua stessa cornice, non per una regola CSS diversa. Ritagliato a `40 195 760 250`: aspect ratio risultante ~3:1 (è un logotipo icona+testo orizzontale, non un marchio quadrato come gli altri due), e `width: auto` lo lascia allargare di conseguenza — nessuna larghezza fissa imposta altrove.
- **Il nastro bianco del monogramma (`.rpk-void`, lo spazio negativo che separa la foglia dalla "R") non sopravvive alla silhouette generica.** Gli altri due loghi sono monocromatici, quindi `filter: brightness(0) invert(0.62)` (la silhouette grigia a riposo, usata da tutta la riga) li appiattisce senza perdere niente. Questo marchio no: il nastro è per definizione PIÙ CHIARO del corpo (bianco su teal scuro), e `brightness(0)` azzera i canali di colore ma non l'alfa — appiattiva anche il nastro allo stesso grigio di tutto il resto, e il monogramma diventava una macchia unica senza la propria forma interna.
  - Primo tentativo scartato: cambiare il `fill` nell'SVG. Inutile — qualunque colore opaco, passato per `brightness(0)`, esce dallo stesso grigio; il fill non è la leva finché c'è il filtro.
  - Secondo tentativo scartato: `fill: transparent` sul nastro (l'alfa sopravvive al filtro, quindi come MECCANISMO funziona). Ma su questo fondo "trasparente" vuol dire esattamente `#14141a`, il canvas di `.theme-slate`: il nastro non diventava scuro, SPARIVA — un elemento dipinto col colore del proprio fondo non è un elemento scuro, è un elemento assente.
  - Fix: `filter: none` SOLO su questo logo (`.sp__logo-svg--duotone`), con due toni espliciti da token — `var(--color-text-2)` per corpo/foglia, `var(--color-text-1)` per il nastro — che riproducono la RELAZIONE del marchio vero (nastro più chiaro) restando coerenti col grigio a cui la silhouette porta gli altri due loghi. I colori veri (teal `#004259`, verde `#29813f`, bianco) arrivano solo in accensione (hover desktop / `is-in` touch, stessa cascata a scaglioni degli altri due).

### §03 In evidenza — quanto scorre il Network Day prima di essere coperto

`LEAD` (la frazione di corsa in cui la prima card sta sola in scena, `stage.ts`) e `travel` del Handoff `featured` (`index.astro`) sono stati alzati **in coppia**, tre volte, su richieste successive dell'utente che ogni giro trovava ancora insufficiente: 220svh/0.12 → 320svh/0.2 → 360svh/0.32 → **440svh/0.45**. Da soli i due numeri si annullano quasi a vicenda — un `LEAD` più alto su una corsa uguale sposta solo la proporzione fra le fasi, non i pixel reali di scroll — vanno mossi insieme. La formula in pixel (viewport 900): `scoperto = LEAD × (travel_px − 1 schermo) / (0.89 + 0.11 × LEAD)`.

⚠ **Il vero difetto non era la quantità di corsa, era DOVE finiva la finestra del reel della prima card.** `inFocus(0)` chiudeva a `LEAD + dur` (cioè dentro la salita della seconda card, non al suo inizio): il reel arrivava solo al ~55% della propria pagina nell'istante in cui la seconda card cominciava a coprire la prima, quindi il fondo del sito del Network Day non si vedeva mai, a prescindere da quanto si allungasse `LEAD`. Corretto chiudendo `inFocus(0)` esattamente a `LEAD`: la pagina scorre il 100% di sé stessa mentre è ancora completamente scoperta. Le altre card non hanno questo problema (la loro finestra si estende apposta oltre l'inizio della copertura, per una pausa scoperta troppo breve altrimenti) — l'asimmetria in `inFocus()` è voluta, non un'incoerenza.

### §04 Statement — da riga singola a manifesto editoriale

"Nota a margine" (`Statement.astro`) non è più un corpo unico: tre registri tipografici più un piano di sfondo.

- **Tre `tier` nel testo** (`quiet`/`loud`/`accent`, in `data/statements.ts`): la premessa (`quiet`) va smorzata — corpo minore, `--color-paper-text-2`/`--color-text-2` (mai `text-3`, sotto AA su queste superfici), peso 400 — mentre il resto dell'`<h2>` è ORA la voce dominante di default (accento pieno, peso 600): prima l'accento stava solo sulle parole marcate e il resto pesava uguale alla premessa, cioè un manifesto che non contrasta niente.
- **Il filetto cinetico sotto l'accento è un `::after` su un `<em>` `inline-block`, NON un `background-image` + `box-decoration-break: clone`.** Il gradiente-per-riga sembrava la scelta giusta per un accento di quattro parole che va a capo, ma misurato via CDP: con `line-height: 0.92` i frammenti di riga si SOVRAPPONGONO (l'area di contenuto di Geist misura ~1.107em contro una riga da 0.92em), quindi il filetto della prima riga tagliava le lettere della seconda. `inline-block` sposta l'accento INTERO alla riga successiva invece di spezzarlo — stessa tecnica di `.fp__h em` in §03 — e con un solo frammento il `::after` non ha più una seconda scatola con cui sovrapporsi.
- **La parola-fantasma** (`.st__ghost`, generalizzazione di M6/`data-drift`): corpo gigantesco, contrasto quasi nullo (`color-mix` al 70% verso il fondo, mai l'hairline puro — su un glifo da 200px l'area conta quanto il rapporto), ripete il NUCLEO SEMANTICO dello statement ("Studiare"/"Capire", campo `ghost` nei dati) invece di essere decorazione a caso, e deriva in parallasse allo scroll. Ancorata a DESTRA e sbordante (`overflow: clip` su `.st`), non a filo del testo: misurato che a filo copriva le prime parole della premessa lasciando vuoto il resto della riga. `data-drift` (M6, prima senza nessun utente nel markup, come M11) è stato parametrizzato — `data-drift="-5"` — perché la micro-deriva del 2.5% pensata per un filo impercettibile non bastava a un piano di sfondo.
- **Il timbro editoriale** (`[ MANIFESTO · STATEMENT 04 ]`, campo `stamp`): stesso corpo mono/stesso registro della label in alto, entra ultimo (1900ms, dopo filetto e parole) — parentesi e punto medio `aria-hidden`, le parole no.
- `tools/verify-anim.mjs` aveva un assert stantio: "il testo dello statement è nell'HTML" cercava la stringa `'non scrivo solo'`, che è una riga di `WhatIDo.astro` — verde da sempre per il motivo sbagliato, sarebbe rimasto verde anche con la sezione statement cancellata dalla pagina. Corretto per cercare davvero premessa+accento+timbro. Aggiunte 4 asserzioni sui tre nuovi elementi (riposo/dopo-scroll/salto/reduce).

### §04 Percorso (ex §06) — JEParma nel teaser, e il vincolo di UNO schermo

`JourneyTeaser` è passato da "06" a "04": con `Testimonials` spenta (flag a `false`), il numero saltava da "03 · In evidenza" a "06" senza nulla in mezzo.

Aggiunta l'esperienza JEParma al teaser (prima tagliata dal `limit={3}`, visibile solo su `/chi-sono`). Verificato via CDP PRIMA di scegliere come: con tutte e 4 le voci (`limit={4}`) la sezione misurava 1031px contro gli 900 disponibili — rompe il vincolo dello sticky (vedi la nota in testa a `JourneyTeaser.astro`: una sezione incollata più alta della viewport rende irraggiungibile la parte che sfora). Fix scelto: nuovo campo `teaser?: boolean` su `TimelineEntry` (`lib/types.ts`), messo a `false` sulla voce delle superiori in `data/timeline.ts` — esclusa SOLO dal teaser Home (`JourneyTeaser` filtra `entry.teaser !== false` prima di passare a `limit={3}`), resta intera su `/chi-sono` dove `Timeline` non legge questo campo. Risultato: 900px esatti a 1440×900.

⚠ A 1440×720 (viewport basso) `.jt` misura 823px, oltre il vincolo — ma è un difetto PRE-ESISTENTE (misurato 860px sulla versione precedente a questa sessione, quindi non un regresso di questa modifica) e non nello scope di queste richieste. Stessa famiglia di fix già applicata a `FeaturedProjects.astro` (media query su altezza corta) se un giorno si decide di chiuderlo.

### "In corso" che respira — la terza eccezione al loop infinito

`.tli__now` (`TimelineItem.astro`) pulsa all'infinito (`opacity` 1→0.4→1, 3.2s, `ease-in-out`) per le voci ancora aperte della timeline. È un'eccezione DICHIARATA alla regola "ogni animazione una volta sola" (vedi sotto), nella stessa famiglia del word-carousel della hero e dell'anello di scroll (`ring-spin`): il loop qui non annuncia un ingresso, descrive uno STATO tuttora vero ("la laurea è ancora in corso, ogni volta che guardi"), quindi il ripetersi è il senso e non un vizio.

Nessun gate su `html.js-anim`: è `animation` CSS pura (gira anche senza JS), e la regola globale già esistente in `global.css` (`@media (prefers-reduced-motion: reduce) { * { animation-iteration-count: 1 !important } }`) la ferma da sola — non richiede una dichiarazione per componente. Verificato via CDP che oscilla in condizioni normali e resta fermo a piena opacità con reduced-motion.

⚠ **Il server preview può essere uno zombie `astro dev`, non solo Vite col cache vecchia.** Variante più insidiosa della nota qui sopra su "il dev server può servire CSS vecchio": in questa sessione un processo `astro dev --json` avviato il giorno prima (probabilmente dall'estensione IDE) era rimasto in ascolto sulla porta 4321. `pkill -f "astro preview"` non lo terminava MAI (il suo comando reale contiene `dev`, non `preview`), quindi ogni `npm run preview -- --port 4321` successivo falliva a bind silenziosamente mentre lo zombie continuava a rispondere ai `curl`/CDP con contenuto plausibile ma STALE — non solo CSS vecchio: un `index.html` senza il `<link rel=stylesheet>` verso il chunk esternalizzato di un componente, che produceva un layout apparentemente rotto (`.fp__card` senza `position: absolute`, altezza a 4767px) con zero modifiche di codice responsabili. Il sintomo che lo tradisce: `verify-stage`/`verify-anim` cominciano a fallire su un invariante che non si è toccato. **Diagnosi affidabile su Windows**: `netstat -ano | grep ":<porta>.*LISTENING"` per il PID, poi `powershell -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = <pid>').CommandLine"` per leggere il comando REALE — non fidarsi del nome del processo (`node`, generico) né di un pattern `pkill -f` che assume quale comando l'abbia avviato.

Il piano in `.claude/plans/dapper-chasing-fairy.md` e i commentoni in testa ai componenti sono **storia**, non specifica corrente: descrivono uno stato del design più vecchio di quello che c'è a schermo. La fonte di verità del design è il rendering — screenshottare la sezione con `tools/measure.mjs` prima di dire qualunque cosa su di essa.

Sul design si **propone e si chiede**, non si implementa di iniziativa propria.

Il piano di riferimento completo (milestone 1–11, decisioni bloccate, sistema visivo, coreografia per sezione) è in `C:\Users\vladc\.claude\plans\dapper-chasing-fairy.md`. La Home (M1–M7) è costruita e rifinita a livello di dettaglio; il lavoro recente è stato tutto iterazione fine su sezioni già esistenti, non nuove milestone.

Le sessioni di rifinitura fino a questo punto erano rimaste locali (mai committate): il primo commit che le raccoglie tutte è quello che accompagna questo aggiornamento del file. Da qui in avanti vale il flusso normale in "Git workflow" sotto — commit ai blocchi di progresso significativi, non ad ogni modifica.

### Convenzioni consolidate durante le rifiniture, da riusare (non nel piano originale)

- **Sezioni "in"/"out" di un handoff M12 dichiarano SEMPRE il proprio `min-height: 100svh`** (grid + `align-content:center` per centrare il contenuto), invece di affidarsi a padding generoso per raggiungere l'altezza minima richiesta da `Handoff.astro`. Pattern in `Statement.astro`, `CTASection.astro`, `FeaturedProjects.astro`, `JourneyTeaser.astro`, `WhatIDo.astro`. Vale su tutti i breakpoint, mobile incluso — non è un bug, è "un'idea per viewport" applicato alla lettera.
- **`fit-content` (parola chiave CSS) non è interpolabile** da una CSS transition/animation: qualunque `width: 100% → width: fit-content` scatta in un frame solo, a prescindere dalla `transition-duration`. Il fix è misurare la larghezza reale in JS e scriverla come lunghezza vera (px) in una custom property, poi transizionare verso `var(--quella-property)`. Vedi `src/scripts/nav.ts` (`measure()`) + `Navbar.astro` (`--nav-compact-w`).
- **Curve di easing per morph "osservabili" lunghi** (es. pillola navbar): `--ease-fluid`/`--ease-in-out-quart` hanno velocità di picco 4-6x la media (front-loaded) e su una durata lunga sembrano uno scatto, non un movimento continuo. Aggiunto `--ease-morph: cubic-bezier(0.4, 0, 0.35, 1)` in `global.css` (picco ~2.2x la media, quasi lineare) per questi casi specifici.
- **Navbar (`Navbar.astro` + `src/scripts/nav.ts`)**: morph TRIGGERATO da scroll (ScrollTrigger `onToggle` che tocca `html.nav-compact`), MAI scrubbato — l'utente lo vuole esplicitamente indipendente dalla velocità/quantità di scroll, parte e va fino in fondo da solo. Larghezza compatta misurata via JS (vedi punto sopra), non `fit-content` in CSS.
- **Mask-image invece di overlay a colore piatto** per sfumare i bordi di un elemento sopra uno sfondo fotografico irregolare (es. word-carousel della hero): `mask-image`/`-webkit-mask-image` sfuma l'opacità reale dell'elemento (mostra sempre ciò che c'è davvero dietro), un overlay `::after` con `background` deve indovinare esattamente il colore dello sfondo sotto o lascia una giuntura visibile.
- **`box-decoration-break: clone`** per un `<em>`/span con sfondo pieno e `border-radius` che deve restare visivamente corretto anche se il testo va a capo (altrimenti lo sfondo/bordo si applica solo al primo rigo).
- **Foto hero**: gli asset vivono in `src/assets/brand/` con naming `heroN-clean.png` (es. `hero3-clean.png`, `hero4-clean.png`, `hero5-clean.png`); sono tutte 2752×1536, soggetto centrato, sfondo nero puro, quindi intercambiabili senza ritoccare `object-position` (`50% 40%`) in `HeroHome.astro`.
- **Parole del word-carousel CTA hero** (attuali, in ordine): Entra, Scopri, Esplora, Comincia, Inizia, Immergiti, Avventurati, Naviga, Viaggia, Approfondisci.
- **`padding` e `height` di un elemento piccolo dentro un contenitore proporzionale vanno in LUNGHEZZE (px/clamp), non in `%`.** Un `padding: 4.5%` su un device disegnato in CSS si risolve sulla larghezza del CONTENITORE, non del device stesso: costato una cornice del telefono 5 volte troppo spessa in M17 (misurato: 32px invece di 6). Una cornice è comunque uno spessore quasi costante nella realtà, non una proporzione — la lunghezza è anche la descrizione più onesta.
- **Un vincolo di layout ricavato da una misura ("124cqh sembrava giusto a 1440×900") va riverificato ogni volta che cambia qualcosa SOPRA o INTORNO a quell'elemento**, non solo quando si tocca l'elemento stesso: il vincolo della vetrina duo-device (M17) è stato tarato due volte nella stessa sessione, la seconda perché il titolo di §03 è diventato più alto e ha ristretto la finestra disponibile senza che nessuno toccasse la vetrina.

## Git workflow

Questo repo è tracciato su GitHub (`portfolio-vlad-costin`, pubblico). L'utente ha pre-autorizzato quanto segue senza bisogno di conferma ogni volta:
- Commit quando si raggiunge un blocco di progresso significativo e funzionante durante una sessione (non dopo ogni piccola modifica).
- Push al remote periodicamente, come parte dello stesso flusso.

Restano da evitare operazioni Git distruttive (force-push, reset --hard, riscrittura della history) senza conferma esplicita.
