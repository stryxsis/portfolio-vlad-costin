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
SELECTORS='.a,.b' SCROLL=bottom npm run sample:px http://localhost:4321/ 1440 900  # contrasto sui PIXEL dipinti
npx lighthouse http://localhost/index.html --preset=desktop   # contro dist/ buildato, non dev
```

`lighthouserc.json` è il budget assertito: performance ≥0.98, a11y/best-practices/SEO = 1, LCP <1800ms, CLS <0.02, TBT <150ms su preset desktop. Gira contro `staticDistDir: ./dist` — build prima di misurare, mai contro il dev server (HMR e non-minified falsano i numeri).

Gli script `tools/*.mjs` guidano Chrome headless via CDP (non Playwright/Puppeteer): scrollano con eventi `mouseWheel` reali (Lenis intercetta lo scroll, `window.scrollTo` da solo non basta) e leggono `getBoundingClientRect`/`getComputedStyle` reali invece di fidarsi del codice a occhio. Per qualunque modifica a layout, stage sticky o animazioni, questi strumenti sono il modo per verificarla — non lo screenshot da solo.

⚠ **`sample:px` serve dove `getComputedStyle` non arriva.** Gli assert di contrasto in `verify-anim.mjs` risalgono il DOM finché non trovano un `background-color` non trasparente: corretto finché il fondo è un colore pieno, inutile nel momento in cui sotto il testo c'è un **gradiente, una foto o due strati sovrapposti** — lì il valore che conta non è dichiarato da nessuna parte e l'unica misura onesta è il pixel dipinto. Legge il fondo accanto al testo (mai sotto: si rischia di campionare un glifo), tiene il campione più chiaro come caso peggiore, e sceglie da solo la soglia WCAG giusta leggendo corpo e peso — 3:1 vale SOLO da 24px (o 18.66px in grassetto), e applicarlo a una label mono da 11px è il modo più comune di dichiararsi conformi senza esserlo.

## Architettura

### Zero islands, per scelta esplicita

Non esiste un solo `client:*` in tutto il repo. Ogni interazione (navbar con drawer mobile, form contatti, reveal di testo) è vanilla JS in `src/scripts/*.ts`, bundlato da Astro come modulo ES normale, non un'isola idratata. La navbar (~55 righe) costerebbe ~45 KB gzip come isola React — più di GSAP + ScrollTrigger + SplitText + Lenis messi insieme.

⚠ **Vlad porta spesso riferimenti presi da librerie React (shadcn, motion/react, Aceternity…), a volte incollando il prompt di integrazione generico che li accompagna** — "install these NPM dependencies", "copy to /components/ui". **Quel prompt descrive un altro progetto.** La risposta giusta non è né rifiutare né installare: è portare il **disegno** e scartare l'implementazione, dicendo esplicitamente cosa non si è installato e perché. È già successo due volte, con lo stesso esito e nessun rimpianto: il muro di §04 (M18, da React + motion/react + shadcn) e l'avviso §00 (da shadcn Alert + lucide + radix + cva). Di solito si scopre anche che l'ASPETTO del riferimento va adattato quanto il codice — entrambi erano tarati su un tema chiaro che qui sarebbe stato una seconda inversione di palette.

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

**Privacy deliberata, RIVISTA il 2026-08-06**: la data di nascita non compare da nessuna parte nel sito pubblico, e questa metà della regola resta intatta. Il **numero di telefono invece SÌ**, da quella data: Vlad ha revocato esplicitamente quella metà per avere WhatsApp fra i canali della CTA finale, sapendo che `wa.me` mette il numero nell'URL — quindi nell'HTML servito, quindi leggibile da qualunque scraper (non esiste una variante che lo nasconda). Il numero vive **solo** in `SITE.author.whatsapp`; nessun componente lo scrive a mano. Chi rimuove WhatsApp dalla CTA rimuova anche quel campo, o resta un numero pubblicato che nessuno usa. Rispettare entrambe le metà in ogni modifica che tocchi `site.ts`, il footer o la pagina contatti.

### Sistema visivo

Tutti i design token (colori, scala tipografica fluida, spaziatura, breakpoint) sono in `src/styles/global.css` dentro `@theme` — Tailwind v4 non ha `tailwind.config.js`. Un solo accento (`--color-accent`) in tutto il sito: per cambiarlo si tocca un token, non si cerca un hex nei componenti. Il pavimento di contrasto per il testo è `--color-text-3`: mai un grigio più scuro di quello per del testo.

**Le tre superfici.** La Home alterna esattamente queste, e non ne esistono altre:

| superficie | token | dove | registro |
|---|---|---|---|
| canvas | `--color-canvas: #050505` | hero, §03 In evidenza, §04 Dicono, §05 Percorso, §07 CTA | nero assoluto |
| slate | `.theme-slate` → `#14141a` | §01 Cosa faccio, §02 Dove | carbone tinto d'indaco |
| paper | `--color-paper: #f0eae0` | Statement (Nota a margine) | avorio caldo |

**La decisione che tiene insieme la tabella: c'è UN SOLO momento di luce in tutta la Home, ed è il paper.** §01 e §02 erano una superficie chiara (`.theme-light`, un silver `#e2e2e8`) e sono state portate sul carbone. La sequenza è nero → carbone → nero → **avorio**, così il paper dello Statement è un evento e non una delle tante alternanze. Le tre ragioni per cui la versione chiara non funzionava sono scritte per esteso sopra `.theme-slate` in `global.css` — leggerle prima di proporre di tornare indietro.

⚠ **L'accento pieno NON è più una superficie, dal 2026-08-06.** La CTA §07 era l'unico posto in cui `--color-accent` copriva il 100% dei pixel, ed era la seconda inversione della Home ("agire, adesso"). Oggi la CTA è su canvas e l'evento di chiusura lo produce un **campo di luce**: onde concentriche viola che si espandono dall'angolo in basso a destra (`.cta__sky` in `CTASection.astro`). Il motivo è vincolante, non estetico: le onde vivono di contrasto viola-su-buio, quindi su un fondo già viola diventavano una vibrazione tonale — la stessa ragione per cui un "glow viola" su fondo viola non esiste. Conseguenze da tenere a mente:
- la Home ha ora **una sola inversione di palette** (il paper dello Statement) invece di due, quindi il paper è un evento ancora più isolato di prima;
- `--color-accent-text-2` (che esiste SOLO per il testo sopra l'accento pieno) **non ha più nessun utente in Home**. Non rimuoverlo dai token: serve ancora a `Button` con `tone="accent"` e alle pagine interne, ma se un giorno risultasse orfano è lì che va cercato il perché;
- la chiusura resta un evento perché cambia **luminanza e movimento**, non tinta: il handoff `closing` è passato a `tone="canvas"`, quindi è canvas → canvas come `intro` ("il cambio è di contenuto, non di palette").

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
- **Mai la data di nascita pubblicata** (vedi Privacy sopra). Il numero di telefono NON è più vietato dal 2026-08-06, ma esiste in un solo posto (`SITE.author.whatsapp`) e per un solo scopo (il link WhatsApp della CTA): non replicarlo altrove né esporlo come `tel:` in chiaro senza chiederlo.
- **Mai le proprietà CSS indipendenti `translate` / `scale` / `rotate` su un elemento che GSAP anima.** Sembrano il modo pulito di lasciare `transform` libero per GSAP, e non lo sono: GSAP le legge e le ricompila dentro la matrice che scrive su `transform`, quindi il valore CSS finisce applicato **due volte**. Costato una griglia sperimentale (poi rimossa) centrata con `left: 50%` + `translate: -50%`, che si è piazzata a `-712px`, mezza pagina a sinistra. Per centrare un assoluto senza toccare `transform` si usano i margini auto (`inset: 0`, larghezza definita, `margin-inline: auto`).
- **Mai un assert che duplica il valore di un design token** in `tools/verify-*.mjs`. Diventa rosso al primo ritocco di palette senza che nulla si sia rotto, e un controllo sempre rosso insegna a ignorare l'esito dell'intero strumento. Si verifica l'invariante — luminanza, rapporto di contrasto, relazione fra due valori letti a runtime — non l'hex.

## Stato attuale (aggiornato 2026-08-07)

**⏸ IN PAUSA. Non è una pausa "di questa sessione": vale finché non la revoca l'utente a voce, e va riconfermata da lui, non dedotta dal fatto che sembri il momento giusto.**
- **Non eseguire Lighthouse.**
- **Non procedere con M8** (About/Portfolio/Contatti/404).
- Più in generale: **non far avanzare il piano.** La fase corrente è design.

### Cosa si sta facendo davvero

Ri-design visivo della Home, **una sezione alla volta**. Dopo §01/§02 (sotto), il lavoro è passato a **§03 In evidenza** (`FeaturedProjects.astro`): sostituito interamente il vecchio carosello a "piatti" (M9) con un mazzo di card sovrapposte (M16) e una vetrina viva dentro ogni card (M17) — vedi le due sezioni dedicate più sotto. Poi il titolo della sezione è stato riportato in linea con la gerarchia tipografica del resto del sito (era rimasto a `--text-h3`, più piccolo dei titoli che introduce) e affiancato da una CTA vera verso `/portfolio`.

Da lì il lavoro è proseguito **verso il fondo pagina**, sempre una sezione alla volta: **§04 Dicono** (accesa con segnaposto, spostata due volte, e infine riscritta come muro di voci che scorre — M18) e **§07 CTA** (riscritta in tipografia, poi portata da fondo accento pieno a fondo scuro con un cielo di onde animate). Le due sezioni dedicate più sotto sono la fonte di verità per entrambe.

### Sessione 2026-08-07 — chiusa, committata (`1eb7686`) e pushata

Tre lavori indipendenti, tutti verificati (`check`/`build`/`verify:stage` 34/34/`verify:anim` tutto verde/`sample:px` nessun contrasto sotto soglia) prima del commit:

- **Onde della CTA**: partivano già "in pausa a metà" (ritardi negativi + `animation-play-state: paused`, vedi il corollario in cima al file su cosa mostra una pausa con ritardo negativo). Corrette a partenza ritardata di mezzo secondo, ordinata dalla prima onda, e rallentate (18s). Link LinkedIn reale (`linkedin.com/in/vlad-costin`) in `SITE.author.linkedin`/`sameAs`.
- **Footer ridisegnato** (vedi §80 sotto): bagliore che continua la luce della CTA invece di riaccenderla, tre canali di contatto, tre difetti di contrasto/cucitura misurati e corretti col nuovo `tools/sample-px.mjs`.
- **Doppio impianto testimonianze** (vedi §04 Dicono sotto): `Testimonials.astro` sceglie da solo fra righe editoriali (1-5) e muro che scorre (6+) in base a quante citazioni ci sono in `data/testimonials.ts`. **Approvato da Vlad il 2026-08-07** — la pagina di prova `/prova-testimonianze` è stata cancellata di conseguenza, non esiste più.

⚠ **Falso allarme, non un difetto reale**: a inizio sessione l'immagine della hero sembrava non caricarsi nel browser di Vlad. Verificato via screenshot CDP fresco (`tools/measure.mjs`) che il ritratto (`hero4-clean.png`) è renderizzato correttamente dal dev server — file presente, tracciato, servito con 200, `<picture>` con srcset corretto. Quasi certamente lo zombie-dev-server o la cache di Vite già documentati sotto ("Il dev server può servire CSS vecchio in modo silenzioso"): se ricapita, riavviare il dev server prima di sospettare il codice.

**Un'esperienza aperta, non ancora decisa**: la prova "fai partire le onde della CTA quando entro nella viewport di §05 Percorso invece che della CTA stessa" è ancora nel codice (`CTASection.astro`, selettore `:global(.ho:has(.jt.is-in))`, con il selettore precedente conservato in un commento per il revert). Vlad non ha ancora detto se tenerla o tornare indietro.

**Difetti trovati e corretti in questo giro, non specifici di una sezione:**
- **`Button.astro` mandava a capo qualunque icona nello slot**, su TUTTI i bottoni del sito (anche "Scarica il CV"), non solo quello nuovo. Causa: `.btn__label` è un flex item di `.btn`, quindi il browser lo blockifica (inline→block, da specifica), e la preflight di Tailwind dichiara `svg { display: block }` — un blocco dentro un blocco prende riga propria, e `white-space: nowrap` non può risolverlo perché non è un problema di ritorno a capo del testo. Fix: `.btn__label { display: inline-flex; align-items: center; gap: 0.5rem }`.
- **Il dev server può servire CSS vecchio in modo silenzioso** — successo più volte in questa sessione, sempre con lo stesso sintomo: una sezione misura alto il triplo/quadruplo di quanto dovrebbe (`docH`/altezza di una riga moltiplicati per un fattore assurdo), pur essendo il codice sorgente corretto. Causa verificata: cache di Vite (`node_modules/.vite`) incoerente con un processo `astro dev` rimasto in piedi da prima di molte modifiche al CSS. **Prima di dire che una sezione "si è rotta", confrontare `npm run build` + `npm run preview` con `npm run dev` sullo stesso identico markup** (stessa `docH`, stesse altezze via CDP) — se divergono, il colpevole è quasi sempre il dev server, non il codice. Il fix è terminare il processo, `rm -rf node_modules/.vite`, e riavviare — non editare nulla finché non si è confermata la divergenza.

### Sessione 2026-08-07 (seconda) — i segnaposto nascosti, e cosa si è rotto nascondendoli

Vlad ha chiesto di **nascondere momentaneamente tre blocchi di contenuto finto**, ognuno finché non arriva quello vero. Tutti e tre sono reversibili a vista e i dati restano nei rispettivi file:

| cosa | dove | come |
|---|---|---|
| sezione testimonianze | `lib/site.ts` | `features.testimonials: false` |
| progetti 02 e 03 | `FeaturedProjects.astro` | `VISIBLE_SHOWCASE = SHOWCASE.slice(0, 1)` |
| loghi 2 e 3 (ALSI, Reggiana) | `SocialProof.astro` | `VISIBLE_LOGOS = LOGOS.slice(0, 1)` |

⚠ **Nessuno dei tre va ripristinato di propria iniziativa.** Il logo è esplicito: Vlad ha detto "finché non chiedo il consenso".

⚠ **Nascondere contenuto ha ROTTO tre cose, e nessuna era nel contenuto.** Tutte e tre meritano di essere lette prima di toccare un conteggio di elementi in questo repo:
1. **§03 è diventata nera e vuota** con una card sola — vedi la sezione dedicata più sotto. La sezione era scritta per tre card e trattava "meno di due" come un caso da non gestire.
2. **Nove assert di `verify:anim` e cinque di `verify:stage` sono diventati rossi** senza che si fosse rotto niente, e uno **crashava** invece di fallire. Entrambi gli strumenti davano per scontato il contenuto (tre card, una chiamata in vetrina, la sezione Dicono in pagina). Ora si biforcano — vedi §03.
3. **1260px (140svh) di scroll puramente nero fra il mazzo di §30 e Statement.** Segnalato da Vlad il giorno dopo ("vedo ancora una sezione nera vuota inutile"): l'Handoff `dicono` porta `travel={140}`, tempo di lettura per le tre card di Testimonials mentre è incollata — ma con la sezione spenta `<Testimonials>` non renderizza niente, `.ho__out` resta a 0 di altezza (misurato via CDP), e quel tempo di lettura diventava scroll morto puro davanti a `.ho__backdrop` nero, senza nessun contenuto da leggere. Fix in `index.astro`: `hasTestimonials = SITE.features.testimonials && TESTIMONIALS.length > 0` (stessa condizione di `show` in `Testimonials.astro`, duplicata perché a deciderla è il GENITORE — l'Handoff non sa cosa renderà il proprio slot finché non l'ha già renderizzato), e `travel` passato via spread condizionale — non `travel={hasTestimonials ? 140 : undefined}`, che sotto `exactOptionalPropertyTypes` (tsconfig strictest) è un tipo diverso da "prop assente" e non compila. Verificato senza regressioni con le testimonianze riaccese: `travel=140` torna intatto, muro completo, nessun assert rosso.

⚠ **PRIMA DI DIRE "non hai fatto niente, vedo ancora tutto": il server sulla 4321 può essere un `astro preview`, che serve `dist/` e NON si aggiorna da solo.** Successo in questa sessione: le tre modifiche erano corrette nel sorgente e invisibili nel browser perché nessuno aveva ricostruito. È una variante della trappola già documentata più sotto (dev server con cache stantia / zombie `astro dev`), con un sintomo diverso: qui il server è quello giusto, è il *build* a essere vecchio. `netstat -ano | grep ":4321.*LISTENING"` + `Get-CimInstance Win32_Process` per leggere il comando REALE, poi `npm run build`.

### §00 — L'avviso "cantiere aperto", e la chrome che ora è UN contenitore (2026-08-08)

Una banda che scende dall'alto ~2,6s dopo il caricamento, spinge giù la navbar, e si ritira superata la hero. `AnnouncementBanner.astro` + `banner.ts`.

⚠ **Origine: uno snippet shadcn/React portato da Vlad** (`Alert` + `Button` + `lucide-react` + `@radix-ui/react-slot` + `class-variance-authority`). **Nessuna delle cinque dipendenze è stata installata** — stessa decisione già presa per il muro di §04 (M18, riferimento React + motion/react): si porta il **disegno**, non l'implementazione. Qui il risultato è markup statico, tre transizioni CSS e ~90 righe di TS. E nemmeno il suo aspetto: lo snippet è `bg-violet-50`, cioè una banda CHIARA, che in Home sarebbe stata la **seconda inversione di palette** — e la Home ne ha una sola per scelta (il paper dello Statement).

⚠ **LA SPINTA È GEOMETRIA VERA, NON DUE TRANSFORM SINCRONIZZATI**, e per ottenerla `.nav` **non è più l'elemento `position: fixed`**. Il fisso è salito su un wrapper `.chrome` in `BaseLayout`, che contiene avviso e navbar come **fratelli in flusso normale**: la navbar scende perché sopra di lei è comparso un blocco alto. Due conseguenze che valgono da sole la scelta: senza JS non c'è niente da misurare né da coordinare (la banda è già lì, la navbar è già bassa), e non esiste il fotogramma in cui le due si sovrappongono perché una transizione è partita un istante prima dell'altra. **Rimettere `position: fixed` su `.nav` farebbe sparire la spinta in silenzio.**

- **L'ingresso anima `height` da `0` a `<altezza vera>px`**, e l'altezza la misura `banner.ts` in `--ab-h`. `height: auto` non è interpolabile — stessa famiglia di problema, e stessa soluzione, di `--nav-compact-w`.

⚠ **ERA `margin-top: calc(-1 * var(--ab-h, 6rem))`, e il fallback `6rem` ha causato un difetto vero, segnalato da Vlad il giorno dopo** ("vedo l'avviso per un microsecondo che rientra, poi dopo un po' esce di nuovo"). Nel buco fra "js-anim aggiunta" (sincrono, in `<head>`) e "`--ab-h` misurata" (banner.ts, un modulo caricato dopo), il margine usava il fallback — e con tre-quattro righe di testo l'altezza vera (~130-150px) supera abbondantemente 96px: l'ultima riga sbordava per una manciata di frame, poi si ritirava di scatto appena arrivava la misura vera. **Riscritto a `height: 0` + `overflow: clip`**: zero non ha bisogno di un fallback da indovinare, è zero per qualunque lunghezza di testo.

⚠ **Il primo fix ha introdotto un SECONDO difetto, altrettanto vero, segnalato lo stesso giorno**: "non c'è più l'animazione fluida di prima, ora compare e scompare". Causa: `banner.ts` osservava con un `ResizeObserver` **lo stesso elemento** (`.ab`) la cui `height` la transizione CSS sta animando. Ogni fotogramma della transizione È un cambio di dimensioni per quell'elemento, quindi l'observer scattava a ripetizione DURANTE la propria stessa animazione, interrompendola per rimisurare — decine di volte nei suoi 520ms, letta come uno scatto invece che uno scorrimento. **Fix: si misura `.ab__inner` (il figlio), non `.ab`.** `.ab__inner` non ha mai un'altezza propria vincolata da nessuna regola — dimensiona sempre sul proprio contenuto, comunque sia vincolato l'antenato (`overflow: clip` sul genitore taglia la RESA, non ridimensiona il figlio) — quindi è già, sempre, la misura corretta, e osservarlo non si autoalimenta mai. Bonus: elimina anche l'intero trucco a quattro passi (`ab-measuring`/`ab-no-transition`) che il primo fix aveva introdotto per leggere l'altezza di un elemento forzato a `height:0` — non serve più, perché `.ab__inner` non è mai forzato a niente.

Verificato via CDP in tutti gli stati (riposo 0px, ingresso pieno 98px a 1440/175px a 390, ritiro rimosso dal DOM, `prefers-reduced-motion`) e **con un poll dedicato della `height` calcolata ogni 30ms durante la finestra di ingresso**: 11 valori distinti in rampa (1→2→19→44→63→77→90→95→96→97px) su ~500ms — la prova che l'animazione interpola di nuovo, non solo che lo strumento esistente non segnala rosso.
- **`--chrome-shift`**: quanto la chrome è cresciuta in cima, `0px` di default. Esiste perché la navbar spinta giù **copriva l'indice di sezione** — misurato, "00 · INIZIO" spariva dietro la pillola. Chi si ancora sotto la chrome lo somma invece di ricopiare un'altezza misurata a runtime.
- ⚠ **Il fix dell'indice è in DUE posti diversi, e non è ridondanza.** Su `.idx` (SectionIndex) somma solo all'ancora dello **sticky**, che agisce quando l'indice è agganciato. Ma a scroll 0 non lo è: l'indice della hero desktop è **assoluto**, e lì il `top` va corretto in `HeroHome`. ⚠ **Un `transform` su `.idx` sembrava la soluzione unica ed era sbagliato**: sposta l'elemento anche quando NON è ancorato, e sotto i 900px l'indice della hero sta in flusso fra la foto e il testo — misurato a 390px, i 120px di banda lo spingevano **sopra il titolo**. E su `.hero__idx` il transform è comunque escluso: `hero-in-fade` lo anima già, e un'animazione con `fill: both` conclusa continua ad applicare il proprio valore finale, vincendo sulla transizione.
- **Si ritira superata la hero** (90% di uno schermo), `once: true` — non un `onToggle` come il morph della navbar: quello è uno STATO ("sto scorrendo") ed è giusto che torni indietro, questo è un avviso, e un avviso che ricompare tornando in cima è un popup. Poi viene **rimosso dal DOM**: una banda solo traslata fuori vista resta leggibile da uno screen reader, cioè un avviso congedato che continua ad annunciarsi a chi non può vedere di averlo chiuso.
- ⚠ **`transitionend` da solo NON bastava.** Il margine negativo è gated dietro `html.js-anim`, quindi con `prefers-reduced-motion` non c'è nessuna transizione da terminare: l'evento non arrivava mai e la banda **restava in cima per sempre**, fissa sopra ogni sezione. Misurato con `REDUCE=1`. Serve il ramo senza transizione più un tetto di sicurezza.
- **Niente `backdrop-filter`**, benché la navbar ce l'abbia e la banda le stia attaccata: il divieto è misurato e vale per aree > ~544×48px. Questa è larga quanto la viewport. Fondo opaco `--color-surface-1`, che è anche l'unica scelta corretta sopra la foto della hero.
- **Il testo è DETTATO da Vlad parola per parola** (2026-08-08, aggiornato lo stesso giorno con la battuta sul telefono): "Ciao, sono il sito. Spoiler: sono ancora un cantiere aperto 🚧. Qualche testo è qui solo per fare scena […] Inoltre, ti chiedo un favore: guardami da PC, perché per entrare nello schermo del telefono devo ancora fare un po' di dieta. L'unica cosa definitiva (e vera al 100%) è il CV del mio creatore: scaricalo qui. Buon scroll!" — non riscriverlo senza chiedere. La libertà presa è solo tipografica: `.ab__true` (`--color-accent-hi`, grassetto) sulle parti VERE — "definitiva", "il CV del mio creatore", e il link stesso, stessa tinta per tutte e tre così il link ne è la conclusione naturale — e un grassetto neutro (nessun colore) su "cantiere aperto" nel titolo, che è la battuta e non la parte seria. La battuta sul telefono resta nel grigio del corpo: è un'altra scusa, non una verità, quindi non riceve l'accento. Stesso principio dei tre registri di `Statement.astro` (quiet/loud/accent), applicato qui in miniatura.
- **Niente `max-width` su `.ab__text`** (era `62ch`, tolto su richiesta di Vlad il 2026-08-08): col testo allungato dalla battuta sul telefono, 62ch avrebbe fatto andare a capo la frase molto prima del bordo destro disponibile nella colonna `minmax(0,1fr)` del grid.

⚠ **Falso positivo di `sample:px` su `.ab__true`, non un difetto**: le due frasi in grassetto misurano un fondo marrone/arancio (`#9c794d`, `#80530e`) invece di `--color-surface-1`, sotto soglia. **Confermato via crop+upscale con `sharp` che è un artefatto**: la sonda "5px a sinistra del box" cade esattamente sul confine di anti-aliasing fra il testo grigio normale che precede e il grassetto viola che segue — una singola frangia di subpixel, invisibile a schermo (verificato ritagliando e ingrandendo 3× lo screenshot: il testo è pulito, viola coerente su fondo scuro). La prova che è la sonda e non la sezione: il terzo elemento con la STESSA classe (`scaricalo qui`, il link) misura 8.32:1 pulito nello stesso identico run — stessa dichiarazione CSS, stesso colore, stesso fondo. Non ho toccato `sample-px.mjs`: cambiare il margine della sonda è una modifica che vale per OGNI misura futura del sito, non solo per questo caso, e non è nello scope di una richiesta di testo.
- **Niente puntino che pulsa**: sarebbe stata una quarta eccezione dichiarata al divieto di loop infiniti, per decorazione, su un elemento che si è appena fatto notare da solo.
- **2600ms non è un numero tondo**: l'ultima entrata della hero finisce a 1650ms e il word-carousel parte a 2200ms. Ritoccando la coreografia della hero, va ritoccato con lei.
- Contrasti misurati sui pixel reali (`sample:px`): 18,98:1 titolo, 7,50:1 testo, 8,32:1 link. `verify:stage` e `verify:anim` verdi dopo la ristrutturazione della chrome.

### M1/M2 — perché un titolo già entrato "despawnava" risalendo, e `once` non basta (2026-08-08)

Segnalato da Vlad su §01 Cosa faccio, poi sullo Statement: "il titolo fa la sua animazione e ok, ma quando torno su mi capita per 2/3 volte che il titolo despauna e poi quando ritorno giu ri fa l'animazione". Le due sezioni non condividono meccanismi propri (una ha lo squiggle di M14, l'altra no): il denominatore comune è `data-split` (M1 su `.wid__title`, M2 su `.st__text`), quindi il difetto era in `reveal.ts`.

⚠ **LA PRIMA DIAGNOSI ERA SBAGLIATA, ed è documentata qui perché è la trappola in cui è facile ricadere.** Sembrava un re-split: `autoSplit: true` si riaggancia davvero a `document.fonts` (`loadingdone`, verificabile in `node_modules/gsap/SplitText.js`), quell'evento può scattare più volte per sessione, e un re-split rimetterebbe il titolo nella posa di partenza. Plausibile, coerente col sintomo, **e falso.** Il primo fix (un `WeakSet` che evita di ricostruire il tween a ogni re-split) è stato dichiarato risolutivo dopo averlo verificato con un `loadingdone` SIMULATO — cioè verificando che la mia teoria fosse internamente coerente, non che il difetto fosse sparito. Vlad lo ha rivisto subito dopo.

⚠ **La causa vera: `once: true` uccide uno ScrollTrigger quando si raggiunge la sua posizione di FINE, non quando l'animazione finisce.** Il default di `end` è `bottom top` ("il fondo dell'elemento ha superato il bordo alto della viewport"), e questi titoli vivono dentro un handoff sticky (M12): il loro schermo resta incollato, quindi quel fondo può non superare mai davvero il bordo alto. Il trigger resta **vivo a tempo indeterminato**, e finché è vivo risalire prima del suo `start` rirende il tween a progress 0 — che per un `gsap.from()` è la posa nascosta. Ridiscendere lo rigioca.

**Come è stato stabilito, invece che ipotizzato**: un `MutationObserver` sull'elemento durante tutta l'oscillazione ha registrato **zero** ristrutturazioni del DOM, mentre il transform della parola tornava esattamente a `translate(0%, 105%)`, il valore `from`. DOM intatto + playhead a zero = non è un re-split, è il tween che viene rirenderizzato.

Fix in `reveal.ts` (`finishEntrance`): a ingresso completato si **uccide lo ScrollTrigger** e si ripulisce il transform inline (`clearProps`), così non resta in giro niente che possa riportare indietro l'elemento. È la regola già valida per M14 (`data-activate`, classi additive mai rimosse): un'animazione one-shot, una volta giocata, non deve avere nessuna strada per tornare allo stato di partenza. `splitPlayed` resta e copre il caso restante e diverso — un re-split VERO da resize di finestra, che altrimenti ricostruirebbe un `gsap.from` nuovo su un titolo già entrato.

⚠ **Due assert nuovi in `verify-anim`, e la prima stesura era inutile.** Riusava lo stato lasciato dallo scroll fino in fondo pagina, ed era verde **anche con il difetto in produzione** — verificato disattivando il fix e ricostruendo. Motivo: arrivare in fondo fa superare anche la FINE dei trigger, che a quel punto `once` uccide davvero, quindi il difetto sparisce da solo proprio perché si è scorso troppo. Il controllo corretto riproduce il gesto vero — pagina fresca, si scende **quanto basta** a far entrare il titolo (a misura, non a numero di tick), ci si ferma mentre è ancora in vista, e si risale. Misura la **posa dipinta** (lo scarto fra il frammento e il proprio wrapper mascherato, in frazione della sua altezza), non il transform inline: asserire "lo style è vuoto" legherebbe il controllo a COME è stato risolto. Con il fix disattivato segna `statement 1.05`, cioè la posa nascosta; con il fix, `0`.

### §01/§02 — Fatto in questo giro:

- il blocco è passato da superficie chiara a `.theme-slate` (vedi la tabella delle superfici sopra);
- una griglia blueprint (hairline sui confini delle 12 colonne) e un'affordance in hover sulle tre righe `01/02/03` di §01 sono state **provate e poi tolte su richiesta esplicita** — non farle ricomparire di propria iniziativa;
- i **loghi di §02** si accendono a colori differenziando per dispositivo: su desktop (`hover: hover`) resta il meccanismo originale, solo in hover — un'eccezione deliberata alla regola "niente hover" qui sotto, perché due dei tre loghi sono link veri; su touch (`hover: none`) si accendono UNA VOLTA SOLA via `data-activate`/`is-in` (vedi sotto). Il filtro di riposo è stato comunque corretto a `invert(0.62)` (era `0.3`, tarato per un fondo chiaro che non esiste più): con `0.3` i loghi sarebbero quasi invisibili anche nel ramo hover-only di desktop.
- **M14 — l'accensione**, il vocabolario di reveal one-shot introdotto per `.wid__clauses` e poi generalizzato a `.wid__title` (lo squiggle) e `.sp__logos` (l'ingresso della riga + l'accensione dei loghi su touch). Vedi sotto.

### Regole per le animazioni (dal 2026-07-27, valide su tutto il sito)

Due regole esplicite dell'utente, dopo aver trovato §01/§02 che si ri-attivavano ogni volta che si tornava a scorrere sopra:

1. **Niente hover come trigger**, tranne eccezioni dichiarate tipo i link (i loghi cliccabili di §02). Ogni altra animazione si attiva da sola per una combinazione di fattori (in pratica: posizione di scroll), non al passaggio del mouse.
2. **Ogni animazione si esegue una volta sola**, tranne quelle esplicitamente continue e dichiarate come tali. Le eccezioni dichiarate, in ordine di introduzione: il word-carousel della hero, l'anello di scroll `ring-spin`, il respiro di "in corso" nella timeline, e — dal 2026-08-06 — le **onde del cielo della CTA** (`.cta__wave`, 18s), il **respiro del glow** del suo bottone (`.cta__glow::before`, 4,6s) e il **muro di §04 Dicono** (`.ts__track`, 38/46/42s — M18). Una volta completata, un'animazione one-shot NON deve tornare allo stato di partenza risalendo la pagina.

   ⚠ Le due eccezioni della CTA convivono nella stessa sezione ed è deliberato che non si sommino: operano su **scala** diversa (un'onda larga quanto la sezione contro un alone di 34px) e su **tempo** diverso (18s contro 4,6s). Due movimenti dello stesso colore che condividessero anche una delle due dimensioni si leggerebbero come un unico battito confuso — è il criterio da riusare se un giorno se ne aggiunge un'altra. Il muro di §04 non entra nel confronto perché sta in **un'altra sezione**: non si vede mai insieme a loro.

   ⚠ **Un movimento continuo che porta TESTO DA LEGGERE si deve poter fermare, e non è una gentilezza:** WCAG 2.2.2 lo richiede sopra i 5 secondi. Il muro di §04 si ferma in `:hover` (gated su `(hover: hover)`, o su touch resterebbe fermo per sempre dopo un tap) e in `:focus-within` (non gated: chi arriva coi tasti esiste anche su un tablet). Fermarsi in hover **non** viola la regola 1 qui sopra: quella riguarda le animazioni che PARTONO al passaggio del mouse.

   ⚠ **`animation-iteration-count: 1` NON è uno stop per un marquee.** La regola globale di `global.css` sotto `prefers-reduced-motion` basta per un respiro o un pulsare, ma per uno scorrimento significa "fai un giro solo" — cioè quaranta secondi di movimento comunque. Chi chiede meno movimento non chiede meno ripetizioni, chiede fermo: serve un blocco reduce dedicato che spenga il **nome** dell'animazione (e che ripeta il gate `html.js-anim` nel selettore, vedi il corollario di specificità sotto).

   ⚠ **Un'animazione continua "in pausa" NON mostra i valori base se il suo `animation-delay` è NEGATIVO.** Costato un difetto visibile: le onde della CTA erano distribuite lungo il ciclo con ritardi negativi (per avere il campo già pieno all'arrivo) e messe in `animation-play-state: paused` fino al raggiungimento della sezione. Ma un ritardo negativo colloca la partenza nel passato, quindi la pausa congela ogni onda a un fotogramma qualsiasi: cinque bande immobili sparse a mezzo schermo, che poi ripartivano da lì — "sembra che l'animazione sia già partita e sia in pausa ad aspettare che parta". Con ritardi POSITIVI la pausa coincide invece con lo stato precedente al primo fotogramma, e la pausa congela anche il conteggio del ritardo (quindi un ritardo d'ingresso è un'attesa osservabile, non un numero già scaduto). Il prezzo è che il campo si popola in una durata intera: è inevitabile, "la prima onda parte dall'inizio" e "il campo è pieno subito" sono richieste incompatibili.

   ⚠ Corollario di specificità: `@media (prefers-reduced-motion: reduce) { .cta__wave { animation: none } }` **non morde** se l'animazione è dichiarata sotto `html.js-anim` — una media query non aggiunge specificità. Il blocco reduce deve ripetere il gate nel selettore.

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

⚠ **Entrambi i punti sopra sono risolti**, non più aperti: `verify-anim.mjs` non confronta più una stringa di copy (misura invece che SplitText non perda né duplichi caratteri, indipendente dal testo), e la flakiness storica del primo campione di §30 era `scrollTo` che usciva dal loop leggendo `window.scrollY` — la posizione ANIMATA da Lenis, non il suo bersaglio interno — quindi campionava mentre l'interpolazione era ancora in corso. Riscritto per attendere la QUIETE (due letture consecutive identiche) e riconvergere se deriva. **Entrambi gli strumenti sono stabili su esecuzioni ripetute.**

⚠ **NON citare un totale del tipo "34/34": dal 2026-08-07 il NUMERO di assert dipende da cosa c'è in scena** e non è più una costante del repo. `verify:stage` ne salta tre (più uno nel ramo senza JS) se in vetrina non c'è nessuna card `kind: 'call'`, e ne scambia due con le loro gemelle opposte quando le card sono meno di due; `verify:anim` ne salta nove se §04 Dicono è spenta dal feature flag. Misurato: 35 assert con tre progetti in vetrina, 30 con uno. **L'esito da leggere è "Tutti i controlli superati", non il conteggio** — e le righe che cominciano con `·` dicono a voce alta cosa è stato saltato e perché, apposta perché nessuno scambi il silenzio per un verde.

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

### §03 — il numero di card è una VARIABILE, e per mesi non lo è stato (2026-08-07)

Vlad ha chiesto di nascondere i progetti 02 e 03 (segnaposto) finché non ne ha di veri. Con **una sola card la sezione è diventata un rettangolo nero e vuoto.** Non un difetto di taratura: un guasto completo, e la catena è istruttiva.

⚠ **La causa: `if (cards.length < 2) return` in `stage.ts`, con un commento che dichiarava il contrario di quel che faceva** ("con una card sola non c'è mazzo: la sezione resta l'elenco statico"). L'elenco statico è il ramo **senza** `html.js-anim`; dentro quel ramo le card partono a `opacity: 0` in CSS e ad accenderle è il `gsap.set` più sotto — l'unico. Uscire prima lo saltava, e le card restavano posizionate, misurabili, al posto giusto e **invisibili**. È il difetto peggiore possibile per questa sezione e nessuno dei 34 assert di `verify:stage` lo vedeva: tutti misuravano DOVE stanno le card, e una card invisibile sta esattamente dove deve stare.

Fix in `stage.ts`, con `const solo = cards.length === 1`:
- `if (!cards.length) return` — si degrada, non si esce;
- `LEAD = solo ? 0` — `LEAD` esiste per dare alla prima card un tratto tutto suo PRIMA che la seconda salga; senza seconda card quel tratto è l'intera corsa, e 0.45 avrebbe solo tagliato fuori il 45% della corsa dal reel;
- `span = solo ? 1 : …` — il divisore è `cards.length - 1`, cioè **0**: `span` diventava `Infinity`. Oggi non se ne accorgerebbe nessuno (il ciclo delle salite è vuoto), ed è esattamente perché va chiuso adesso;
- **un tween vuoto di durata 1 quando `solo`**: senza le salite la timeline nasce a durata 0, e tutto ciò che sotto è una frazione di `tl.duration()` (coda ferma, `total`, finestra del reel, soglia del trascritto) diventa 0 o 0/0;
- `callAt` per la PRIMA card non è più `0` ma `total * 0.06`: con `0` netto la soglia era superata al primo frame, quindi `seenBefore` restava falso e il trascritto scattava a `is-instant` — completo, senza mai animare. Non si vedeva perché la chiamata è la terza card; con un progetto solo, o con la chiamata in testa, sarebbe l'unico comportamento visibile.

**Verificato a 1, 2 e 3 card** (`verify:stage` verde su tutte e tre, `verify:anim` verde, `check` 0 errori, screenshot CDP a 1 card). `travel={440}` NON è stato toccato: con una card sola l'intera corsa va al reel di quella card, cioè il massimo di "scoperto" che Vlad aveva chiesto tre volte. Se un giorno sembrasse troppo lunga, è quella riga in `index.astro` — non `LEAD`.

⚠ **Gli strumenti si biforcano sul CONTENUTO, non solo sul comportamento** — stessa regola già scritta per il dispatcher di §04, qui applicata dove mancava. Un assert che diventa rosso perché è cambiato quanto c'è in scena insegna a ignorare l'esito dello strumento:
- `verify-stage`: le invarianti del mazzo ("incompleto all'inizio", "le sepolte sono rientrate") valgono solo da 2 card in su, e con 1 hanno un'invariante **opposta** da asserire (in scena da subito, scala piena). `rest.cards > 1` è diventato `>= 1`: portava di straforo un requisito mai dichiarato ("devono essercene almeno due").
- I tre assert del trascritto + quello senza JS sono gated sulla PRESENZA di una card `kind: 'call'`. Uno di loro non falliva, **crashava** (`querySelector` null → `.classList`), portandosi giù l'intero strumento prima di stampare i risultati già raccolti.
- `verify-anim`: §04 aveva **tre** stati e non due — muro, righe, e **assente** (feature flag spento). Con la sezione spenta nove controlli diventavano rossi in una volta. Nel ramo assente c'è ora l'assert **speculare**: quel contenuto non deve stare nell'HTML, o il flag nasconderebbe via CSS qualcosa che continua a essere servito e indicizzato.

⚠ **Nuovo assert da non indebolire**: `verify-stage` misura ora l'**opacità dipinta** di ogni card a ogni campione della corsa. Sembra ridondante (nessun tween la anima) ed è l'unica sonda che vede questa classe di guasto.

### §04 Statement — da riga singola a manifesto editoriale

"Nota a margine" (`Statement.astro`) non è più un corpo unico: tre registri tipografici più un piano di sfondo.

- **Tre `tier` nel testo** (`quiet`/`loud`/`accent`, in `data/statements.ts`): la premessa (`quiet`) va smorzata — corpo minore, `--color-paper-text-2`/`--color-text-2` (mai `text-3`, sotto AA su queste superfici), peso 400 — mentre il resto dell'`<h2>` è ORA la voce dominante di default (accento pieno, peso 600): prima l'accento stava solo sulle parole marcate e il resto pesava uguale alla premessa, cioè un manifesto che non contrasta niente.
- **Il filetto cinetico sotto l'accento è un `::after` su un `<em>` `inline-block`, NON un `background-image` + `box-decoration-break: clone`.** Il gradiente-per-riga sembrava la scelta giusta per un accento di quattro parole che va a capo, ma misurato via CDP: con `line-height: 0.92` i frammenti di riga si SOVRAPPONGONO (l'area di contenuto di Geist misura ~1.107em contro una riga da 0.92em), quindi il filetto della prima riga tagliava le lettere della seconda. `inline-block` sposta l'accento INTERO alla riga successiva invece di spezzarlo — stessa tecnica di `.fp__h em` in §03 — e con un solo frammento il `::after` non ha più una seconda scatola con cui sovrapporsi.
- **La parola-fantasma** (`.st__ghost`, generalizzazione di M6/`data-drift`): corpo gigantesco, contrasto quasi nullo (`color-mix` al 70% verso il fondo, mai l'hairline puro — su un glifo da 200px l'area conta quanto il rapporto), ripete il NUCLEO SEMANTICO dello statement ("Studiare"/"Capire", campo `ghost` nei dati) invece di essere decorazione a caso, e deriva in parallasse allo scroll. Ancorata a DESTRA e sbordante (`overflow: clip` su `.st`), non a filo del testo: misurato che a filo copriva le prime parole della premessa lasciando vuoto il resto della riga. `data-drift` (M6, prima senza nessun utente nel markup, come M11) è stato parametrizzato — `data-drift="-5"` — perché la micro-deriva del 2.5% pensata per un filo impercettibile non bastava a un piano di sfondo.
- **Il timbro editoriale** (`[ MANIFESTO · STATEMENT 04 ]`, campo `stamp`): stesso corpo mono/stesso registro della label in alto, entra ultimo (1900ms, dopo filetto e parole) — parentesi e punto medio `aria-hidden`, le parole no.
- `tools/verify-anim.mjs` aveva un assert stantio: "il testo dello statement è nell'HTML" cercava la stringa `'non scrivo solo'`, che è una riga di `WhatIDo.astro` — verde da sempre per il motivo sbagliato, sarebbe rimasto verde anche con la sezione statement cancellata dalla pagina. Corretto per cercare davvero premessa+accento+timbro. Aggiunte 4 asserzioni sui tre nuovi elementi (riposo/dopo-scroll/salto/reduce).

### §04 Dicono — DUE impianti, e a scegliere è il numero di citazioni

⚠ **`Testimonials.astro` non è più una sezione, è un dispatcher.** È il solo file che le pagine importano (`index.astro` non sa quale layout verrà reso) e sceglie da sé:

| citazioni | impianto | file |
|---|---|---|
| 0 | niente | — |
| 1 | Focus, registro `solo` | `TestimonialsFocus.astro` |
| 2-5 | Focus, registro `righe` | `TestimonialsFocus.astro` |
| 6-8 | Muro, 2 colonne | `TestimonialsWall.astro` |
| 9+ | Muro, 3 colonne | `TestimonialsWall.astro` |

⚠ **La soglia è 6 e i due numeri che la decidono sono geometrici, non di gusto.** Da sotto: le righe si dividono un viewport meno il titolo (~615px a 900 di altezza); a sei righe sarebbero ~100px l'una, dove una citazione di tre righe non ci sta più insieme al nome. Da sopra: il muro riempie le colonne con **almeno tre card ciascuna** (o la traccia diventa più corta della finestra e ad ogni giro passa un buco), quindi la prima configurazione sensata è 2 × 3 = 6. Le due condizioni si incontrano esattamente lì.

⚠ **Automatico e non un import da cambiare a mano**, perché il difetto che si evita è SILENZIOSO: il muro con tre citazioni non si rompe, ripete le stesse tre frasi in loop in una colonna sola — *sembra* funzionare, quindi nessuno va a controllarlo.

⚠ **Due impianti e non cinque.** Si potevano fare quattro o cinque layout, uno per numero: sarebbero stati quattro o cinque percorsi di codice di cui uno solo visibile alla volta, cioè quattro modi di rompersi in silenzio. Due impianti con un registro interno coprono ogni numero da 1 a ∞ e sono entrambi guardabili in qualunque momento.

**Cosa condividono, e perché è estratto invece che copiato:**
- `TestimonialsIntro.astro` — indice, titolo, cancellatura, coreografia M14. La frase è l'identità della sezione: copiata in due file sarebbero state due coreografie libere di divergere al primo ritocco, e la divergenza si sarebbe vista solo cambiando impianto, cioè mesi dopo. ⚠ Le classi restano `.ts__*` perché `verify-anim` le sonda: rinominarle avrebbe reso quegli assert verdi per assenza di bersaglio.
- `TestimonialIdentity.astro` — ritratto/monogramma, nome, ruolo, social. Tre varianti (`card`, `blocco`, `riga`). Duplicarlo avrebbe significato correggere due volte ogni difetto di accessibilità, e scoprire di averne corretto uno solo per caso.

⚠ **`verify-anim` si biforca insieme alla sezione.** Legge quale impianto è in scena e asserisce solo le invarianti che gli competono; senza, il giorno in cui i segnaposto diventano tre testimonianze vere metà dei controlli di §04 diventerebbe rossa senza che si sia rotto niente.

#### L'impianto FOCUS (1-5) — righe editoriali

Il problema è **l'opposto** di quello del muro: un muro che scorre dice "ce ne sono più di quante ne stiano in uno schermo", che con due citazioni è una bugia. Con poche testimonianze il lavoro è far leggere *quella*, e far sembrare la scarsità una scelta. Da cui: nessun box, nessun movimento, molta aria, e il corpo del testo che **cresce** quando le citazioni sono poche invece di lasciare vuoto.

- **La persona sta a SINISTRA, la citazione a destra.** La colonna di sinistra diventa un elenco verticale di volti e nomi, che è letteralmente ciò che il titolo promette ("Ascolta loro:"). E le citazioni allineate su un unico bordo hanno una misura di lettura costante — a parti invertite il bordo destro sarebbe frastagliato e i nomi appesi a distanze irregolari.
- ⚠ **Non riusa il dispositivo `01/02/03` di §01**, che sarebbe la scelta ovvia: §01 sta nella STESSA Home con esattamente quel disegno, e ripeterlo farebbe leggere le due sezioni come la stessa cosa detta due volte. Il filetto resta, il numero no — al suo posto c'è un volto.
- ⚠ **Nessun movimento continuo.** Il muro si muove perché il movimento È il messaggio; qui non c'è niente da dire col movimento, e un loop su tre righe ferme sarebbe decorazione.
- **`grid-auto-rows: minmax(0, 1fr)`**: le righe si dividono l'altezza in parti uguali. Con altezze automatiche una citazione lunga il doppio produrrebbe una riga alta il doppio e i filetti cadrebbero a distanze irregolari — un elenco *capitato* invece che composto.

⚠ **Tre tarature misurate, non stimate** (`QUOTE_SIZE`, `MEASURE`, `denso` in `TestimonialsFocus.astro`):
1. **Il corpo usa `min(Xvw, Yvh)`, non solo `vw`.** Con la sola larghezza il corpo restava identico a 1440×900 e a 1440×650, ma lo spazio no (579px → 404px): l'ultima riga sbordava. Il termine `vh` fa cedere il corpo quando è l'altezza a mancare.
2. **La misura si ALLARGA al crescere delle citazioni** (22em → 30em), che sembra il contrario del giusto. È in `em`: una `max-width` in em fissa i CARATTERI per riga, quindi il numero di RIGHE è costante a qualunque corpo — rimpicciolire il testo non ne toglie nemmeno una. Con cinque blocchi in un viewport basso, l'unica leva che riduce l'altezza è allungare la riga.
3. **Da 4 citazioni l'attribuzione va in linea** (`variant="riga"`). Impilata misura ~88px (ritratto 40 + stacco 14 + social 34) ed era LEI a non entrare, non il testo — il difetto si presentava come un ritaglio di pochi pixel e sembrava un problema tipografico.

⚠ **Il debordo è sorvegliato**: `verify-anim` misura che le citazioni stiano nello spazio calcolato. Non c'è nessun ritaglio, quindi il testo in eccesso non sparisce — si sovrappone alla riga sotto, difetto che si nota solo andandolo a cercare. ⚠ E si misura **dopo lo scroll**: a riposo le righe portano `translate: 0 26px`, che entra nello `scrollHeight` e produce un debordo inesistente. La prima stesura sbagliava proprio questo, ed era rossa su un layout corretto.

#### Contenuti e posizione (valgono per entrambi gli impianti)

**⏳ Lo stato dei CONTENUTI è temporaneo e va cambiato SOLO su richiesta di Vlad.**

⚠ **DAL 2026-08-07 LA SEZIONE È SPENTA**: `SITE.features.testimonials` è a `false`, su richiesta esplicita di Vlad ("nascondi la sezione testimonianze finché non aggiungerò delle testimonianze vere"). `data/testimonials.ts` NON è stato toccato — le nove citazioni segnaposto sono ancora lì, pronte: si riaccende cambiando il flag, niente da ricostruire.

⚠ **Non riaccenderlo di propria iniziativa, e non rispegnerlo se lo trovi acceso.** Questo flag è stato mosso nelle due direzioni per iniziativa sbagliata: prima rispento appellandosi alla policy anti-testimonianze-finte (errore — quella policy vale per ciò che finisce **pubblicato**, non per un segnaposto locale che lui aveva chiesto di tenere acceso), oggi spento **perché l'ha chiesto lui**. La regola stabile non è "acceso" né "spento": è **decide Vlad**. **Vanno comunque sostituite con citazioni vere prima di qualunque deploy.**

Con nove segnaposto la Home renderebbe il MURO; per guardare l'impianto focus si abbassa il conteggio con le props `force`/`limit` (documentate come "solo per anteprima" in `Testimonials.astro`).

⚠ **Erano tre, sono nove dal 2026-08-06, e il motivo è geometrico.** Il muro ha tre colonne, e una colonna che scorre in loop deve contenere abbastanza card da essere **più alta della finestra che la mostra**, altrimenti ad ogni giro passa un buco. I nomi sono coppie dell'alfabeto NATO fra parentesi quadre (`[Alfa Bravo]`, `[Charlie Delta]`, …) e **anche questa è una scelta funzionale**: le iniziali alimentano il monogramma, e nove card marcate tutte `[Nome Cognome]` producevano nove cerchi identici con dentro "NC" — in un muro si legge come un errore di rendering, non come un segnaposto. ⚠ **L'ordine dell'array è editoriale**: nel muro le colonne si riempiono a fette e quelle oltre la prima spariscono sotto i breakpoint, quindi su telefono si legge **solo la prima fetta** — le citazioni più forti vanno in testa.

**Posizione: `slot="out"` dell'handoff `dicono`, su fondo CANVAS** (vedi la tabella delle superfici: Dicono è nera, il paper resta solo dello Statement). Entra scorrendo normalmente da sotto, si incolla, resta leggibile per `travel=140`, e solo allora lo Statement paper le sale sopra. Le versioni precedenti la mettevano nello `slot="in"` su paper: le note che lo dicono sono storia.

**Il vincolo che governa entrambi gli impianti**: la sezione è incollata, quindi **non deve mai superare un viewport** (vedi Handoff.astro). Il muro ci arriva con `height: 100svh` e ritagliando; il focus con la stessa altezza rigida ma senza ritagliare — vedi le rispettive note.

Numerazione a scorrimento: **03 In evidenza → 04 Dicono → 05 Percorso**. Lo "Statement 04" nel timbro di `Statement.astro` è una numerazione DIVERSA — l'identità del testo in `data/statements.ts`, non l'indice di sezione — e non collide: sono due badge visivamente distinti.

⚠ **I due registri sono stati approvati da Vlad il 2026-08-07**, e la pagina di prova temporanea `/prova-testimonianze` (che li rendeva affiancati a tutti i conteggi) è stata cancellata di conseguenza — non esiste più, non c'è più bisogno di ricrearla per giudicare l'impaginazione. Se in futuro serve ri-guardare un conteggio specifico, il modo più rapido è forzarlo temporaneamente con `force`/`limit` su `<Testimonials>` (props documentate come "solo per anteprima" in `Testimonials.astro`) e ripristinare prima di committare.

#### Il titolo, condiviso: è il contenuto

"Se ancora non ti ho convinto che sono la persona giusta, non ascoltare me. Ascolta loro:" fa una cosa sola, passa la parola. ⚠ **NON riusa il dispositivo dello Statement.** Ricopiare premessa+accento+sottolineatura+fantasma+timbro renderebbe le due sezioni indistinguibili. Stessa FAMIGLIA di vocabolario (tre registri, un `::after` in `scaleX`, M14 a due battute), **gesto diverso — una riga che CANCELLA invece di sottolineare.** Il filetto è d'accento e non grigio: un tratto grigio su testo grigio legge come un errore di stampa, l'accento lo rende un segno editoriale.

- `is-in` — le 16 parole di M2 si posano (~1225ms), poi la cancellatura si tira (ritardo 1250ms, tarato su quel conto);
- `is-on` — la frase si risolve: la parte barrata si smorza, "Ascolta loro:" passa all'accento. Niente è illeggibile in attesa: entrambe partono dal testo pieno e arrivano a valori sopra AA — la pausa trattiene colore, non informazione.

#### L'impianto MURO (6+) — M18

Origine: una grafica di riferimento **React + `motion/react` + shadcn** portata da Vlad. ⚠ **Non è stata installata nessuna delle tre dipendenze**, ed è la regola architetturale del repo, non una preferenza: React + motion costano ~45 KB gzip di runtime per un effetto che il CSS fa con tre dichiarazioni e zero JS. Si è portato il **disegno** — tre colonne, loop senza giunture, dissolvenza sui bordi, forma della card — non l'implementazione.

- **Il loop senza giunture**: ogni traccia contiene le sue card DUE VOLTE e trasla di `-50%`. ⚠ Il `padding-bottom` pari al `gap` **non è un margine estetico, è ciò che rende il conto esatto**: senza, l'altezza è `2N·c + (2N−1)·g` e il 50% non cade sul primo pixel della seconda copia — compare uno scatto di mezzo gap ad ogni giro. Con il padding l'altezza è `2N(c+g)` e il salto è invisibile.
- **La copia è `aria-hidden`** (prop `decorative` su `TestimonialCard`), altrimenti uno screen reader annuncia diciotto citazioni in coppie identiche — difetto che la grafica di riferimento ha. ⚠ E marcare **non basta**: i link dentro la copia prendono `tabindex="-1"`, perché un `aria-hidden` che contiene elementi raggiungibili da tastiera è una violazione WCAG vera (`aria-hidden-focus`). Togliere i link dalla copia avrebbe risolto l'accessibilità rompendo la grafica — card duplicate visibilmente diverse dalle originali, e in un loop la differenza si vede.
- ⚠⚠ **`height: 100svh` e NON `min-height`, ed è l'unica sezione del sito dove va così.** La convenzione delle sezioni dentro un handoff è `min-height`, e lì è corretta perché il loro contenuto è più corto di uno schermo. Qui il contenuto è **deliberatamente più alto** (due copie di ogni card), e con `min-height` l'altezza del contenitore resta INDEFINITA: per specifica una traccia `1fr` in un contenitore indefinito non distribuisce spazio libero, prende la dimensione del contenuto. Misurato via CDP: **sezione a 2297px invece di 900**, cioè sticky rotto e ~1400px irraggiungibili. `height` rende l'altezza definita, il che è l'unico modo perché `minmax(0, 1fr)` significhi "quello che resta". Per una sezione che deve restare incollata non è una perdita di flessibilità, è la regola scritta per esteso.
- **Conseguenza da ricordare**: il numero di testimonianze **non è più un vincolo di layout** della Home. Aggiungerne allunga le tracce, che sono ritagliate, non la sezione. La nota di avvertimento in `index.astro` sulla "quarta card" è stata riscritta di conseguenza.
- **Le velocità (38/46/42s) sono la cosa che fa più lavoro**: con la stessa durata le tre colonne resterebbero in fase e il muro leggerebbe come UN blocco che scivola. ⚠ **~40s e non i 15-19s del riferimento**: qui dentro c'è del testo da leggere. La colonna più lenta al centro dà un asse al movimento invece di una scala.
- ⚠ **Qui il ritardo NEGATIVO è corretto**, al contrario delle onde della CTA (dove ha causato un difetto reale). La differenza non è il segno del ritardo, è **se il fotogramma intermedio di quell'animazione sia uno stato presentabile**: lì era un'onda mezza nata, qui è "la colonna è scorsa un po'" — una composizione statica valida, che è esattamente ciò che serve mentre il muro è in pausa.
- **Si ferma in hover e con il focus dentro** (WCAG 2.2.2: un movimento automatico più lungo di 5s deve essere fermabile). Ferma TUTTE le colonne, non solo quella sotto il puntatore: se stai leggendo, le altre due che scorrono nella periferia sono il disturbo da cui ti stai difendendo. ⚠ Non viola "niente hover come trigger": quella regola riguarda le animazioni che PARTONO al passaggio del mouse — qui l'hover spegne. L'hover è gated su `(hover: hover)` (su touch resterebbe appiccicato dopo un tap), il `:focus-within` no. ⚠ E queste regole devono stare **dopo** quella di `.is-in`: stessa specificità, decide l'ordine nel file.
- **Il costo dichiarato**: `display: none` sulle colonne 2-3 sotto i breakpoint le toglie anche dall'albero di accessibilità, quindi su telefono si leggono 3 citazioni su 9. La ridistribuzione non è ottenibile in CSS (la divisione in fette sta nel markup); l'alternativa sarebbe due colonne strettissime a 390px, illeggibili per tutti invece che parziali per alcuni. Mitigazione editoriale: l'ordine dell'array.

#### Le card (`TestimonialCard.astro`)

Riscritta con il muro. **Cosa è cambiato**: via l'indice mono `01/02/03` (in una colonna che ripassa, un ordinale è una promessa che il layout non può mantenere), via il `grid-template-rows: auto 1fr auto` (ancorava l'attribuzione perché tre card AFFIANCATE avessero i nomi sulla stessa linea; in verticale non c'è nessuna linea condivisa da rispettare), via l'ingresso per card (entra la colonna: tre ritardi invece di diciotto). **La superficie ora ha un riempimento e un alone** — la nota precedente diceva l'opposto, cambiata di proposito. ⚠ Ma non copiati alla lettera: `shadow-lg` è un'ombra NERA e su un canvas `#050505` **non produce un solo pixel diverso**; l'unica parte traducibile di `shadow-lg shadow-primary/10` è la sua TINTA. Da qui `--color-surface-1` (il token che esiste per le card) e un alone d'accento al 26%. Nessun colore nuovo, nessun hex.

**Cosa resta e va difeso**: nessuna stella e nessuna virgoletta gigante in corpo 120 (il cliché della sezione testimonianze; le stelle trasformerebbero una persona in un punteggio, esplicitamente escluse da Vlad). Il **monogramma dalle iniziali** quando manca la foto — uno slot vuoto legge come difetto, due lettere composte come una scelta; lo strip `\p{L}` serve perché i segnaposto hanno le parentesi quadre nel nome. Social come icone SVG scritte in markup Astro e non con `set:html`, così lo scope arriva gratis (la trappola già costata due volte con `.sp__logo-svg` e `.sp__letter`); bersaglio 34px, sopra il minimo WCAG 2.5.8, e `aria-label` che include il nome della persona perché nove link chiamati tutti "LinkedIn" sono indistinguibili in un elenco.

⚠ **Nuovo assert da non indebolire**: `verify-anim` misura che **mezza traccia copra tutta la finestra** del muro. È l'unico difetto di questa sezione che non si vede guardandola per dieci secondi — quindi è esattamente quello che deve controllare uno strumento e non un paio d'occhi. Misura il rapporto, non un'altezza attesa: card e viewport cambiano, la relazione no.

`verify-anim.mjs` ha guadagnato con §04 sei asserzioni (vedi però la nota sopra sul perché un TOTALE non va più citato): riposo (cancellatura non tirata, card a opacità 0), dopo-scroll, salto in fondo, reduce, HTML senza JS, più un **assert di contrasto** sull'accento del titolo — misurato sul fondo reale risalito nel DOM (5.47:1), non confrontato con un hex, per la regola "mai un token duplicato in un assert".

⚠ **Il dev server ha servito CSS stantio anche in questa sessione**, con lo stesso sintomo già documentato più sotto: HTML fresco (le classi nuove c'erano) e foglio di stile del componente ancora con una classe CANCELLATA (`ts__body`), quindi la griglia a 12 colonne auto-piazzava titolo e card in colonne singole e la sezione misurava 2259px invece di 900. Diagnosi rapida che evita di andare a caccia nel CSS: `curl` del modulo di stile del componente (`/src/components/.../X.astro?astro&type=style&index=0&lang.css`) e cercarci dentro una classe che non esiste più nel sorgente. Se c'è, il colpevole è il server.

### §05 Percorso (ex §06, poi §04) — JEParma nel teaser, e il vincolo di UNO schermo

`JourneyTeaser` è passato da "06" a "04" (con `Testimonials` spenta il numero saltava da "03 · In evidenza" a "06" senza nulla in mezzo), e poi da "04" a **"05"** quando Dicono si è accesa e ha preso il 04 — vedi sopra.

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

### §80 Footer — la luce che si spegne (2026-08-07)

Il footer non ha più un taglio netto in cima: **raccoglie la luce della CTA e la porta a morire nel nero** sul bordo inferiore della pagina. Origine dell'idea: uno snippet portato da Vlad (`radial-gradient(125% 125% at 50% 10%, #000 40%, #63e 100%)`), che metteva la luce IN BASSO. Applicarlo alla lettera sarebbe stato un difetto e non un effetto — due campi viola impilati sotto la CTA che ne ha già uno, un secondo viola diverso da `--color-accent`, e il punto più chiaro dell'intera pagina sul suo ultimo pixel. L'idea è stata **ribaltata**: la luce non riparte, continua e si spegne.

⚠ **Il gradiente NON è tarato a occhio, è la continuazione geometrica di quello della CTA.** Il core di `.cta__sky` sta `at 95% 105%`: il suo centro è 5svh *sotto* il bordo inferiore della sezione, cioè dentro il footer. Il bagliore del footer (`at 92% 2svh`) mostra la stessa sorgente vista dall'altra parte del confine — per questo i due combaciano senza doverli riaccordare a mano ad ogni ritocco. La caduta è però più ripida (38svh contro 85svh): il footer deve essere il decadimento, non un secondo picco.

⚠ **Tre difetti trovati misurando, non guardando** — e sono il motivo per cui esiste `npm run sample:px`:
1. **36px di banda nera** fra i due campi viola. `.cta` dichiarava `min-height: 100svh` dentro un `.ho__in` con floor 104svh: 4svh del fondo dell'occlusore restavano scoperti. Invisibili finché erano nero su nero. Risolto esponendo il floor come custom property — vedi la nota in "Convenzioni consolidate".
2. **Scalino di 2,5:1 sulla cucitura** (`#7a65b8` → `#45337a`). Risolto con caduta più ripida e opacità pari a quella della CTA: oggi 1,41:1.
3. **Le label del footer scese a 3,38:1**, sotto AA, perché il gradiente era finito sotto di loro (`--color-text-3` faceva già 4,19:1 sul nero — difetto noto). Portate a `--color-text-2`, insieme a `.cv__meta` e alla barra in basso. Oggi il punto peggiore di tutto il footer è 6,38:1.

⚠ **Il quarto stop del gradiente esiste solo per far sparire un BORDO.** Con `accent-deep 30% → transparent 62%` l'alfa scendeva troppo regolarmente e su un'ellisse schiacciata il punto in cui arriva a zero si leggeva come un **arco disegnato** — una nuvola con un contorno. La tappa intermedia al 44% spezza la rampa in due pendenze: ripida dove la luce è forte, lunghissima nella coda. Una coda lunga e piatta non ha un punto in cui finisce.

⚠ **Il footer si accorda a ciò che ha sopra, e lo capisce da solo** (`:global(body:has(.cta))`). `CTASection` esiste su una pagina sola: se è nel documento la luce si accende e il filetto sparisce; altrimenti footer nero col suo confine dichiarato. Non è rifinitura: un gradiente ritagliato dal bordo superiore mostra quel bordo come una **riga dritta** ogni volta che sopra non c'è niente di altrettanto luminoso — su `/chi-sono` si vedeva un rettangolo di luce che cominciava dal nulla. Ammorbidire il bordo con una dissolvenza NON è la via d'uscita: la stessa dissolvenza, in Home, aprirebbe una riga scura proprio sulla giuntura che il bagliore esiste per far sparire. Le due esigenze sono opposte, quindi si distinguono i casi invece di cercare un compromesso inesistente. `:has()` sul body e non un `bodyClass`: il footer resta UNO, e il segnale è la presenza del contenuto stesso — l'unica cosa che non può andare fuori sincrono.

**Gli altri due interventi.** Tre canali (email + WhatsApp + LinkedIn) al posto della sola email, da cui anche il cambio di etichetta: "Dove sono" descriveva solo il luogo, **"Dove trovarmi"** copre il luogo e i modi. E **wordmark e barra base separati**: la barra viene ora PRIMA: prima le stava sopra (il `margin-bottom: -0.28em` del wordmark tirava su l'elemento successivo) e il suo testo misurava 3,65:1 sopra i glifi. Ora il wordmark è davvero l'ultimo gesto, tagliato solo dal bordo pagina.

⚠ **Due proposte sono state ESCLUSE da Vlad** e non vanno riproposte come "fix": il bottone CV resta un bottone (non diventa un link testuale) e la griglia 4/3/3 resta com'è, vuoto compreso.

### Convenzioni consolidate durante le rifiniture, da riusare (non nel piano originale)

- **Sezioni "in"/"out" di un handoff M12 dichiarano SEMPRE il proprio `min-height: 100svh`** (grid + `align-content:center` per centrare il contenuto), invece di affidarsi a padding generoso per raggiungere l'altezza minima richiesta da `Handoff.astro`. Pattern in `Statement.astro`, `FeaturedProjects.astro`, `JourneyTeaser.astro`, `WhatIDo.astro`. Vale su tutti i breakpoint, mobile incluso — non è un bug, è "un'idea per viewport" applicato alla lettera.

  ⚠ **Ma una sezione `slot="in"` che DIPINGE qualcosa di suo deve riempire il floor dell'occlusore, non 100svh** (dal 2026-08-07). `.ho__in` ha `min-height: 104svh`: una sezione da 100svh lascia scoperti 4svh del fondo dell'occlusore sotto di sé — 36px a 900 di viewport. Finché sono nero su nero non li vede nessuno; dal momento in cui la sezione dipinge un fondo proprio diventano una banda visibile. Successo davvero con la CTA, quando il footer ha cominciato a raccoglierne la luce: fra i due campi viola c'erano 36px di nero. Il floor è esposto come custom property (`--ho-in-floor` su `.ho__in`, azzerata da `bareIn`), quindi `CTASection` scrive `min-height: var(--ho-in-floor, 100svh)` invece di ricopiare il numero — se un domani il 104 cambia, cambia in un posto solo.

  ⚠ **Due sezioni adiacenti che devono sembrare UNA superficie continua non si accordano a occhio.** La geometria si eredita: il centro del gradiente della CTA sta al 105% della sua altezza, cioè fuori dalla sezione e dentro il footer — quindi il bagliore del footer non è un secondo gradiente da intonare, è la stessa sorgente vista dall'altra parte del confine (`at 92% 2svh`). E il risultato si MISURA in pixel reali, non si stima: alla prima taratura la cucitura passava da `#7a65b8` a `#45337a`, uno scalino di 2,5:1 in luminanza, chiaramente visibile (oggi 1,41:1, invisibile). Lo strumento è `npm run sample:px`, scritto in quell'occasione — vedi la nota in "Comandi".
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
