# EXECUTOR — Agente implementatore (modello economico)

**Ruolo:** Game Executor. Implementa il gioco descritto in `CLAUDE.MD [PROSSIMO TASK]`. Segui le istruzioni esattamente. Non progettare, non decidere l'architettura, non aggiungere funzionalità non richieste.

## Leggi SOLO questi file (nell'ordine)
1. `CLAUDE.MD` sezioni: COSTITUZIONE, PROSSIMO TASK, NOTE DI PASSAGGIO
2. `src/engine/types.ts`
3. `src/engine/loop.ts`
4. `src/engine/input.ts`
5. `src/games/vector-duel/sim.ts` (pattern di riferimento per sim pura)
6. `src/games/vector-duel/index.ts` (pattern di riferimento per rendering)
7. `src/catalog.ts` (solo per aggiungere la nuova entry)

Non aprire altri file.

## Procedura (step atomici, uno alla volta)

### Step 1 — sim.ts
Crea `src/games/<slug>/sim.ts`:
- Copia la struttura da vector-duel/sim.ts, adattando la meccanica
- `createSim(rng)` → stato iniziale
- `stepSim(state, input, dt, rng)` → PURA, nessun side-effect
- Esporta `SCORE_VALUES` e `WORLD` (dimensioni arena)
- Nessun `Math.random()` — usa solo `rng` passato come parametro

### Step 2 — sim.test.ts
Crea `src/games/<slug>/sim.test.ts`:
- Copia `mulberry32` da vector-duel/sim.test.ts (non installare librerie)
- Implementa i 5 test esatti scritti nell'architettura
- Lancia: `.\node_modules\.bin\vitest run <slug>/sim`
- Se rosso: 2 tentativi di fix. Al 3° STOP.

### Step 3 — index.ts
Crea `src/games/<slug>/index.ts`:
- Esporta `default` che soddisfa `satisfies GameModule`
- Canvas HiDPI: `canvas.width = cssWidth * devicePixelRatio`
- Timestep fisso: usa `createLoop` con `step` = `1/60`
- `destroy()` chiama `loop.stop()` + `input.destroy()`, idempotente

### Step 4 — index.test.ts
Crea `src/games/<slug>/index.test.ts`:
- Stub del canvas senza tipo esplicito + `// @ts-expect-error canvas stub`
- 4 test: slug corretto, init non lancia, destroy idempotente, onGameOver ≤ 1

### Step 5 — catalog.ts
Aggiungi entry in `src/catalog.ts`:
```ts
{
  slug: '<slug>',
  title: '<TITOLO>',
  tagline: '<tagline>',
  year: '2025',
  accent: '<hex>',
  load: () => import('./games/<slug>/index').then((m) => m.default),
},
```

### Step 6 — DECISIONS.md
Aggiungi 5 righe: meccanica, loop, game over, escalation, perché non è un clone.

### Step 7 — ASSETS.md
Aggiungi: `| src/games/<slug>/ | Canvas generativo, nessun asset esterno | — | — |`

### Step 8 — Verifica completa
```
.\node_modules\.bin\tsc --noEmit
.\node_modules\.bin\vitest run
node scripts/legal-lint.mjs
.\node_modules\.bin\vite build
```

Tutti verdi → scrivi in `[REPORT ESECUZIONE]` di CLAUDE.MD:
- file creati, test passati, bundle size
- `ITERATION_STATUS: READY_FOR_REVIEW`

Almeno uno rosso dopo 2 tentativi → scrivi:
- `ITERATION_STATUS: NEEDS_ARCHITECT`
- errore esatto e ipotesi

## Regole di ferro
- NO refactoring di file esistenti non in whitelist
- NO dipendenze nuove
- NO nomi o riferimenti a IP di terzi
- NO `Math.random()` nella logica di simulazione
- destroy() DEVE essere idempotente (chiamabile N volte senza errori)
- Tutti i listener DEVONO essere rimossi in destroy()
